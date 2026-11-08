export const config = {
  maxDuration: 60,
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Set CORS headers so browser can access this proxy function
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let targetUrl = req.query.url;
  if (typeof req.url === 'string' && req.url.includes('?url=')) {
    const rawTarget = req.url.substring(req.url.indexOf('?url=') + 5);
    try {
      targetUrl = decodeURIComponent(rawTarget);
    } catch {
      targetUrl = rawTarget;
    }
  }

  if (!targetUrl || typeof targetUrl !== 'string') {
    res.status(400).json({ error: 'Missing target url parameter' });
    return;
  }

  try {
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (!['host', 'origin', 'referer', 'connection', 'content-length'].includes(lower) && typeof value === 'string') {
        forwardHeaders[key] = value;
      }
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = (req.method !== 'GET' && req.method !== 'HEAD' && chunks.length > 0)
      ? Buffer.concat(chunks)
      : undefined;

    const targetResponse = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body
    });

    res.status(targetResponse.status);

    targetResponse.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (!['transfer-encoding', 'content-encoding', 'content-length', 'access-control-allow-origin'].includes(lower)) {
        res.setHeader(key, val);
      }
    });

    const data = await targetResponse.arrayBuffer();
    res.send(Buffer.from(data));
  } catch (error) {
    console.error('Vercel CORS Proxy Error:', error);
    res.status(502).json({ error: error?.message || 'Proxy Error' });
  }
}
