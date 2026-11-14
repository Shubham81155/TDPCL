#!/usr/bin/env node
// scripts/dev-smtp-sink.js
// Zero-dependency local SMTP capture server for development and tests.
//   SMTP  : SINK_SMTP_PORT (default 1025)  - accepts any mail, optional AUTH PLAIN/LOGIN (any credentials)
//   HTTP  : SINK_HTTP_PORT (default 8025)  - GET /messages, DELETE /messages, GET /health
// Nothing is ever relayed. Messages are kept in memory only.

const net = require('node:net');
const http = require('node:http');

// Decode quoted-printable (nodemailer uses it for long HTML lines).
const decodeQP = (s) =>
  s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

const parseMessage = (raw) => {
  const split = raw.search(/\r?\n\r?\n/);
  const headText = split === -1 ? raw : raw.slice(0, split);
  const bodyRaw = split === -1 ? '' : raw.slice(split).replace(/^\r?\n\r?\n/, '');
  const headers = {};
  headText.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach((line) => {
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).toLowerCase()] = line.slice(i + 1).trim();
  });
  const enc = (headers['content-transfer-encoding'] || '').toLowerCase();
  let body = bodyRaw;
  if (enc === 'quoted-printable') body = Buffer.from(decodeQP(bodyRaw), 'latin1').toString('utf8');
  else if (enc === 'base64') body = Buffer.from(bodyRaw.replace(/\s+/g, ''), 'base64').toString('utf8');
  return { headers, body };
};

const createSink = ({ smtpPort = 1025, httpPort = 8025, host = '127.0.0.1', log = () => {} } = {}) => {
  const messages = [];
  let nextId = 1;

  const sockets = new Set();
  const smtp = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('latin1');
    let buffer = '';
    let mode = 'command'; // command | data | auth-plain | auth-login-user | auth-login-pass
    let dataBuf = '';
    let envelope = { from: null, to: [] };
    const reply = (line) => socket.write(`${line}\r\n`);

    reply('220 dev-smtp-sink ESMTP ready');

    const handleCommand = (line) => {
      const upper = line.toUpperCase();
      if (upper.startsWith('EHLO')) {
        socket.write('250-dev-smtp-sink\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
      } else if (upper.startsWith('HELO')) {
        reply('250 dev-smtp-sink');
      } else if (upper.startsWith('AUTH PLAIN')) {
        if (line.length > 11) reply('235 2.7.0 Authentication successful');
        else { mode = 'auth-plain'; reply('334 '); }
      } else if (upper.startsWith('AUTH LOGIN')) {
        mode = 'auth-login-user';
        reply('334 VXNlcm5hbWU6');
      } else if (upper.startsWith('MAIL FROM:')) {
        envelope = { from: line.slice(10).trim().replace(/^<|>.*$/g, ''), to: [] };
        reply('250 OK');
      } else if (upper.startsWith('RCPT TO:')) {
        envelope.to.push(line.slice(8).trim().replace(/^<|>.*$/g, ''));
        reply('250 OK');
      } else if (upper === 'DATA') {
        mode = 'data';
        dataBuf = '';
        reply('354 End data with <CR><LF>.<CR><LF>');
      } else if (upper === 'RSET') {
        envelope = { from: null, to: [] };
        reply('250 OK');
      } else if (upper === 'NOOP') {
        reply('250 OK');
      } else if (upper === 'QUIT') {
        reply('221 Bye');
        socket.end();
      } else {
        reply('502 Command not implemented');
      }
    };

    const handleLine = (line) => {
      if (mode === 'data') {
        if (line === '.') {
          const raw = dataBuf;
          const { headers, body } = parseMessage(raw);
          const msg = {
            id: nextId++,
            receivedAt: new Date().toISOString(),
            from: envelope.from,
            to: envelope.to,
            subject: headers.subject || '',
            headers,
            body,
            raw,
          };
          messages.push(msg);
          log(`captured #${msg.id} to=${msg.to.join(',')} subject=${msg.subject}`);
          mode = 'command';
          envelope = { from: null, to: [] };
          reply('250 OK queued');
        } else {
          dataBuf += `${line.startsWith('..') ? line.slice(1) : line}\r\n`;
        }
      } else if (mode === 'auth-plain') {
        mode = 'command';
        reply('235 2.7.0 Authentication successful');
      } else if (mode === 'auth-login-user') {
        mode = 'auth-login-pass';
        reply('334 UGFzc3dvcmQ6');
      } else if (mode === 'auth-login-pass') {
        mode = 'command';
        reply('235 2.7.0 Authentication successful');
      } else {
        handleCommand(line);
      }
    };

    socket.on('data', (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        handleLine(line);
      }
    });
    socket.on('error', () => {});
  });

  const httpServer = http.createServer((req, res) => {
    const path = (req.url || '').split('?')[0];
    const json = (code, obj) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    if (path === '/messages' && req.method === 'GET') return json(200, messages);
    if (path === '/messages' && req.method === 'DELETE') {
      const n = messages.length;
      messages.length = 0;
      return json(200, { deleted: n });
    }
    if (path === '/health') return json(200, { ok: true, count: messages.length });
    return json(404, { error: 'not found' });
  });

  const listen = (server, port) =>
    new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.off('error', reject); resolve(); });
    });

  return {
    messages,
    smtp,
    http: httpServer,
    start: async () => { await listen(smtp, smtpPort); await listen(httpServer, httpPort); },
    stop: () =>
      new Promise((resolve) => {
        let pending = 2;
        const done = () => { if (--pending === 0) resolve(); };
        smtp.close(done);
        sockets.forEach((sk) => sk.destroy());
        httpServer.close(done);
        if (httpServer.closeAllConnections) httpServer.closeAllConnections();
      }),
  };
};

module.exports = { createSink, parseMessage };

if (require.main === module) {
  const smtpPort = parseInt(process.env.SINK_SMTP_PORT, 10) || 1025;
  const httpPort = parseInt(process.env.SINK_HTTP_PORT, 10) || 8025;
  const sink = createSink({ smtpPort, httpPort, log: (m) => console.log(`[sink] ${m}`) });
  sink.start().then(
    () => console.log(`[sink] SMTP on 127.0.0.1:${smtpPort}, HTTP (GET/DELETE /messages) on http://127.0.0.1:${httpPort}`),
    (err) => { console.error(`[sink] failed to start: ${err.message}`); process.exit(1); }
  );
  const quit = () => sink.stop().then(() => process.exit(0));
  process.on('SIGINT', quit);
  process.on('SIGTERM', quit);
}
