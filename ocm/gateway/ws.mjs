/**
 * Minimal RFC 6455 WebSocket server framing.
 *
 * Dependency-free on purpose: this repo ships no runtime dependencies, and the
 * gateway's socket handling is the load-bearing part of the product, so it is
 * worth being able to read all of it.
 *
 * Server-side only. Handles text frames, close, ping/pong, and fragmentation.
 * Payloads and complete fragmented messages are capped — a host is untrusted and
 * must not be able to make the gateway allocate without bound.
 */
import { createHash } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 8 * 1024 * 1024;

export function accept(request, socket) {
  const key = request.headers['sec-websocket-key'];
  const connection = String(request.headers.connection || '').toLowerCase()
    .split(',').map((part) => part.trim());
  if (request.headers.upgrade?.toLowerCase() !== 'websocket'
      || !connection.includes('upgrade') || !key) {
    socket.destroy();
    return null;
  }
  if (request.headers['sec-websocket-version'] !== '13') {
    socket.write('HTTP/1.1 426 Upgrade Required\r\nSec-WebSocket-Version: 13\r\n\r\n');
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
    this.fragmentBytes = 0;
    this.fragmentOp = null;
    this.closed = false;
    this.closeFired = false;
    this.handlers = { message: [], close: [], pong: [] };
    socket.on('data', (chunk) => this.#feed(chunk));
    socket.on('close', () => this.#fireClose());
    socket.on('error', () => this.close(1011, 'socket error'));
  }

  on(event, fn) { this.handlers[event]?.push(fn); return this; }
  #fire(event, ...args) { for (const fn of this.handlers[event] || []) fn(...args); }
  #fireClose() {
    if (this.closeFired) return;
    this.closeFired = true;
    this.#fire('close');
  }

  #resetFragments() {
    this.fragments = [];
    this.fragmentBytes = 0;
    this.fragmentOp = null;
  }

  #protocolError(reason) {
    this.#resetFragments();
    this.close(1002, reason);
  }

  #appendFragment(payload) {
    this.fragmentBytes += payload.length;
    if (this.fragmentBytes > MAX_PAYLOAD) {
      this.close(1009, 'message too large');
      return false;
    }
    this.fragments.push(payload);
    return true;
  }

  #deliver(op, payload) {
    if (op === 0x1) {
      this.#fire('message', payload.toString('utf8'));
      return;
    }
    // The provider protocol is JSON text only. Reject binary rather than silently
    // ignoring a frame the peer may believe was accepted.
    this.close(1003, 'binary messages are not supported');
  }

  #feed(chunk) {
    if (this.closed) return;
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    for (;;) {
      const frame = this.#readFrame();
      if (!frame || this.closed) return;
      const { op, payload, fin } = frame;

      const control = op >= 0x8;
      if (control) {
        if (!fin || payload.length > 125) {
          this.#protocolError('invalid control frame');
          return;
        }
        if (op === 0x8) { this.close(1000, 'peer closed'); return; }
        if (op === 0x9) { this.#send(0xA, payload); continue; }   // ping -> pong
        if (op === 0xA) { this.#fire('pong'); continue; }
        this.#protocolError('unknown control opcode');
        return;
      }

      if (op !== 0x0 && op !== 0x1 && op !== 0x2) {
        this.#protocolError('unknown data opcode');
        return;
      }

      if (op === 0x0) {
        if (this.fragmentOp === null) {
          this.#protocolError('continuation without a fragmented message');
          return;
        }
        if (!this.#appendFragment(payload)) return;
        if (!fin) continue;
        const full = Buffer.concat(this.fragments, this.fragmentBytes);
        const completedOp = this.fragmentOp;
        this.#resetFragments();
        this.#deliver(completedOp, full);
        continue;
      }

      if (this.fragmentOp !== null) {
        this.#protocolError('new data frame before fragmented message completed');
        return;
      }
      if (payload.length > MAX_PAYLOAD) {
        this.close(1009, 'message too large');
        return;
      }
      if (fin) {
        this.#deliver(op, payload);
      } else {
        this.fragmentOp = op;
        if (!this.#appendFragment(payload)) return;
      }
    }
  }

  #readFrame() {
    const b = this.buf;
    if (b.length < 2) return null;
    if ((b[0] & 0x70) !== 0) {
      this.#protocolError('extensions are not negotiated');
      return null;
    }
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
    if (!masked) { this.#protocolError('unmasked client frame'); return null; }
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
    if (len > MAX_PAYLOAD) return false;
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
    try {
      // `socket.write()` returning false means the bytes were accepted into Node's
      // buffer and the caller should wait for drain; it does NOT mean the message
      // failed. Reporting false here previously caused the gateway to retry a job
      // that had already been queued to the first provider.
      this.socket.write(Buffer.concat([header, payload]));
      return true;
    } catch {
      return false;
    }
  }

  /** True means accepted by the socket or its buffer; false means not sent. */
  sendText(text) { return this.#send(0x1, Buffer.from(text, 'utf8')); }
  sendJson(obj) { return this.sendText(JSON.stringify(obj)); }
  ping() { return this.#send(0x9, Buffer.alloc(0)); }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    try {
      const reasonBytes = Buffer.from(String(reason), 'utf8').subarray(0, 123);
      const body = Buffer.alloc(2 + reasonBytes.length);
      body.writeUInt16BE(code, 0);
      reasonBytes.copy(body, 2);
      // Send the close frame before setting `closed`; #send refuses after closure.
      this.#send(0x8, body);
    } catch { /* socket already gone */ }
    this.closed = true;
    this.socket.end();
    this.#fireClose();
  }
}
