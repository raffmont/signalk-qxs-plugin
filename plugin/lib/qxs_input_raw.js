"use strict";
const fs = require("fs");
const EVENT_SIZE = 24;
const EV_KEY = 0x01;

function actionName(v) {
  if (v === 0) return "up";
  if (v === 1) return "down";
  if (v === 2) return "repeat";
  return "unknown";
}

const KEY_MAP = {
  28: "KEY_ENTER",
  103: "KEY_UP",
  105: "KEY_LEFT",
  106: "KEY_RIGHT",
  108: "KEY_DOWN",
  114: "KEY_VOLUMEDOWN",
  115: "KEY_VOLUMEUP",
  163: "KEY_NEXTSONG",
  164: "KEY_PLAYPAUSE",
  165: "KEY_PREVIOUSSONG",
};

function typeName(t) {
  if (t === EV_KEY) return "EV_KEY";
  return "EV_" + t;
}

function startReading(devPath, onEvent) {
  const fd = fs.openSync(devPath, "r");
  let stopped = false;
  const buf = Buffer.alloc(EVENT_SIZE);

  function loop() {
    if (stopped) return;
    fs.read(fd, buf, 0, EVENT_SIZE, null, (err, n) => {
      if (stopped) return;
      if (err) throw err;
      if (n !== EVENT_SIZE) return setImmediate(loop);

      const type = buf.readUInt16LE(16);
      const code = buf.readUInt16LE(18);
      const value = buf.readInt32LE(20);

      const evt = {
        type,
        typeName: typeName(type),
        code,
        codeName: KEY_MAP[code] || `KEY_${code}`,
        value,
        action: actionName(value),
      };

      try { onEvent(evt); } catch (_) {}
      setImmediate(loop);
    });
  }

  loop();

  return {
    stop: () => {
      stopped = true;
      try { fs.closeSync(fd); } catch (_) {}
    },
  };
}

module.exports = { startReading, KEY_MAP };
