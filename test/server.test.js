import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { makeServer } from "../server.js";
test("static server serves the current app, handles malformed URLs, and blocks traversal", async () => {
  const server = makeServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const request = (path, method = "GET") =>
    new Promise((resolve, reject) => {
      http
        .request(
          { hostname: "127.0.0.1", port: server.address().port, path, method },
          (res) => {
            let body = "";
            res.on("data", (x) => (body += x));
            res.on("end", () =>
              resolve({ status: res.statusCode, headers: res.headers, body }),
            );
          },
        )
        .on("error", reject)
        .end();
    });
  try {
    let r = await request("/");
    assert.equal(r.status, 200);
    assert.match(r.body, /src\/app.js/);
    assert.match(r.headers["content-type"], /html/);
    assert.equal((await request("/%ZZ")).status, 400);
    assert.equal((await request("/%2e%2e%2fpackage.json")).status, 403);
    assert.equal((await request("/not-present")).status, 404);
    assert.equal((await request("/", "POST")).status, 405);
    assert.equal((await request("/", "HEAD")).body, "");
    assert.equal((await request("/")).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
