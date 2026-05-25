/**
 * Proxies /api/* → BACKEND_URL (Railway Express).
 * Set BACKEND_URL in Vercel → Environment Variables.
 */
module.exports = async (req, res) => {
  const backend = process.env.BACKEND_URL?.replace(/\/$/, '');

  if (!backend) {
    res.status(502).json({ error: 'BACKEND_URL is not configured on Vercel' });
    return;
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const incoming = new URL(req.url || '/api', `${proto}://${host}`);
  const target = `${backend}${incoming.pathname}${incoming.search}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || key.toLowerCase() === 'host') {
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else {
      headers.set(key, value);
    }
  }

  const init = {
    method: req.method,
    headers,
  };

  if (req.method && req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
    if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
      init.body = req.body;
    } else {
      init.body = JSON.stringify(req.body);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    }
  }

  let upstream;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    console.error('[api proxy]', target, err);
    res.status(502).json({ error: 'Backend unreachable' });
    return;
  }

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') {
      return;
    }
    res.setHeader(key, value);
  });

  res.send(Buffer.from(await upstream.arrayBuffer()));
};
