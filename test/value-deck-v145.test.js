import test from 'node:test';import assert from 'node:assert/strict';
import {createDiceGame,diceCommand,diceObservation,currentPlayer,valueChoices,assertDiceGame,DICE_VALUES,FOUNDERS,shareLeader} from '../src/live-dice-engine.js';
import {diceBot} from '../src/live-dice-bots.js';import {simulateLiveDice} from '../scripts/live-dice-simulate.js';
const step=g=>{let id=currentPlayer(g),cmd=diceBot(diceObservation(g,id),id,'balanced',{supportPolicy:'legacy'});diceCommand(g,id,cmd);return cmd;};
function fixture(kind){const g=createDiceGame({seed:41});while(g.round===0)step(g);g.first=0;g.flowActor=3;g.active=0;g.queue=[0];g.phase='flowAction';
 for(const c of g.companies){c.position=10+c.id;c.down=false;c.hiringFumble=false;c.tokens.push({id:100+c.id,owner:0,paid:0});c.tokens.push({id:200+c.id,owner:1,paid:0});c.lastBuy[0]=++g.serial;}
 g.companies[g.dealRow[0].company].lastBuy[1]=++g.serial;g.companies[0].down=true;g.players[0].capital=1;g.players[0].capitalCalled=20;
 let cards=[...g.intelDeck,...g.players.flatMap(p=>p.intel)],wanted=cards.find(c=>c.kind===kind),index=g.players[0].intel.findIndex(c=>c.kind===kind);
 if(index<0){const owner=g.players.find(p=>p.intel.some(c=>c.kind===kind));if(owner){const j=owner.intel.findIndex(c=>c.kind===kind);[owner.intel[j],g.players[0].intel[0]]=[g.players[0].intel[0],owner.intel[j]];}else{const j=g.intelDeck.findIndex(c=>c.kind===kind);[g.intelDeck[j],g.players[0].intel[0]]=[g.players[0].intel[0],g.intelDeck[j]];}}
 assertDiceGame(g);return {g,card:g.players[0].intel.findIndex(c=>c.kind===kind)};
}
test('eight cards per company, players+2 companies, five-card row and finish-or-exhaustion ending',()=>{
 for(const players of [2,3,4]){const g=createDiceGame({seed:4102,players});assert.equal(g.dealCopies,8);assert.equal(g.companies.length,players+2);assert.equal(g.dealDeck.length+g.dealSpent.length,8*(players+2));assert.ok([...g.dealDeck,...g.dealSpent].every(c=>c.company<players+2));assert.ok(g.players.every(p=>p.intel.length===3));while(g.round===0)step(g);assert.equal(g.dealRow.length,5);}
 const g=simulateLiveDice({seed:4102,players:4,trace:true});assert.ok(g.ended);assert.equal(g.roundLimit,null);assert.ok(g.endReason==='finish'||g.endReason==='deckExhausted');
 assert.match(FOUNDERS[11].text,/move 1/);
});
test('every restored value has executable legal targets and preserves card/cash/deal conservation',()=>{
 for(const kind of DICE_VALUES){const {g,card}=fixture(kind);diceCommand(g,0,{type:'valueAction'});const choices=valueChoices(g,0).filter(c=>c.card===card);assert.ok(choices.length,kind+' has targets');const cmd=choices[0],before=g.players[0].intel.length;diceCommand(g,0,cmd);assertDiceGame(g);if(['mandate','coup'].includes(kind))assert.equal(shareLeader(g.companies[cmd.company]),0,kind+' changes leadership');
 for(let n=0;g.turnPart!=='funding'&&n<150;n++){step(g);assertDiceGame(g);}
 assert.equal(g.turnPart,'funding',kind+' finishes its support action');
 if(kind!=='weekend')assert.equal(g.players[0].intel.length,before+(kind==='fresh'?1:kind==='advice'?-1:0),kind+' replacement count');
 }
});
test('Working Weekend supplies two additional support actions and cannot repeat in a turn',()=>{
 const {g,card}=fixture('weekend');diceCommand(g,0,{type:'valueAction'});diceCommand(g,0,valueChoices(g,0).find(c=>c.card===card));diceCommand(g,0,{type:'continue'});assert.equal(g.phase,'flowAction');assert.equal(g.extraSupport,1);diceCommand(g,0,{type:'raiseMoney'});assert.equal(g.phase,'flowAction');assert.equal(g.extraSupport,0);diceCommand(g,0,{type:'passAction'});assert.equal(g.phase,'pickFlow');
});
test('row manipulation recycles actual cards and advisor puts the card at deck bottom',()=>{
 for(const kind of ['inside','clearance','advisor','underwritten']){const {g,card}=fixture(kind);diceCommand(g,0,{type:'valueAction'});const cmd=valueChoices(g,0).find(c=>c.card===card),row=structuredClone(g.dealRow),spent=structuredClone(g.dealSpent),deck=structuredClone(g.dealDeck);diceCommand(g,0,cmd);
 if(kind==='inside'){assert.equal(g.dealRow[cmd.deal].id,spent[cmd.spent].id);assert.equal(g.dealSpent[cmd.spent].id,row[cmd.deal].id);}
 if(kind==='clearance'){assert.equal(g.dealRow[cmd.deal].id,deck.at(-1).id);assert.equal(g.dealSpent.at(-1).id,row[cmd.deal].id);}
 if(kind==='advisor')assert.equal(g.dealDeck[0].id,spent[cmd.spent].id);
 if(kind==='underwritten')assert.equal(g.dealRow[cmd.deal].bonusDice,1);
 }
});
test('fixed card dice resolve immediately, including recovery, before Executive Hire fumbles',()=>{
 for(const kind of ['launch','smear','matching','financing']){const {g,card}=fixture(kind);diceCommand(g,0,{type:'valueAction'});const cmd=valueChoices(g,0).find(c=>c.card===card);g.companies[cmd.company].down=true;const n=g.log.length,rolls=g.metrics.rolls;diceCommand(g,0,cmd);while(g.phase!=='valueResult')step(g);
 const events=g.log.slice(n),die=events.find(e=>e.type==='die');assert.equal(die.kind,['launch','smear','financing'].includes(kind)?'mild':'bland');assert.equal(g.metrics.rolls,rolls+1);assert.ok(events.some(e=>e.type==='deferred'),'fumbled company discards its die');if(kind==='smear')assert.equal(g.companies[cmd.company].down,true);assert.equal(g.pendingGrowth.filter(e=>e.source===kind).length,0,'no deferred extra dice');
 }
});
test('Underwritten Round adds its die to the selected card, for either an auction or bank funding',()=>{
 for(const bank of [false,true]){const {g,card}=fixture('underwritten');diceCommand(g,0,{type:'valueAction'});const cmd=valueChoices(g,0).find(c=>c.card===card),company=cmd.company,dealId=g.dealRow[cmd.deal].id;diceCommand(g,0,cmd);while(g.phase!=='pickFlow')step(g);
 if(bank){const selected=g.dealRow.find(c=>c.id===dealId);g.dealRow=g.dealRow.filter(c=>c.id!==dealId);g.dealRow.push(selected);g.roundActed=[1,2,3];}
 const deal=bank?0:g.dealRow.findIndex(c=>c.id===dealId);diceCommand(g,0,{type:'call',deal,company:g.dealRow[deal].company});
 for(let n=0;n<100&&!g.pendingGrowth.some(e=>e.company===company&&e.dice?.length===3);n++)step(g);
 const entry=g.pendingGrowth.find(e=>e.company===company&&e.dice?.length===3);assert.ok(entry);if(bank)assert.equal(entry.bank,true);assert.equal(entry.dice.at(-1),'bland');
 }
});
test('Dan converts a fumble into exactly one space in v145',async()=>{
 const {resolveCard}=await import('../src/engine.js');const {g}=fixture('matching');
 let c=g.companies.find(c=>c.founder===11);if(!c){c=g.companies[0];const pool=g.founderMarket.includes(11)?g.founderMarket:g.founderSupply;const i=pool.indexOf(11);pool[i]=c.founder;c.founder=11;}c.position=10;c.down=false;c.hiringFumble=false;g.danUsed=[];
 resolveCard(g,{id:'dan-check',kind:'growth',company:c.id,printed:0,effect:'fumble'});
 assert.equal(c.position,11);assert.equal(c.down,false);assert.ok(g.danUsed.includes(c.id));
});
test('Convertible Notes draws two row cards; Board Coup discards its matching card without fumbling or dice',()=>{
 for(const kind of ['public','coup']){const {g,card}=fixture(kind);diceCommand(g,0,{type:'valueAction'});const cmd=valueChoices(g,0).find(c=>c.card===card),old=g.dealRow[cmd.deal],rowLength=g.dealRow.length,deckLength=g.dealDeck.length,auctions=g.auctionHistory.length,pending=g.pendingGrowth.length,down=g.companies[cmd.company].down;
 diceCommand(g,0,cmd);assert.ok(g.dealSpent.some(c=>c.id===old.id));assert.equal(g.dealRow.length,rowLength+(kind==='public'?1:-1));assert.equal(g.dealDeck.length,deckLength-(kind==='public'?2:0));assert.equal(g.auctionHistory.length,auctions);assert.equal(g.pendingGrowth.length,pending);if(kind==='coup'){assert.equal(shareLeader(g.companies[cmd.company]),0);assert.equal(g.companies[cmd.company].down,down);}
 }
});
