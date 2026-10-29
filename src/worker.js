import { botCommand } from "./bots.js";
self.onmessage = ({ data }) => {
  dispatch(data);
};
async function dispatch(data){
  try {
    // The native bot API exists only on the local development server.
    // Public deployments calculate decisions inside this browser worker.
    let cmd;
    try{
      if(['localhost','127.0.0.1','[::1]'].includes(self.location.hostname)){
      const response=await fetch('/api/bot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game:data.game,id:data.id})});
      if(response.ok)cmd=(await response.json()).cmd;
      }
    }catch{}
    self.postMessage({
      ticket: data.ticket,
      cmd: cmd??botCommand(data.game, data.id, { samples: 24, policy: "adaptive" }),
    });
  } catch (e) {
    self.postMessage({ ticket: data.ticket, error: e.message });
  }
}
