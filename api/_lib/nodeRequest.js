const hopHeaders = new Set(['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'host', 'content-length', 'te', 'trailer']);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function toWebRequest(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null || hopHeaders.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) value.forEach(item => headers.append(key, item));
    else headers.set(key, String(value));
  }
  const method = req.method || 'GET';
  const init = { method, headers };
  if (method !== 'GET' && method !== 'HEAD') init.body = await readBody(req);
  return new Request(`${proto}://${host}${req.url || '/'}`, init);
}

export async function sendWebResponse(web, res) {
  res.statusCode = web.status;
  web.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'transfer-encoding') res.setHeader(key, value);
  });
  res.end(Buffer.from(await web.arrayBuffer()));
}
