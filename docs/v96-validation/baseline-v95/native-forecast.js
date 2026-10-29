import {INVESTMENT_RISK_DISCOUNT} from './config.js';
// Optional local accelerator. Browsers and machines without a compiled addon
// retain the JavaScript implementation; no game state leaves this computer.
let addon=null,backend='auto',calls=0,fallbacks=0,coreMs=0,packingMs=0,decodingMs=0;
const inputs=new Map();
if(typeof process!=='undefined'&&process.versions?.node){
 const [{createRequire},{fileURLToPath,pathToFileURL},fs,{createHash}]=await Promise.all([import('node:module'),import('node:url'),import('node:fs'),import('node:crypto')]);
 const require=createRequire(import.meta.url),override=process.env.VESTS_NATIVE_ADDON;
 let loadedPath;
 for(const candidate of override?[override]:[fileURLToPath(new URL('../native/build/forecast.node',import.meta.url)),process.cwd()+'/native/build/forecast.node']){
  try{addon=require(candidate);loadedPath=candidate;break;}catch{}
 }
 if(addon?.protocol!==3)addon=null;
 if(addon&&!override)try{
  const meta=JSON.parse(fs.readFileSync(new URL('./build.json',pathToFileURL(loadedPath))));
  const hash=createHash('sha256');
  for(const name of ['bots.js','engine.js','racing.js','config.js','movement.js','ownership.js','native-forecast.js'])hash.update(name+'\0').update(fs.readFileSync(new URL(name,import.meta.url)));
  const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if(!meta.parityVerified||meta.engineHash!==hash.digest('hex')||meta.binaryHash!==digest(loadedPath)||meta.sourceHash!==digest(new URL('../forecast.rs',pathToFileURL(loadedPath))))addon=null;
 }catch{addon=null;}
}
export const nativeForecastAvailable=!!addon;
export function setNativeBackend(value){if(!['auto','native','js'].includes(value))throw Error('Choose auto, native or js forecast backend.');if(value==='native'&&!addon)throw Error('Build the native forecast addon first.');backend=value;}
export function nativeForecastStats(){return {available:!!addon,backend,calls,fallbacks,coreMs,packingMs,decodingMs};}
const signatures=['','add','swapCard','recover','recycle','swap','breakthrough'];
export function nativeRollouts(v,id,options,decks){
 if(backend==='js'||!addon)return null;
 const started=performance.now();
 const {samples,auctionOutcome,blindFounders,fundingDelay}=options,r=v.rules,N=v.companies.length,P=v.players.length;
 // Keep unusual experimental states on the authoritative JS path.
 const unsupported=reason=>{fallbacks++;if(backend==='native')throw Error('Unsupported native forecast: '+reason);return null;};
 if(N>8||P>6||samples>128||!Number.isInteger(v.cycle)||r.checkpoints.some(n=>!Number.isInteger(n)||n<1||n>24)||v.companies.some(c=>!Number.isInteger(c.position)))return unsupported('experimental dimensions');
 let packed=options.preparationKey&&inputs.get(options.preparationKey);
 const out=[],push=(...a)=>out.push(...a);
 const encodeCard=c=>{
  const match=/^g(\d+):(\d+)$/.exec(c?.id??'');
  if(!match||c.kind!=='growth'||signatures.indexOf(c.signature||'')<0||c.effect&&!['fumble','setback'].includes(c.effect))throw Error('Unsupported forecast card');
  push(Number(match[1])*100+Number(match[2]),c.company,c.printed,signatures.indexOf(c.signature||''),c.effect==='fumble'?1:c.effect==='setback'?2:0);
 };
 const encodeCards=a=>{push(a.length);for(const c of a)encodeCard(c);};
 const scalar=x=>Number(x??0);
 if(!packed)try{
  push(N,P,samples,v.leg,v.cycle,id,(v.cycle*1301+v.leg*10007+id*71+1)>>>0,v.auction?.company??-1,auctionOutcome?.winner??-1,auctionOutcome?.winner!=null?auctionOutcome.paid:0,fundingDelay,v.ipoCompany??-1,Number(!!v.poolWeightsAreUpperBounds),v.pileCount,Number(v.phase==='settle'),options.rate);
  push(r.maxCycles,r.shareLimit,r.payoutPlaces,Number(!!r.catchUp),r.burnPerRound,r.checkpointCount,r.revealsPerRound,...r.checkpoints,Number(r.exitCurve==='quadratic'),r.exitMultiplier??1,r.moneyScale??1,r.ipoValue??100,r.exitLinear??0,r.exitScale,r.wangExit,r.currencyUnit??1,Number(r.intelMode!=='off'),...r.projectPrices.flat());
  push(...v.players.map(p=>p.cash),...v.players.map(p=>Number(v.valueUsed?.includes(p.id))));
  for(const c of v.companies)push(Number(v.founderUsed?.includes(c.id)),Number(v.called?.includes(c.id)),v.poolWeights[c.id],v.settlement?.prices?.[c.id]??0);
  for(const c of v.companies){
   const d=decks[c.id];push(c.position,blindFounders?-1:c.founder,c.reserve,c.arrivalOrder??0,c.supplyCount,Number(!!c.down),Number(!!c.hiringFumble));
   push(...v.players.map(p=>c.tokens.filter(t=>t.owner===p.id).length),c.tokens.filter(t=>t.owner===null).length,...c.lastBuy,...c.forecastSlots);
   encodeCards(d.unseen);push(Number(!!d.note));encodeCards(d.note?.top??[]);if(d.note)encodeCard(d.note.bottom);
  }
  encodeCards(v.returningCards??[]);push(Number(options.sampler==='independent'),options.sampleStart??0,0);
  packed=Float64Array.from(out);
  if(options.preparationKey){inputs.set(options.preparationKey,packed);if(inputs.size>128)inputs.delete(inputs.keys().next().value);}
 }catch(error){return unsupported(error.message);}
 packed[packed.length-1]=options.sampleMask??0;
 packed[8]=auctionOutcome?.winner??-1;packed[9]=auctionOutcome?.winner!=null?auctionOutcome.paid:0;
 const packedAt=performance.now();packingMs+=packedAt-started;
 let raw;
 try{raw=addon.run(packed);}catch(error){if(backend==='native')throw error;fallbacks++;return null;}
 calls++;const ranAt=performance.now();coreMs+=ranAt-packedAt;
 const values=v.companies.map((c,company)=>{
  const roundsToExit=new Array(samples),futureSpending=v.players.map(()=>new Array(samples)),futureShares=v.players.map(()=>new Array(samples)),finalPrices=new Array(samples),endLegs=new Array(samples),legPrices=Array.from({length:3-v.leg},()=>new Array(samples));
  return {roundsToExit,futureSpending,futureShares,expectedFinalShares:0,finalPrices,endLegs,company,expected:0,risk:0,value:0,position:0,whole:0,prices:legPrices[0],legPrices,legMeans:[]};
 });
 let at=0,count=0;
 for(let sample=0;sample<samples;sample++){
 if(options.sampleMask&&!(options.sampleMask&(1<<sample)))continue;count++;
 for(let company=0;company<N;company++){
  const row=values[company];row.roundsToExit[sample]=raw[at++];row.position+=raw[at++];row.endLegs[sample]=raw[at++];row.whole+=raw[at++];row.expectedFinalShares+=raw[at++];row.finalPrices[sample]=raw[at++];
  for(let leg=0;leg<3;leg++){if(leg<row.legPrices.length)row.legPrices[leg][sample]=raw[at];at++;}
  for(let p=0;p<P;p++)row.futureSpending[p][sample]=raw[at++];for(let p=0;p<P;p++)row.futureShares[p][sample]=raw[at++];
 }
 }
 for(const row of values){
  row.position/=count;row.whole/=count;row.expectedFinalShares/=count;
  row.expected=row.finalPrices.reduce((s,n)=>s+n,0)/count;
  row.risk=Math.sqrt(row.finalPrices.reduce((s,n)=>s+(n-row.expected)**2,0)/count);
  row.value=Math.max(0,row.expected-INVESTMENT_RISK_DISCOUNT*row.risk);row.legMeans=row.legPrices.map(a=>a.reduce((s,n)=>s+n,0)/count);
 }

 decodingMs+=performance.now()-ranAt;return values;
}
