"use strict";
const http = require("http");
const https = require("https");

function requestAny({ url, method, query, json, headers }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);

    if (query && typeof query === "object") {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        u.searchParams.set(k, String(v));
      }
    }

    const body = json !== undefined ? Buffer.from(JSON.stringify(json), "utf-8") : null;
    const mod = u.protocol === "https:" ? https : http;

    const req = mod.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + (u.search || ""),
        method,
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

module.exports = { requestAny };
