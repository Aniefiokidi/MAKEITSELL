const fs = require('fs'), path = require('path'), ts = require('typescript');
fs.mkdirSync(path.join(__dirname, 'build/models'), { recursive: true });
const source = path.resolve(__dirname, '../../lib');
const actual = path.resolve(__dirname, '../../lib');
for (const name of ['after-sales.ts', 'after-sales-policy.ts', 'models/Order.ts', 'models/Store.ts', 'models/WalletTransaction.ts', 'models/Product.ts']) {
  const filename = fs.existsSync(path.join(source, name)) ? path.join(source,name) : path.join(actual,name);
  const result=ts.transpileModule(fs.readFileSync(filename,'utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:name,reportDiagnostics:true });
  const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error); if(errors.length) { console.error(errors);process.exit(1); }
  fs.writeFileSync(path.join(__dirname,'build',name.replace(/\.ts$/,'.js')), result.outputText);
}
fs.writeFileSync(path.join(__dirname,'build','mongodb.js'),'module.exports=async()=>{};');
fs.writeFileSync(path.join(__dirname,'build/models/User.js'),`const m=require('mongoose');exports.User=m.model('User',new m.Schema({walletBalance:{type:Number,default:0},earnedBalance:{type:Number,default:0}}));`);
console.log('Compiled isolated financial test build');

fs.mkdirSync(path.join(__dirname,'build/referral'),{recursive:true});fs.writeFileSync(path.join(__dirname,'build/referral/processReferral.js'),'exports.processVendorReferral=async()=>{};exports.processBuyerReferral=async()=>{};');
