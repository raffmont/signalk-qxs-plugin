"use strict";
const fs = require("fs");
const path = require("path");

function getDataDir(app) {
  if (app && typeof app.getDataDirPath === "function") return app.getDataDirPath();
  return path.join(__dirname, "..", "..", "data");
}

function getStateFile(app) {
  const dir = path.join(getDataDir(app), "signalk-qxs001-plugin");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "state.json");
}

function loadState(app, def) {
  const f = getStateFile(app);
  try { return { ...def, ...JSON.parse(fs.readFileSync(f, "utf-8")) }; }
  catch (_) { return def; }
}

function saveState(app, state) {
  const f = getStateFile(app);
  fs.writeFileSync(f, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

module.exports = { loadState, saveState };
