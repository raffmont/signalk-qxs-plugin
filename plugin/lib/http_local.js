"use strict";
const http = require("http");

function requestLocal({ port, method, path, json, headers }) {
  return new Promise((resolve, reject) => {
    const body = json !== undefined ? Buffer.from(JSON.stringify(json), "utf-8") : null;

    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          ...(headers || {}),
          ...(body ? { "Content-Type": "application/json", "Content-Length": body.length } : {}),
        },
      },
      (res) => {
        let chunks = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (chunks += d));
        res.on("end", () => {
          let bodyJson = null;
          try { bodyJson = JSON.parse(chunks); } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, bodyText: chunks, bodyJson });
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = { requestLocal };
