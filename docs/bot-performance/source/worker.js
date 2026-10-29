import { botCommand } from "./bots.js";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      ticket: data.ticket,
      cmd: botCommand(data.game, data.id, { samples: 24, policy: "adaptive" }),
    });
  } catch (e) {
    self.postMessage({ ticket: data.ticket, error: e.message });
  }
};
