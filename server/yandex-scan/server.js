// Runs the same function on our own server (Timeweb): a plain HTTP server in front of index.js.
// nginx terminates HTTPS and passes requests here. Data lives on disk (DATA_DIR), not in the Yandex bucket.
// Env: PORT (default 8080), DATA_DIR, plus the same keys as the cloud function (APP_KEY, ADMIN_TOKEN, GIGACHAT_KEY…).
const http = require('http');
const { handler } = require('./index.js');

const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY = 12 * 1024 * 1024; // photos come as base64 JSON

http
  .createServer((req, res) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        res.writeHead(413).end();
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', async () => {
      if (res.writableEnded) return;
      const url = new URL(req.url, 'http://local');
      // The same event shape Yandex Cloud Functions passes to the handler.
      const event = {
        httpMethod: req.method,
        headers: req.headers,
        queryStringParameters: Object.fromEntries(url.searchParams),
        body: Buffer.concat(chunks).toString('utf8'),
        isBase64Encoded: false,
        // The caller's address for the per-address limits: nginx puts the real one into X-Real-IP.
        requestContext: { identity: { sourceIp: String(req.headers['x-real-ip'] || req.socket.remoteAddress || '') } },
      };
      try {
        // Storage calls need some token to run; on disk it is never sent anywhere.
        const out = await handler(event, { token: { access_token: 'disk' } });
        res.writeHead(out.statusCode || 200, out.headers || {});
        res.end(out.body ?? '');
      } catch (e) {
        console.log('server error', String(e).slice(0, 300));
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('{"error":"server"}');
      }
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log(`essola server on 127.0.0.1:${PORT}`));
