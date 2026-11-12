// Design worksheet units. These are provisional exchange rates, not engine rules.
export const BALANCE_DEFAULTS=Object.freeze({revealChance:.8,coinsPerPoint:3,cardOption:1,actionOption:2,recoveryMovement:2});
export function effectPoints({move=0,deploy=0,recover=0,cash=0,capital=0,cards=0,actions=0,shares=0}={},rates={}){
 const r={...BALANCE_DEFAULTS,...rates};
 return move+deploy*r.revealChance*30/15+recover*r.recoveryMovement+cash/r.coinsPerPoint-10*capital/r.coinsPerPoint+cards*r.cardOption+actions*r.actionOption+shares*(r.shareOption??0);
}
// A tagged token can remain in the bag until a later reveal. No new funding is assumed.
export function revealChance({bag=20,draws=6,burn=0,rounds=3}={}){
 let survival=1,chance=0;
 for(let t=0;t<rounds&&bag>0;t++){
  const revealed=Math.min(draws,bag),burned=Math.min(burn,bag-revealed);
  chance+=survival*revealed/bag;survival*=1-(revealed+burned)/bag;bag-=revealed+burned;
 }
 return chance;
}
// Exact expectation over a uniformly shuffled company set, without founders or recovery cards.
export function expectedTokenMovement(profile){
 const counts=[profile[1],profile[2],profile[3],profile[4]],memo=new Map();
 function visit(c,down){
  const n=c.reduce((s,x)=>s+x,0);if(!n)return 0;
  const key=c.join(',')+':'+down;if(memo.has(key))return memo.get(key);
  let value=0;
  c.forEach((count,i)=>{if(!count)return;const next=[...c];next[i]--;value+=count/n*((down||i===3?0:i+1)+visit(next,down?false:i===3));});
  memo.set(key,value);return value;
 }
 return visit(counts,false);
}
export const CARD_EFFECTS=Object.freeze({
 recover:{move:1,recover:1},conflict:{move:-2,cash:5},inside:{deploy:1},move:{move:2},smear:{deploy:2,recover:-1},
 matching:{deploy:2,cash:-3},focused:{move:0},advice:{move:1,cash:3,cards:-1},
 financing:{move:2,deploy:1,capital:1},clearance:{cash:5},weekend:{actions:1},
 fresh:{cards:1},restructure:{move:-3,capital:-1},sweat:{move:-2,shares:1},
 consolidation:{shares:-1,capital:-1},dividend:{move:-2},mandate:{cash:-2},
});

// Conditional reference-state budgets, not fitted win-rate estimates.
export const REFERENCE_DEFAULTS=Object.freeze({
 revealChance:.8,coinsPerPoint:3,cardOption:1,actionOption:2,recoveryMovement:2,
 supplyChance:.65,tokenMovement:1.8137362637362637,chosenToken:2.5,expectedExit:60,payChance:.75,ownShares:2,issuedShares:4,
 otherOwnShares:1,otherIssuedShares:4,otherExit:80,control:2,founderUpgrade:2,
 retainedAccess:1,price:12,rounds:3,fundPrice:8,selfWin:.35,otherWin:.55,opportunityScale:1,
});
export function cardBudget(kind,options={}){
 const r={...REFERENCE_DEFAULTS,...options},k=r.coinsPerPoint,q=r.revealChance,mu=r.tokenMovement;
 const token=q*mu,supply=r.supplyChance*token,recovery=r.recoveryMovement;
 const own=r.ownShares,n=r.issuedShares,f=own/n,exit=r.expectedExit*r.payChance;
 const share=exit/n/k,control=r.control,upgrade=r.founderUpgrade;
 let parts;
 switch(kind){
 case 'recover':parts={movement:1,recovery};break;
 case 'inside':parts={returnedToBag:q*r.chosenToken};break;
 case 'move':parts={movement:2};break;
 case 'launch':parts={deployment:q*(mu+.4),information:.2};break;
 case 'smear':parts={deployment:2*token,fumble:-recovery};break;
 case 'advisor':parts={movement:1,returnedToSupply:2*supply};break;
 case 'conflict':parts={movement:-2,cash:5/k};break;
 case 'swap':parts={movement:3*(1-(r.otherOwnShares/r.otherIssuedShares)/f)};break;
 case 'headhunt':parts={founder:upgrade};break;
 case 'clearance':parts={cash:5/k,lostSupply:-2*supply};break;
 case 'consolidation':parts={capital:10/k,share:((own-1)/(n-1)-f)*exit/k,access:own===1?-r.retainedAccess:0};break;
 case 'session':parts={founder:upgrade,fumble:-recovery};break;
 case 'insurance':parts={recovery,fumble:-recovery*(r.otherOwnShares/r.otherIssuedShares)/f};break;
 case 'weekend':parts={actions:2*r.actionOption};break;
 case 'underwritten':case 'rights':case 'public':case 'tender':{
  const payment=r.fundPrice,deploy=Math.ceil(payment/4),other=r.otherWin,self=kind==='rights'?1-other:r.selfWin;
  const postSelf=(own+1)/(n+1),postOther=own/(n+1);
  parts={share:(self*(postSelf-f)+other*(postOther-f))*exit/k,payment:-self*payment/k,
   deployment:deploy*token*(self*postSelf+other*postOther)/f,
   control:self*.25*control};
  if(kind==='underwritten')parts.extraDeployment=other*2*token*postOther/f;
  // A common payment/winner distribution isolates format rules. Change it after timed playtests.
  break;
 }
 case 'mandate':parts={control,cash:-2/k};break;
 case 'coup':parts={control,fumble:-recovery};break;
 case 'matching':parts={deployment:2*token,cash:-3/k};break;
 case 'dividend':parts={movement:-2,cash:3*own/k};break;
 case 'stake':parts={share,payment:-r.price/k,control:.5*control};break;
 case 'focused':parts={backwardCost:-2,movement:2*(r.otherOwnShares/r.otherIssuedShares)/f};break;
 case 'advice':parts={movement:1,cash:3/k,card:-r.cardOption};break;
 case 'sweat':parts={movement:-2*((own+1)/(n+1))/f,share:((own+1)/(n+1)-f)*exit/k};break;
 case 'fresh':parts={card:r.cardOption};break;
 case 'restructure':parts={movement:-3,capital:10/k};break;
 case 'financing':parts={movement:2,deployment:token,capital:-10/k};break;
 case 'transfer':{
  const m=r.otherIssuedShares,h=r.otherOwnShares,otherExit=r.otherExit*r.payChance;
  parts={returnedShare:own>1?(((own-1)/(n-1))-f)*exit/k:-f*exit/k,
   addedShare:((h+1)/(m+1)-h/m)*otherExit/k,access:own===1?-r.retainedAccess:0,control:.25*control};break;
 }
 default:throw Error('Missing budget for '+kind);
 }
 const gross=Object.values(parts).reduce((s,x)=>s+x,0),net=gross-r.actionOption;
 return {gross,net,parts};
}
export function founderBudget(id,options={}){
 const r={...REFERENCE_DEFAULTS,...options},t=r.revealChance*r.tokenMovement,s=r.supplyChance*t,L=r.recoveryMovement,k=r.coinsPerPoint;
 // Expected activations PER remaining round in the declared reference state.
 const activations={0:1.5,1:.65,2:.5,3:1,4:1/r.rounds,5:1,6:.65,7:.6,8:1.3,9:.6,10:.4,11:.5,12:.5,13:1,14:1,15:.5,16:.5,17:1,19:.5,20:.4,21:1.5,22:.35,23:.6,24:.3,25:.3,26:.8};
 const effect={0:1,1:2-L,2:1.5,3:1.5,4:.15*(75-r.expectedExit)*r.ownShares/r.issuedShares/k,5:1,6:1+L*.5,7:2,8:1,9:L*.5+2*t,10:1+L*.5,11:2+L,12:1,13:1,14:t,15:1,16:2-2/k,17:1,19:1.5,20:2*t,21:s+.5,22:1.5*t,23:2+L,24:2+t,25:2,26:2-r.cardOption};
 if(!(id in effect))throw Error('Missing founder budget '+id);
 const uses=activations[id]*r.rounds*r.opportunityScale;
 return {perUse:effect[id],perRound:activations[id],uses,total:uses*effect[id]};
}
export function budgetStats(values){
 const a=[...values].sort((x,y)=>x-y),n=a.length,mean=a.reduce((s,x)=>s+x,0)/n;
 return {count:n,mean,median:n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2,min:a[0],max:a.at(-1),sd:Math.sqrt(a.reduce((s,x)=>s+(x-mean)**2,0)/n)};
}
