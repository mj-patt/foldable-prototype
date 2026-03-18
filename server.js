/**
 * Foldable Prototype – WebSocket Relay Server
 * Start: node server.js
 * Serves static files from ./public on http://localhost:3003
 * WebSocket on ws://localhost:3003/ws
 */

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = 3003;
const PUBLIC = path.join(__dirname, "public");

// Shared state broadcast to all clients
let sharedState = {
  year: 1800,
  mode: "folded", // "folded" | "flat"
  angle: 90, // fold angle in degrees (90 = folded, 180 = flat)
  tilt1: 0, //for auto mode
  tilt2: 0, // for auto mode
  tiltEnabled: false,
};

// Active WebSocket clients
const clients = new Set();

function broadcast(msg, exclude = null) {
  const str = JSON.stringify(msg);
  for (const c of clients) {
    if (c !== exclude && c.readyState === "open") {
      wsSend(c, str);
    }
  }
}

// Minimal WebSocket server implementation (RFC 6455)
function wsHandshake(req, socket) {
  const key = req.headers["sec-websocket-key"];
  const accept = crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
}

function wsParseFrame(buf) {
  if (buf.length < 2) return null;
  const b0 = buf[0],
    b1 = buf[1];
  const fin = (b0 & 0x80) !== 0;
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) !== 0;
  let payloadLen = b1 & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }

  if (masked) {
    if (buf.length < offset + 4 + payloadLen) return null;
    const mask = buf.slice(offset, offset + 4);
    offset += 4;
    const payload = Buffer.alloc(payloadLen);
    for (let i = 0; i < payloadLen; i++) {
      payload[i] = buf[offset + i] ^ mask[i % 4];
    }
    return { fin, opcode, payload, total: offset + payloadLen };
  } else {
    if (buf.length < offset + payloadLen) return null;
    return {
      fin,
      opcode,
      payload: buf.slice(offset, offset + payloadLen),
      total: offset + payloadLen,
    };
  }
}

function wsSend(socket, text) {
  if (!socket || socket.destroyed) return;
  const payload = Buffer.from(text, "utf8");
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  try {
    socket.write(Buffer.concat([header, payload]));
  } catch (_) {}
}

function wsClose(socket) {
  try {
    socket.write(Buffer.from([0x88, 0x00]));
    socket.end();
  } catch (_) {}
}

// HTTP + WS server
const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  let filePath = path.join(PUBLIC, pathname === "/" ? "index.html" : pathname);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found: " + req.url);
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    res.end(data);
  });
});

server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/ws") {
    socket.destroy();
    return;
  }

  wsHandshake(req, socket);
  socket.readyState = "open";
  clients.add(socket);
  console.log(`[WS] Client connected (total: ${clients.size})`);

  // Send current state to new client
  wsSend(socket, JSON.stringify({ type: "state", ...sharedState }));

  let buffer = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const frame = wsParseFrame(buffer);
      if (!frame) break;
      buffer = buffer.slice(frame.total);

      if (frame.opcode === 0x8) {
        wsClose(socket);
        return;
      } // close
      if (frame.opcode === 0x9) {
        // ping -> pong
        socket.write(Buffer.from([0x8a, 0x00]));
        continue;
      }
      if (frame.opcode === 0x1 || frame.opcode === 0x2) {
        const text = frame.payload.toString("utf8");
        try {
          const msg = JSON.parse(text);
          handleMessage(socket, msg);
        } catch (e) {
          console.error("[WS] Bad JSON:", text);
        }
      }
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
    socket.readyState = "closed";
    console.log(`[WS] Client disconnected (total: ${clients.size})`);
  });

  socket.on("error", (e) => {
    clients.delete(socket);
    socket.readyState = "closed";
  });
});

function handleMessage(socket, msg) {
  switch (msg.type) {
    case "setYear":
      sharedState.year = Math.max(1800, Math.min(2023, msg.year));
      broadcast({ type: "year", year: sharedState.year });
      break;

    case "setMode":
      sharedState.mode = msg.mode;
      sharedState.angle = msg.angle ?? (msg.mode === "flat" ? 180 : 90);
      broadcast({
        type: "mode",
        mode: sharedState.mode,
        angle: sharedState.angle,
      });
      break;

    case "setAngle":
      sharedState.angle = msg.angle;
      broadcast({ type: "angle", angle: sharedState.angle });
      break;

    case "getState":
      wsSend(socket, JSON.stringify({ type: "state", ...sharedState }));
      break;

    case "setTiltEnabled":
      sharedState.tiltEnabled = !!msg.enabled;
      broadcast({ type: "setTiltEnabled", enabled: sharedState.tiltEnabled });
      if (sharedState.tiltEnabled) {
        sharedState.angle = 180;
        broadcast({ type: "angle", angle: 180 });
      }
      break;

    case "setTilt": {
      if (!sharedState.tiltEnabled) break;
      if (msg.screen === 1) sharedState.tilt1 = msg.gamma;
      if (msg.screen === 2) sharedState.tilt2 = msg.gamma;

      const g1 = sharedState.tilt1;
      const g2 = sharedState.tilt2;

      // foldAngle = 180 - g1 + g2
      // e.g. g1=50, g2=0 → 130°   g1=50, g2=-30 → 100°
      const foldAngle = Math.round(Math.max(0, Math.min(180, 180 - g1 + g2)));
      sharedState.angle = foldAngle;
      broadcast({ type: "angle", angle: foldAngle, tilt1: g1, tilt2: g2 });
      break;
    }
  }
}

server.listen(PORT, () => {
  console.log(`\n  Foldable Prototype Server`);
  console.log(`  ─────────────────────────`);
  console.log(`  http://localhost:${PORT}/screen1.html  Phone 1 (scatterplot)`);
  console.log(
    `  http://localhost:${PORT}/screen2.html  Phone 2 (control / right half)`
  );
  console.log(
    `  http://localhost:${PORT}/wizard.html   wizard of oz control\n`
  );
});
