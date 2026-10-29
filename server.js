import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {botCommand,nativeForecastAvailable} from './src/bots.js';
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".ttf": "font/ttf",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".md": "text/plain; charset=utf-8",
};
export function makeServer(root = process.cwd()) {
  return http.createServer(async (req, res) => {
    if(req.method==='POST'&&req.url==='/api/bot'){
      const port=req.socket.localPort,hosts=[`localhost:${port}`,`127.0.0.1:${port}`];
      if(!hosts.includes(req.headers.host)||req.headers.origin&&!hosts.map(h=>'http://'+h).includes(req.headers.origin)){res.writeHead(403).end('Forbidden');return;}
      try{
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>512*1024){res.writeHead(413).end('Request too large');return;}}
        const {game,id}=JSON.parse(body),players=game?.players?.length;
        if(!Number.isInteger(id)||players<2||players>5||id<0||id>=players||game.playerId!==id||game.companies?.length!==players+2||game.rules?.maxCycles>36)throw Error('Invalid public bot observation');
        const cmd=botCommand(game,id,{samples:24,policy:'adaptive'});
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({cmd,accelerated:nativeForecastAvailable}));
      }catch{res.writeHead(400).end('Invalid bot observation');}
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    let file;
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      file = path.resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
    } catch {
      res.writeHead(400).end("Malformed URL");
      return;
    }
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const body = await readFile(file);
      res
        .writeHead(200, {
          "Content-Type":
            types[path.extname(file)] ?? "application/octet-stream",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        })
        .end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = makeServer();
  server.listen(Number(process.env.PORT ?? 5188), "127.0.0.1", () =>
    console.log(`Race to IPO → http://localhost:${server.address().port}`),
  );
}
