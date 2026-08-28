/**
 * Minimal RFC 6455 WebSocket server framing.
 *
 * Dependency-free on purpose: this repo ships no runtime dependencies, and the
 * gateway's socket handling is the load-bearing part of the product, so it is
 * worth being able to read all of it.
 *
 * Server-side only. Handles text frames, close, ping/pong, and fragmentation.
 * Payloads are capped — a host is untrusted and must not be able to make the
 * gateway allocate without bound.
 */
import { createHash } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 8 * 1024 * 1024;

export function accept(request, socket) {
  const key = request.headers['sec-websocket-key'];
  if (request.headers.upgrade?.toLowerCase() !== 'websocket' || !key) {
    socket.destroy();
    return null;
  }
  const digest = createHash('sha1').update(key + GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${digest}\r\n\r\n`,
  );
  socket.setNoDelay(true);
  return new WsConnection(socket);
}

export class WsConnection {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.fragments = [];
    this.fragmentOp = 0;
    this.closed = false;
    this.handlers = { message: [], close: [], pong: [] };
    socket.on('data', (chunk) => this.#feed(chunk));
    socket.on('close', () => this.#fire('close'));
    socket.on('error', () => this.close(1011, 'socket error'));
  }

  on(event, fn) { this.handlers[event]?.push(fn); return this; }
  #fire(event, ...args) { for (const fn of this.handlers[event] || []) fn(...args); }

  #feed(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    for (;;) {
      const frame = this.#readFrame();
      if (!frame) return;
      const { op, payload, fin } = frame;
      if (op === 0x8) { this.close(1000, 'peer closed'); return; }
      if (op === 0x9) { this.#send(0xA, payload); continue; }   // ping -> pong
      if (op === 0xA) { this.#fire('pong'); continue; }
      if (op === 0x0) {
        this.fragments.push(payload);
      } else {
        this.fragments = [payload];
        this.fragmentOp = op;
      }
      if (!fin) continue;
      const full = Buffer.concat(this.fragments);
      this.fragments = [];
      if (this.fragmentOp === 0x1) this.#fire('message', full.toString('utf8'));
    }
  }

  #readFrame() {
    const b = this.buf;
    if (b.length < 2) return null;
    const fin = (b[0] & 0x80) !== 0;
    const op = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) {
      if (b.length < off + 2) return null;
      len = b.readUInt16BE(off); off += 2;
    } else if (len === 127) {
      if (b.length < off + 8) return null;
      const big = b.readBigUInt64BE(off); off += 8;
      if (big > BigInt(MAX_PAYLOAD)) { this.close(1009, 'frame too large'); return null; }
      len = Number(big);
    }
    if (len > MAX_PAYLOAD) { this.close(1009, 'frame too large'); return null; }
    // A client MUST mask; refusing unmasked frames is required by the RFC.
    if (!masked) { this.close(1002, 'unmasked client frame'); return null; }
    if (b.length < off + 4 + len) return null;
    const mask = b.subarray(off, off + 4); off += 4;
    const payload = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) payload[i] = b[off + i] ^ mask[i & 3];
    this.buf = b.subarray(off + len);
    return { fin, op, payload };
  }

  #send(op, payload) {
    if (this.closed || this.socket.destroyed) return false;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | op, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | op; header[1] = 126; header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | op; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2);
    }
    return this.socket.write(Buffer.concat([header, payload]));
  }

  /** @returns {boolean} false when the kernel buffer is full (backpressure). */
  sendText(text) { return this.#send(0x1, Buffer.from(text, 'utf8')); }
  sendJson(obj) { return this.sendText(JSON.stringify(obj)); }
  ping() { return this.#send(0x9, Buffer.alloc(0)); }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    this.closed = true;
    try {
      const body = Buffer.alloc(2 + Buffer.byteLength(reason));
      body.writeUInt16BE(code, 0);
      body.write(reason, 2);
      this.#send(0x8, body);
    } catch { /* socket already gone */ }
    this.socket.end();
    this.#fire('close');
  }
}
