// Historical scenarios retain their original currency and no catch-up movement.
// Current default rules are exercised explicitly in v50.test.js.
import * as current from './config.js';
export * from './config.js';
export const RULES={...current.RULES,currencyUnit:1,bridgeCost:3,conflictPayout:6,sellPayouts:[5,10,15],exitMultiplier:1,moneyScale:1,muraMinimum:5,wangExit:40,startingCash:40,obligation:46,projectPrices:[[1,3,6],[2,4,8],[3,5,10]],ipoValue:50,exitLinear:2.5,exitScale:5,purchaseBase:4,purchaseStep:4,hedgeFund:true,catchUp:false,burnPerRound:0};
export const companyValue=(growth,rules=RULES)=>current.companyValue(growth,rules);
export const fundingPrices=(leg,rules=RULES)=>current.fundingPrices(leg,rules);
export const minimumBid=(company,rules=RULES)=>current.minimumBid(company,rules);
export const fundedCards=(leg,payment,rules=RULES)=>current.fundedCards(leg,payment,rules);
export const fixedLP=(players,leg,rules=RULES)=>current.fixedLP(players,leg,rules);
export const settlementValue=(company,companies,rules=RULES)=>current.settlementValue(company,companies,rules);
