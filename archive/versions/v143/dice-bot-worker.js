import {diceBot} from './live-dice-bots.js';
self.onmessage=({data})=>{try{self.postMessage({token:data.token,cmd:diceBot(data.view,data.id,data.policy)});}catch(error){self.postMessage({token:data.token,error:error.message});}};
