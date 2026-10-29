import { botCommand } from "./bots.js";
self.onmessage = ({ data }) => {
  dispatch(data);
};
async function dispatch(data){
  try {
    // Local Node hosts can use the compiled engine; static hosting retains JS.
    let cmd;
    try{
      const response=await fetch('/api/bot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game:data.game,id:data.id})});
      if(response.ok)cmd=(await response.json()).cmd;
    }catch{}
    self.postMessage({
      ticket: data.ticket,
      cmd: cmd??botCommand(data.game, data.id, { samples: 24, policy: "adaptive" }),
    });
  } catch (e) {
    self.postMessage({ ticket: data.ticket, error: e.message });
  }
}
