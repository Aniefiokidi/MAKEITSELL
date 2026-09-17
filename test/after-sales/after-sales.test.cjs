const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { Order } = require('./build/models/Order');
const { User } = require('./build/models/User');
const { Store } = require('./build/models/Store');
const { WalletTransaction } = require('./build/models/WalletTransaction');
const { Product } = require('./build/models/Product');

const { openCase, changeCase, settleOrder, recordProtectedDelivery, processAfterSalesDeadlines, submitPendingProviderRefund, applyProviderRefundOutcome, reconcilePendingProviderRefunds } = require('./build/after-sales');
const policy = require('./build/after-sales-policy');
let db, buyer, vendor, admin, product, store;
before(async()=>{ db=await MongoMemoryReplSet.create({replSet:{count:1},binary:{version:'7.0.14'}});await mongoose.connect(db.getUri());await Promise.all([Order.init(),Store.init(),User.init(),WalletTransaction.init(),Product.init()]); });
after(async()=>{await mongoose.disconnect();if(db)await db.stop();});
beforeEach(async()=>{
  for(const model of [Order,User,Store,WalletTransaction,Product]) await model.deleteMany({});
  buyer=await User.create({});vendor=await User.create({});admin={id:new mongoose.Types.ObjectId().toString(),role:'admin'};
  store=await Store.create({storeName:'Test',vendorId:String(vendor._id)});
  product=await Product.create({name:'Shoes',price:100,stock:10,vendorId:String(vendor._id),variants:[{label:'Size',value:'40',stock:5},{label:'Size',value:'41',stock:5}]});
});
async function order(id='o', quantity=2) { return Order.create({orderId:id,customerId:String(buyer._id),totalAmount:107*quantity,vat:7*quantity,paymentStatus:'escrow',status:'delivered',vendors:[{vendorId:String(vendor._id),storeId:String(store._id),total:100*quantity,returnPolicySnapshot:{acceptReturns:true,acceptExchanges:true},items:[{title:'Shoes',productId:String(product._id),price:100,quantity,selectedVariants:[{label:'Size',value:'40'}]}]}]}); }
const actor=()=>({id:String(buyer._id),role:'customer'});
const request=(extra={})=>({orderId:'o',lineId:'0:0',quantity:1,reason:'wrong_size',kind:'return',description:'The wrong size was delivered',refundMethod:'wallet',evidence:[],...extra});
async function expired(){await Order.updateOne({orderId:'o'},{$set:{'protectionLines.0.availableAt':new Date(Date.now()-1000)}})}
test('ETA and manual delivered status cannot release funds',async()=>{await order();await Order.updateOne({orderId:'o'},{$set:{escrowReleaseAt:new Date(0)}});const r=await settleOrder('o');assert.equal(r.success,false);assert.equal((await User.findById(vendor._id)).walletBalance,0);});
test('verified delivery starts a full 48h hold; duplicate event preserves it',async()=>{await order();await recordProtectedDelivery('o',String(vendor._id),String(store._id));let o=await Order.findOne({orderId:'o'});const at=+new Date(o.protectionLines[0].availableAt);assert.ok(at-Date.now()>47.99*3600000);await recordProtectedDelivery('o',String(vendor._id),String(store._id));o=await Order.findOne({orderId:'o'});assert.equal(+new Date(o.protectionLines[0].availableAt),at);assert.equal((await settleOrder('o')).success,false);});
test('concurrent payout retries credit exactly once',async()=>{await order();await recordProtectedDelivery('o',String(vendor._id),String(store._id));await expired();await Promise.all([settleOrder('o'),settleOrder('o'),settleOrder('o')]);assert.equal((await User.findById(vendor._id)).walletBalance,200);assert.equal(await WalletTransaction.countDocuments({type:'vendor_credit'}),1);});
test('active item complaint blocks payout',async()=>{await order();await recordProtectedDelivery('o',String(vendor._id),String(store._id));await expired();await openCase(actor(),request());assert.equal((await settleOrder('o')).success,false);assert.equal((await User.findById(vendor._id)).walletBalance,0);});
test('foreign customer cannot open case; duplicate concurrent cases prevented',async()=>{await order();await assert.rejects(openCase({id:String(vendor._id),role:'customer'},request()),/own purchase/);const results=await Promise.allSettled([openCase(actor(),request()),openCase(actor(),request())]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);});
test('partial return refunds paid item plus allocated tax once; remaining quantity pays vendor',async()=>{
 await order();await recordProtectedDelivery('o',String(vendor._id),String(store._id));const c=await openCase(actor(),request());
 await changeCase(admin,{orderId:'o',caseId:c.id,action:'waive_return',note:'Supplier confirmed the wrong item need not be returned',evidence:['https://example.com/proof.jpg']});
 await Promise.allSettled([changeCase(admin,{orderId:'o',caseId:c.id,action:'refund',note:'Refund agreed'}),changeCase(admin,{orderId:'o',caseId:c.id,action:'refund',note:'Refund agreed'})]);
 assert.equal((await User.findById(buyer._id)).walletBalance,107);assert.equal(await WalletTransaction.countDocuments({type:'escrow_refund'}),1);
 await expired();await settleOrder('o');assert.equal((await User.findById(vendor._id)).walletBalance,100);
});
test('refund requires inspection or documented waiver; customer cannot approve own refund',async()=>{await order();const c=await openCase(actor(),request());await assert.rejects(changeCase(admin,{orderId:'o',caseId:c.id,action:'refund',note:'Refund'}),/inspection/);await assert.rejects(changeCase(actor(),{orderId:'o',caseId:c.id,action:'refund',note:'Refund'}),/admin/);});
test('late refund fails safely if vendor has withdrawn earnings',async()=>{await order();await recordProtectedDelivery('o',String(vendor._id),String(store._id));await expired();await settleOrder('o');await User.updateOne({_id:vendor._id},{$set:{walletBalance:0,earnedBalance:0}});const c=await openCase(actor(),request());await changeCase(admin,{orderId:'o',caseId:c.id,action:'waive_return',note:'Verified defect',evidence:['https://example.com/proof.jpg']});await assert.rejects(changeCase(admin,{orderId:'o',caseId:c.id,action:'refund',note:'Refund'}),/not funded/);assert.equal((await User.findById(buyer._id)).walletBalance,0);});
test('replacement reserves selected variant, not the original size',async()=>{await order();const c=await openCase(actor(),request({kind:'replacement',desiredVariant:'41'}));await changeCase(admin,{orderId:'o',caseId:c.id,action:'approve_return',fault:'vendor',note:'Verified wrong size',returnAddress:'Store address',confirmedVariant:'41',replacementVariantLabel:'Size',replacementVariantValue:'41'});const p=await Product.findById(product._id);assert.equal(p.variants.find(v=>v.value==='41').stock,4);assert.equal(p.variants.find(v=>v.value==='40').stock,5);});
test('expired return deadline escalates; it never automatically refunds',async()=>{await order();const c=await openCase(actor(),request());await Order.updateOne({orderId:'o'},{$set:{'afterSalesCases.0.deadline':new Date(0)}});await processAfterSalesDeadlines();const o=await Order.findOne({orderId:'o'});assert.equal(o.afterSalesCases[0].status,'admin_review');assert.equal((await User.findById(buyer._id)).walletBalance,0);});
test('cent allocations conserve discounted line totals across partial returns',()=>{const line={quantity:3,amountCents:10000,refundedQuantity:0};let sum=0;for(let i=0;i<3;i++){sum+=policy.refundCents(line,1);line.refundedQuantity++}assert.equal(sum,10000);assert.throws(()=>policy.refundCents(line,1),/quantity/);});
test('non-HTTPS evidence and excess quantity are rejected',async()=>{await order();await assert.rejects(openCase(actor(),request({evidence:['javascript:alert(1)']})),/HTTPS/);await assert.rejects(openCase(actor(),request({quantity:3})),/quantity/);});
test('one store complaint does not freeze another store owned by the same vendor',async()=>{
 await order();const second=await Store.create({storeName:'Second',vendorId:String(vendor._id)});
 await Order.updateOne({orderId:'o'},{$push:{vendors:{vendorId:String(vendor._id),storeId:String(second._id),total:50,items:[{title:'Other item',price:50,quantity:1}]}},$set:{totalAmount:264}});
 await recordProtectedDelivery('o',String(vendor._id),String(store._id));await recordProtectedDelivery('o',String(vendor._id),String(second._id));
 await Order.updateOne({orderId:'o'},{$set:{'protectionLines.0.availableAt':new Date(0),'protectionLines.1.availableAt':new Date(0)}});
 await openCase(actor(),request());await settleOrder('o');assert.equal((await User.findById(vendor._id)).walletBalance,50);
});
test('complaint racing payout is either held or explicitly classified as a funded late claim',async()=>{
 await order();await recordProtectedDelivery('o',String(vendor._id),String(store._id));await expired();
 const [_,c]=await Promise.all([settleOrder('o'),openCase(actor(),request())]);const wallet=(await User.findById(vendor._id)).walletBalance;
 assert.ok((wallet===0&&!c.lateClaim)||(wallet===200&&c.lateClaim));
});
test('original-payment refund records proof without crediting the wallet',async()=>{
 await order();const c=await openCase(actor(),request({refundMethod:'original'}));await changeCase(admin,{orderId:'o',caseId:c.id,action:'waive_return',note:'Verified missing item',evidence:['https://example.com/proof.jpg']});
 // The manual path (a refund done outside the app) still requires proof to match the reference.
 await assert.rejects(changeCase(admin,{orderId:'o',caseId:c.id,action:'refund',note:'Refund',providerRefundReference:'refund-123'}),/settlement proof/);
 await changeCase(admin,{orderId:'o',caseId:c.id,action:'refund',note:'Provider confirmed settlement',providerRefundReference:'refund-123',evidence:['https://example.com/receipt.jpg']});
 assert.equal((await User.findById(buyer._id)).walletBalance,0);assert.equal(await WalletTransaction.countDocuments({reference:'provider-refund:refund-123'}),1);
 assert.ok((await Order.findOne({orderId:'o'})).afterSalesCases[0].evidence.includes('https://example.com/receipt.jpg'), 'Provider settlement proof must be retained');
});
test('replacement deadline resolves only after the new 48h window',async()=>{
 await order();const c=await openCase(actor(),request({kind:'replacement'}));await Order.updateOne({orderId:'o'},{$set:{'afterSalesCases.0.status':'replacement_clearance','afterSalesCases.0.deadline':new Date(Date.now()+3600000)}});
 await processAfterSalesDeadlines();assert.equal((await Order.findOne({orderId:'o'})).afterSalesCases[0].status,'replacement_clearance');
 await Order.updateOne({orderId:'o'},{$set:{'afterSalesCases.0.deadline':new Date(0)}});await processAfterSalesDeadlines();assert.equal((await Order.findOne({orderId:'o'})).afterSalesCases[0].status,'resolved');
});
test('earlier whole-order dispute migrates into held item cases without releasing funds',async()=>{
 await order();await Order.updateOne({orderId:'o'},{$set:{disputeStatus:'active',disputeRaisedAt:new Date(),customerDisputeDescription:'Item arrived damaged'}});await recordProtectedDelivery('o',String(vendor._id),String(store._id));await expired();await settleOrder('o');const o=await Order.findOne({orderId:'o'});assert.equal(o.disputeStatus,'migrated');assert.equal(o.afterSalesCases[0].status,'admin_review');assert.equal((await User.findById(vendor._id)).walletBalance,0);
});
test('out-of-stock replacement can become a return only after customer accepts refund alternative',async()=>{
 await order();const c=await openCase(actor(),request({kind:'replacement'}));await changeCase(admin,{orderId:'o',caseId:c.id,action:'offer_refund',note:'Replacement is unavailable; offering a refund'});let o=await Order.findOne({orderId:'o'});assert.equal(o.afterSalesCases[0].kind,'replacement');await changeCase(actor(),{orderId:'o',caseId:c.id,action:'accept_refund'});o=await Order.findOne({orderId:'o'});assert.equal(o.afterSalesCases[0].kind,'return');assert.equal(o.afterSalesCases[0].status,'admin_review');
});
test('shipping refund cannot exceed the recorded original delivery charge',async()=>{
 await order();const c=await openCase(actor(),request());await changeCase(admin,{orderId:'o',caseId:c.id,action:'waive_return',note:'Verified fault',evidence:['https://example.com/proof.jpg']});await Order.updateOne({orderId:'o'},{$set:{'afterSalesCases.0.fault':'vendor'}});await assert.rejects(changeCase(admin,{orderId:'o',caseId:c.id,action:'refund',note:'Refund',shippingRefundAmount:500,evidence:['https://example.com/proof.jpg']}),/delivery refund exceeds/);assert.equal((await User.findById(buyer._id)).walletBalance,0);
});
test('full return flow waits for paid logistics readiness, tracked delivery and inspection',async()=>{
 await order();const c=await openCase(actor(),request());const base={orderId:'o',caseId:c.id};
 await changeCase(admin,{...base,action:'approve_return',fault:'vendor',returnAddress:'Store address',logisticsAmount:2000,note:'Vendor supplied the wrong size'});
 await changeCase(actor(),{...base,action:'accept_arrangements'});
 assert.equal((await Order.findOne({orderId:'o'})).afterSalesCases[0].status,'awaiting_logistics');
 await assert.rejects(changeCase(actor(),{...base,action:'return_shipped',courier:'Courier',trackingNumber:'123'}),/not ready/);
 await changeCase(admin,{...base,action:'confirm_logistics',courier:'Courier',logisticsReference:'paid-123',note:'Vendor prepaid return and replacement logistics',evidence:['https://example.com/receipt.jpg']});
 await changeCase(actor(),{...base,action:'return_shipped',courier:'Courier',trackingNumber:'123'});
 await changeCase(admin,{...base,action:'verify_return',note:'Tracking delivered to the agreed store address',evidence:['https://example.com/delivery.jpg']});
 await changeCase({id:String(vendor._id),role:'vendor'},{...base,action:'inspect',inspection:'accepted',note:'Correct item and accessories returned in received condition'});
 await changeCase(admin,{...base,action:'refund',note:'Return verified; refund approved'});
 assert.equal((await User.findById(buyer._id)).walletBalance,107);assert.equal((await Order.findOne({orderId:'o'})).afterSalesCases[0].status,'refunded');
});

test('vendor response retains evidence and rejected actions cannot append evidence',async()=>{
 await order();const c=await openCase(actor(),request());const base={orderId:'o',caseId:c.id};
 await changeCase({id:String(vendor._id),role:'vendor'},{...base,action:'respond',note:'Packing evidence for review',evidence:['https://example.com/packing.jpg']});
 assert.deepEqual((await Order.findOne({orderId:'o'})).afterSalesCases[0].evidence,['https://example.com/packing.jpg']);
 await assert.rejects(changeCase(actor(),{...base,action:'refund',note:'Unauthorized',evidence:['https://example.com/invalid.jpg']}));
 assert.deepEqual((await Order.findOne({orderId:'o'})).afterSalesCases[0].evidence,['https://example.com/packing.jpg']);
});

// Exercise the real route handlers and database core; substitute only request auth,
// rate limiting, Next's response wrapper and external email delivery.
function afterSalesRoute() {
 const fs=require('fs'),path=require('path'),ts=require('typescript');
 const filename=path.resolve(__dirname,'../../app/api/after-sales/route.ts');
 const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const core=require('./build/after-sales');
 const dependencies={
  'next/server':{NextResponse:{json:(body,options={})=>({status:options.status||200,body})}},
  '@/lib/server-route-auth':{getSessionUserFromRequest:async request=>request.actor},
  '@/lib/models/Order':{Order},'@/lib/mongodb':async()=>{},
  '@/lib/after-sales':{...core,sendProtectionNotices:async()=>{}},
  '@/lib/after-sales-policy':policy,
  '@/lib/rate-limit':{enforceRateLimit:async()=>null}
 };
 const module={exports:{}};
 new Function('require','module','exports',compiled)(name=>{if(!(name in dependencies))throw new Error(`Unexpected dependency ${name}`);return dependencies[name]},module,module.exports);
 return module.exports;
}
function req(actor,body={},query='') {return {actor,json:async()=>body,nextUrl:new URL('https://test.invalid/api/after-sales'+query)}}
test('API rejects unauthenticated and non-admin access and scopes vendor order contents',async()=>{
 const route=afterSalesRoute();await order();
 assert.equal((await route.GET(req(null))).status,401);
 assert.equal((await route.POST(req(null))).status,401);
 assert.equal((await route.GET(req(actor(),{},'?mode=admin'))).status,403);
 assert.equal((await route.GET(req({id:'outsider',role:'customer'}))).body.orders.length,0);
 const other=new mongoose.Types.ObjectId().toString();
 await Order.updateOne({orderId:'o'},{$inc:{totalAmount:50},$push:{vendors:{vendorId:other,storeId:'other-store',total:50,items:[{title:'Private item',price:50,quantity:1}]}}});
 const view=await route.GET(req({id:String(vendor._id),role:'vendor'},{},'?mode=vendor'));
 assert.equal(view.status,200);assert.equal(view.body.orders[0].lines.length,1);assert.equal(view.body.orders[0].lines[0].vendorId,String(vendor._id));
});
test('API customer-to-admin return journey persists evidence and credits the wallet',async()=>{
 const route=afterSalesRoute();await order();
 const created=await route.POST(req(actor(),{action:'create',...request()}));assert.equal(created.status,200);
 const base={orderId:'o',caseId:created.body.case.id};
 const step=async(who,body)=>{const response=await route.POST(req(who,{...base,...body}));assert.equal(response.status,200,JSON.stringify(response.body));return response.body};
 await step({id:String(vendor._id),role:'vendor'},{action:'respond',note:'Wrong size confirmed',evidence:['https://example.com/packing.jpg']});
 await step(admin,{action:'approve_return',fault:'vendor',returnAddress:'Store return address',logisticsAmount:100,note:'Vendor pays return courier'});
 await step(actor(),{action:'accept_arrangements'});
 await step(admin,{action:'confirm_logistics',courier:'Test courier',logisticsReference:'paid-return',note:'Booking paid',evidence:['https://example.com/booking.jpg']});
 await step(actor(),{action:'return_shipped',courier:'Test courier',trackingNumber:'tracking'});
 await step(admin,{action:'verify_return',note:'Delivered to store',evidence:['https://example.com/delivered.jpg']});
 await step({id:String(vendor._id),role:'vendor'},{action:'inspect',inspection:'accepted',note:'Item and accessories checked'});
 await step(admin,{action:'refund',note:'Refund approved',evidence:['https://example.com/decision.jpg']});
 const listed=await route.GET(req(actor(),{},'?orderId=o'));
 assert.equal(listed.body.orders[0].cases[0].status,'refunded');assert.equal(listed.body.orders[0].cases[0].evidence.length,4);
 assert.equal((await User.findById(buyer._id)).walletBalance,107);
});
test('API listing survives an unreconcilable historical order instead of failing the whole page',async()=>{
 const route=afterSalesRoute();await order('good');
 // A leg whose recorded total is far above its item subtotal cannot be allocated safely.
 // Mutations must still fail closed on it; a listing must simply flag it and move on.
 await Order.create({orderId:'bad',customerId:String(buyer._id),totalAmount:9999,paymentStatus:'escrow',status:'delivered',vendors:[{vendorId:String(vendor._id),storeId:String(store._id),total:9999,items:[{title:'Old item',price:100,quantity:1}]}]});
 const listed=await route.GET(req(actor()));
 assert.equal(listed.status,200);
 const byId=Object.fromEntries(listed.body.orders.map(o=>[o.orderId,o]));
 assert.equal(byId.bad.needsReconciliation,true);assert.equal(byId.bad.lines.length,0);
 assert.equal(byId.good.needsReconciliation,false);assert.equal(byId.good.lines.length,1);
 await assert.rejects(openCase(actor(),request({orderId:'bad'})),/reconciliation/);
});
test('kobo rounding drift between leg total and item subtotal is tolerated and clamped; a real gap still fails closed',()=>{
 // 1.005 rounds to 100 kobo per item, but the float sum 2.01 rounds to 201 — one kobo over.
 const drift={totalAmount:2.01,vat:0,paymentStatus:'escrow',vendors:[{vendorId:'v',storeId:'s',total:2.01,items:[{title:'A',price:1.005,quantity:1},{title:'B',price:1.005,quantity:1}]}]};
 const lines=policy.initialLines(drift);
 assert.equal(lines.reduce((n,l)=>n+l.amountCents,0),200);
 const gap={...drift,vendors:[{...drift.vendors[0],total:2.10}]};
 assert.throws(()=>policy.initialLines(gap),/reconciliation/);
});

// ---- Automatic provider (Paystack) refunds --------------------------------------
// The real paystack-refund client is compiled; only the network is stubbed, so request
// building and response parsing are exercised. `paystack.calls` records every request.
process.env.PAYSTACK_SECRET_KEY='sk_test_isolated';
const paystack={calls:[],initiate:null,fetch:null};
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,init={})=>{
 const u=String(url);
 if(u.endsWith('/refund')&&init.method==='POST'){paystack.calls.push({kind:'initiate',body:JSON.parse(init.body)});return {json:async()=>paystack.initiate(JSON.parse(init.body))}}
 const m=u.match(/\/refund\/(\d+)$/);if(m){paystack.calls.push({kind:'fetch',id:Number(m[1])});return {json:async()=>paystack.fetch(Number(m[1]))}}
 return realFetch(url,init);
};
const okInitiate=(body)=>({status:true,data:{id:9001,status:'pending',amount:body.amount}});
beforeEach(()=>{paystack.calls.length=0;paystack.initiate=okInitiate;paystack.fetch=()=>({status:true,data:{id:9001,status:'pending',amount:10700}})});
// Drive a case to the point where an admin may finalize a refund (accepted inspection).
async function readyToRefund(extra={}){await order();await Order.updateOne({orderId:'o'},{$set:{paymentReference:'PSK_o'}});const c=await openCase(actor(),request({refundMethod:'original',...extra}));await changeCase(admin,{orderId:'o',caseId:c.id,action:'waive_return',note:'Verified defect',evidence:['https://example.com/proof.jpg']});return c;}
const decide=(c)=>changeCase(admin,{orderId:'o',caseId:c.id,action:'refund',note:'Refund approved'});
const caseNow=async(id)=>(await Order.findOne({orderId:'o'})).afterSalesCases.find(v=>v.id===id);

test('provider refund records intent, then requests exactly the item + tax from Paystack outside the transaction',async()=>{
 const c=await readyToRefund();
 const decided=await decide(c);
 assert.equal(decided.status,'refund_pending');assert.equal(paystack.calls.length,0,'no network call inside changeCase');
 const sent=await submitPendingProviderRefund('o',c.id);
 assert.equal(sent.refundId,9001);assert.equal(paystack.calls.length,1);
 assert.deepEqual({transaction:paystack.calls[0].body.transaction,amount:paystack.calls[0].body.amount},{transaction:'PSK_o',amount:10700});
 const after=await caseNow(c.id);const o=await Order.findOne({orderId:'o'});
 assert.equal(after.providerRefundId,9001);assert.equal(after.status,'refund_pending');
 assert.equal((await User.findById(buyer._id)).walletBalance,0,'customer not credited before provider confirms');
 assert.equal(o.protectionLines[0].refundedQuantity,0,'line not marked refunded before provider confirms');
 assert.equal((await settleOrder('o')).success,false,'vendor payout stays blocked while refund is pending');
 assert.equal(await submitPendingProviderRefund('o',c.id).then(r=>r.reason),'not_pending','second submit is a no-op');
 assert.equal(paystack.calls.length,1,'Paystack asked exactly once');
});
test('refund.processed finalizes the ledger once; duplicate deliveries and racing polls are no-ops',async()=>{
 const c=await readyToRefund();await decide(c);await submitPendingProviderRefund('o',c.id);
 const first=await applyProviderRefundOutcome(9001,'processed',{amountKobo:10700});
 assert.equal(first.reason,'refunded');
 const again=await applyProviderRefundOutcome(9001,'processed',{amountKobo:10700});
 assert.equal(again.reason,'already_refunded');
 const after=await caseNow(c.id);const o=await Order.findOne({orderId:'o'});
 assert.equal(after.status,'refunded');assert.equal(after.refundedCents,10700);assert.equal(after.pendingRefund,undefined);
 assert.equal(o.protectionLines[0].refundedQuantity,1);
 assert.equal(await WalletTransaction.countDocuments({reference:'provider-refund:9001'}),1);
 assert.equal((await User.findById(buyer._id)).walletBalance,0,'original-payment refund never touches the wallet');
});
test('refund.failed returns the case to review and reverses the vendor recovery debit',async()=>{
 await order();await Order.updateOne({orderId:'o'},{$set:{paymentReference:'PSK_o'}});
 await recordProtectedDelivery('o',String(vendor._id),String(store._id));await expired();await settleOrder('o');
 assert.equal((await User.findById(vendor._id)).walletBalance,200,'vendor was paid out');
 const c=await openCase(actor(),request({refundMethod:'original'}));
 await changeCase(admin,{orderId:'o',caseId:c.id,action:'waive_return',note:'Late defect',evidence:['https://example.com/proof.jpg']});
 await decide(c);
 assert.equal((await User.findById(vendor._id)).walletBalance,100,'recovery debited before asking Paystack');
 await submitPendingProviderRefund('o',c.id);
 const outcome=await applyProviderRefundOutcome(9001,'failed',{reason:'Insufficient balance'});
 assert.equal(outcome.reason,'failed');
 const after=await caseNow(c.id);
 assert.equal(after.status,'admin_review');assert.equal(after.pendingRefund,undefined);assert.equal(after.refundedAt,undefined);
 assert.equal((await User.findById(vendor._id)).walletBalance,200,'recovery reversed');
 assert.equal(await WalletTransaction.countDocuments({reference:`case-recovery:${c.id}:reversal`}),1);
});
test('a refund Paystack refuses at initiation reverts to review with vendor debits restored',async()=>{
 paystack.initiate=()=>({status:false,message:'Transaction cannot be refunded'});
 const c=await readyToRefund();await decide(c);
 const sent=await submitPendingProviderRefund('o',c.id);
 assert.equal(sent.success,false);
 const after=await caseNow(c.id);
 assert.equal(after.status,'admin_review');assert.equal(after.providerRefundId,undefined);assert.equal(after.pendingRefund,undefined);
 assert.match(after.history.at(-1).message,/did not accept/);
});
test('reconciler polls pending refunds, and escalates an unconfirmed intent without ever re-requesting it',async()=>{
 const c=await readyToRefund();await decide(c);await submitPendingProviderRefund('o',c.id);
 paystack.fetch=()=>({status:true,data:{id:9001,status:'processed',amount:10700}});
 let summary=await reconcilePendingProviderRefunds();
 assert.deepEqual({polled:summary.polled,settled:summary.settled},{polled:1,settled:1});
 assert.equal((await caseNow(c.id)).status,'refunded');
 // A second case whose intent was recorded but whose Paystack request never landed.
 await Order.create({orderId:'o2',customerId:String(buyer._id),totalAmount:107,vat:7,paymentStatus:'escrow',status:'delivered',paymentReference:'PSK_o2',vendors:[{vendorId:String(vendor._id),storeId:String(store._id),total:100,items:[{title:'Hat',price:100,quantity:1}]}]});
 const c2=await openCase(actor(),request({orderId:'o2',refundMethod:'original'}));
 await changeCase(admin,{orderId:'o2',caseId:c2.id,action:'waive_return',note:'Defect',evidence:['https://example.com/p.jpg']});
 await changeCase(admin,{orderId:'o2',caseId:c2.id,action:'refund',note:'Refund'});
 await Order.updateOne({orderId:'o2'},{$set:{'afterSalesCases.0.providerRefundIntentAt':new Date(Date.now()-60*60000)}});
 const before=paystack.calls.length;
 summary=await reconcilePendingProviderRefunds();
 assert.equal(summary.escalated,1);assert.equal(paystack.calls.length,before,'no initiate call for an unconfirmed intent');
 const stale=(await Order.findOne({orderId:'o2'})).afterSalesCases[0];
 assert.equal(stale.status,'admin_review');assert.match(stale.history.at(-1).message,/never confirmed/);
});
test('a case cannot be closed while a provider refund is in flight',async()=>{
 const c=await readyToRefund();await decide(c);
 await assert.rejects(changeCase(admin,{orderId:'o',caseId:c.id,action:'reject',note:'Closing'}),/in flight/);
 await assert.rejects(decide(c),/already in progress/);
});
function paystackWebhookRoute(){
 const fs=require('fs'),path=require('path'),ts=require('typescript');
 const compiled=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../app/api/webhooks/paystack/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const deps={'next/server':{NextResponse:{json:(body,o={})=>({status:o.status||200,body})}},crypto:require('crypto'),'@/lib/after-sales':require('./build/after-sales')};
 const module={exports:{}};new Function('require','module','exports',compiled)(n=>{if(!(n in deps))throw new Error(`Unexpected dependency ${n}`);return deps[n]},module,module.exports);return module.exports;
}
const signed=(payload,secret=process.env.PAYSTACK_SECRET_KEY)=>{const raw=JSON.stringify(payload);return {text:async()=>raw,headers:{get:h=>h==='x-paystack-signature'?require('crypto').createHmac('sha512',secret).update(raw).digest('hex'):null}}};
test('Paystack webhook verifies the signature and applies refund.processed exactly once',async()=>{
 const route=paystackWebhookRoute();const c=await readyToRefund();await decide(c);await submitPendingProviderRefund('o',c.id);
 const bad=signed({event:'refund.processed',data:{id:9001,amount:10700}},'sk_wrong');
 assert.equal((await route.POST(bad)).status,401);
 assert.equal((await route.POST(signed({event:'charge.success',data:{}}))).body.ignored,'charge.success');
 const ok=await route.POST(signed({event:'refund.processed',data:{id:9001,amount:10700}}));
 assert.equal(ok.status,200);assert.equal(ok.body.reason,'refunded');
 assert.equal((await route.POST(signed({event:'refund.processed',data:{id:9001,amount:10700}}))).body.reason,'already_refunded');
 assert.equal((await caseNow(c.id)).status,'refunded');
});
test('a settled amount that differs from what was requested is refused, leaving the case for review',async()=>{
 const route=paystackWebhookRoute();const c=await readyToRefund();await decide(c);await submitPendingProviderRefund('o',c.id);
 const res=await route.POST(signed({event:'refund.processed',data:{id:9001,amount:5000}}));
 assert.equal(res.status,500);assert.match(res.body.error,/review before closing/);
 assert.equal((await caseNow(c.id)).status,'refund_pending','untouched so the reconciler or an admin can look');
});
