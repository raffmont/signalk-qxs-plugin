'use strict';
/**
 * Minimal raw evdev reader for Node.js (no native deps).
 * Parses struct input_event (16 bytes on 32-bit, 24 bytes on 64-bit).
 * Emits EV_KEY events: { code, value } where value: 1 down, 0 up, 2 hold.
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

function listEventNodes() {
  try {
    return fs.readdirSync('/dev/input')
      .filter((e) => e.startsWith('event'))
      .map((e) => path.join('/dev/input', e))
      .sort((a, b) => a.localeCompare(b, 'en'));
  } catch {
    return [];
  }
}

function parseEventsFromBuffer(buf, prefer64) {
  const tryStride = (stride) => {
    const out = [];
    const usableLen = Math.floor(buf.length / stride) * stride;
    for (let off = 0; off < usableLen; off += stride) {
      const typeOff = (stride === 24) ? off + 16 : off + 8;
      const type = buf.readUInt16LE(typeOff);
      const code = buf.readUInt16LE(typeOff + 2);
      const value = buf.readInt32LE(typeOff + 4);
      out.push({ type, code, value });
    }
    return { out, used: usableLen, stride };
  };

  const a = tryStride(prefer64 ? 24 : 16);
  const b = tryStride(prefer64 ? 16 : 24);

  // Choose the stride that yields more plausible events.
  const score = (events) => {
    if (!events.length) return 0;
    let smallType = 0, nonZero = 0;
    for (const e of events) {
      if (e.type <= 0x1f) smallType++;
      if (e.type !== 0 || e.code !== 0 || e.value !== 0) nonZero++;
    }
    return smallType + nonZero;
  };

  return score(a.out) >= score(b.out) ? a : b;
}

class EvdevKeyReader extends EventEmitter {
  constructor({ devicePath, prefer64 } = {}) {
    super();
    this.devicePath = devicePath;
    this.prefer64 = typeof prefer64 === 'boolean' ? prefer64 : (process.arch === 'arm64' || process.arch === 'x64');
    this._stream = null;
    this._pending = Buffer.alloc(0);
  }

  static listEventNodes() {
    return listEventNodes();
  }

  async sniffForKeyActivity(devicePath, seconds = 6) {
    return new Promise((resolve) => {
      let keyCount = 0;
      const stream = fs.createReadStream(devicePath, { flags: 'r' });
      let pending = Buffer.alloc(0);

      const timer = setTimeout(() => {
        stream.destroy();
        resolve(keyCount);
      }, Math.max(1, seconds) * 1000);

      stream.on('data', (chunk) => {
        pending = Buffer.concat([pending, chunk]);
        const parsed = parseEventsFromBuffer(pending, this.prefer64);
        pending = pending.subarray(parsed.used);
        for (const e of parsed.out) {
          if (e.type === 1) keyCount++; // EV_KEY
        }
      });

      stream.on('error', () => {
        clearTimeout(timer);
        resolve(0);
      });
      stream.on('close', () => {
        clearTimeout(timer);
        resolve(keyCount);
      });
    });
  }

  async autodetectDevice({ seconds = 6, minKeys = 1 } = {}) {
    const nodes = listEventNodes();
    let best = { path: null, count: 0 };
    for (const p of nodes) {
      // eslint-disable-next-line no-await-in-loop
      const c = await this.sniffForKeyActivity(p, seconds);
      if (c > best.count) best = { path: p, count: c };
    }
    if (best.count >= minKeys) return best.path;
    return null;
  }

  start() {
    if (!this.devicePath) throw new Error('devicePath not set');
    this.stop();

    this._pending = Buffer.alloc(0);
    this._stream = fs.createReadStream(this.devicePath, { flags: 'r' });

    this._stream.on('data', (chunk) => {
      this._pending = Buffer.concat([this._pending, chunk]);
      const parsed = parseEventsFromBuffer(this._pending, this.prefer64);
      this._pending = this._pending.subarray(parsed.used);

      for (const e of parsed.out) {
        if (e.type === 1) { // EV_KEY
          this.emit('key', { code: e.code, value: e.value });
        }
      }
    });

    this._stream.on('error', (err) => this.emit('error', err));
    this._stream.on('close', () => this.emit('close'));
  }

  stop() {
    if (this._stream) {
      try { this._stream.destroy(); } catch {}
      this._stream = null;
    }
  }
}

module.exports = { EvdevKeyReader };
