export const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
export const quantile=(a,p)=>[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*p)];
export function random(seed=12345){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
// Whole games are the independent clusters; investors in one game share one win.
export function ratio(rows){const e=rows.reduce((s,r)=>s+r[0],0),w=rows.reduce((s,r)=>s+r[1],0);return e?w/e:0;}
function influence(rows){const p=ratio(rows),e=mean(rows.map(r=>r[0]));return rows.map(([n,w])=>e?(w-p*n)/e:0);}
export function normalP(z){
 const x=Math.abs(z)/Math.SQRT2,t=1/(1+.3275911*x);
 return Math.min(1,Math.max(0,(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x)));
}
export function contrast(a,b,{iterations=5000,seed=12345}={}){
 if(a.length!==b.length||a.length<2)throw Error('Contrasts need matched game clusters.');
 if(!a.some(r=>r[0])||!b.some(r=>r[0]))return {estimate:null,se:null,p:1,ci:null};
 const estimate=ratio(a)-ratio(b),ia=influence(a),ib=influence(b),d=ia.map((x,i)=>x-ib[i]),m=mean(d),se=Math.sqrt(d.reduce((s,x)=>s+(x-m)**2,0)/(d.length-1)/d.length);
 const rng=random(seed),boot=[];
 for(let j=0;j<iterations;j++){let ae=0,aw=0,be=0,bw=0;for(let i=0;i<a.length;i++){const k=Math.floor(rng()*a.length);ae+=a[k][0];aw+=a[k][1];be+=b[k][0];bw+=b[k][1];}if(ae&&be)boot.push(aw/ae-bw/be);}
 return {estimate,se,p:se?normalP(estimate/se):estimate===0?1:0,ci:boot.length?[quantile(boot,.025),quantile(boot,.975)]:null};
}
export function interval(rows,{iterations=5000,seed=12345}={}){
 const rng=random(seed),boot=[];
 for(let j=0;j<iterations;j++){let e=0,w=0;for(let i=0;i<rows.length;i++){const k=Math.floor(rng()*rows.length);e+=rows[k][0];w+=rows[k][1];}if(e)boot.push(w/e);}
 return boot.length?[quantile(boot,.025),quantile(boot,.975)]:null;
}
export function holm(rows){
 const order=rows.map((r,i)=>({p:r.p,i})).sort((a,b)=>a.p-b.p),adjusted=new Array(rows.length);let previous=0;
 for(let j=0;j<order.length;j++){previous=Math.max(previous,Math.min(1,order[j].p*(order.length-j)));adjusted[order[j].i]=previous;}
 return rows.map((r,i)=>({...r,adjustedP:adjusted[i],significant:adjusted[i]<.05}));
}
export const win=(r,id)=>r.winners.includes(id)?1/r.winners.length:0;
export function founderClusters(runs,founder,mode='history'){
 return runs.map(r=>{
  if(mode==='initial'){const company=r.history.findIndex(ids=>ids[0]===founder);return [Number(company>=0),Number(company>=0&&r.ipo===company)];}
  const ids=r.everOwned.flatMap((companies,id)=>(mode==='concurrent'?r.concurrent[id].includes(founder):companies.some(c=>r.history[c].includes(founder)))?[id]:[]);
  return [ids.length,ids.reduce((s,id)=>s+win(r,id),0)];
 });
}
export function founderStats(runs,names){
 const rows=names.map((name,id)=>{const clusters=founderClusters(runs,id),without=clusters.map(([n,w],i)=>[runs[i].players-n,1-w]),observations=clusters.reduce((s,r)=>s+r[0],0),wins=clusters.reduce((s,r)=>s+r[1],0),test=contrast(clusters,without,{iterations:0});return {id,name,observations,wins,rate:ratio(clusters),without:ratio(without),coverage:wins/runs.length,concurrent:ratio(founderClusters(runs,id,'concurrent')),...test,associationDifference:test.estimate,ci:interval(clusters)};});
 return holm(rows).sort((a,b)=>b.rate-a.rate);
}
export function compareFounders(before,after,names){
 const old=new Map(before.map(r=>[r.seed,r])),matched=after.filter(r=>old.has(r.seed)).sort((a,b)=>a.seed-b.seed),base=matched.map(r=>old.get(r.seed));
 return holm(names.map((name,id)=>({id,name,games:matched.length,before:ratio(founderClusters(base,id)),after:ratio(founderClusters(matched,id)),...contrast(founderClusters(matched,id),founderClusters(base,id))})));
}
export function pairwiseFounderTests(runs,names,mode='history'){
 const clusters=names.map((_,id)=>founderClusters(runs,id,mode)),tests=[];
 for(let a=0;a<names.length;a++)for(let b=a+1;b<names.length;b++)tests.push({a,b,...contrast(clusters[a],clusters[b],{iterations:0})});
 return holm(tests);
}

// One mutually exclusive category per independent game; Monte Carlo multinomial null.
export function equalCategoryTest(counts,{iterations=20000,seed=12345}={}){
 if(counts.length<2||counts.some(n=>!Number.isInteger(n)||n<0)||!Number.isInteger(iterations)||iterations<1)throw Error('Invalid category test');
 const total=counts.reduce((s,n)=>s+n,0),expected=total/counts.length;
 if(!total)return{statistic:0,p:1,iterations};
 const statistic=a=>a.reduce((s,n)=>s+(n-expected)**2/expected,0),observed=statistic(counts),rng=random(seed);let extreme=0;
 for(let j=0;j<iterations;j++){const sample=counts.map(()=>0);for(let i=0;i<total;i++)sample[Math.floor(rng()*counts.length)]++;extreme+=+(statistic(sample)>=observed-1e-12);}
 return{statistic:observed,p:(extreme+1)/(iterations+1),iterations};
}
