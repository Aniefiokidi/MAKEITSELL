const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { Order } = require('./build/models/Order');
const { User } = require('./build/models/User');
const { Store } = require('./build/models/Store');
const { WalletTransaction } = require('./build/models/WalletTransaction');
const { Product } = require('./build/models/Product');

const { openCase, changeCase, settleOrder, recordProtectedDelivery, processAfterSalesDeadlines } = require('./build/after-sales');
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
 await assert.rejects(changeCase(admin,{orderId:'o',caseId:c.id,action:'refund',note:'Refund'}),/provider reference/);
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
