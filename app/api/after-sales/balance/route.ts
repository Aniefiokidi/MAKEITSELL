import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { clearVendorEarnings } from '@/lib/after-sales'
import { readableLines, activeCase } from '@/lib/after-sales-policy'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
export async function GET(request: NextRequest) {
 const user=await getSessionUserFromRequest(request)
 if(!user)return NextResponse.json({error:'Sign in to continue'},{status:401})
 try {
  await clearVendorEarnings(user.id)
  const wallet:any=await User.findById(user.id).select('walletBalance').lean()
  const totals={inEscrow:0,pending:0,onHold:0,available:Number(wallet?.walletBalance||0),needsReconciliation:0}
  const storeId=request.nextUrl.searchParams.get('storeId')
  const cursor=Order.find({paymentStatus:'escrow','vendors.vendorId':user.id}).lean().cursor()
  for await(const order of cursor as any){
   // An order whose history can't be reconciled stays in escrow and is surfaced as a
   // count, rather than taking the whole balance endpoint down with it.
   const derived=readableLines(order)
   if(derived.needsReconciliation){totals.needsReconciliation+=1;continue}
   for(const l of derived.lines){if(l.vendorId!==user.id||l.cancelled||l.settledAt||(storeId&&l.storeId!==storeId))continue
    const amount=(l.amountCents-(l.refundedCents||0))/100
    if((order.afterSalesCases||[]).some((c:any)=>c.lineId===l.id&&activeCase(c))||order.disputeStatus==='active'||order.disputeRaisedAt)totals.onHold+=amount
    else if(l.availableAt)totals.pending+=amount
    else totals.inEscrow+=amount
   }
  }
  return NextResponse.json({success:true,...totals})
 }catch(error){console.error('[after-sales] balance unavailable',error);return NextResponse.json({error:'Could not refresh protected earnings. Your funds remain protected.'},{status:500})}
}
