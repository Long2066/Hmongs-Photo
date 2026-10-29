export const config = {
  maxDuration: 60,
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

  const { url } = req.query;
  if (!url || typeof url !== 'string') {
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

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body) {
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }
    }

    const targetResponse = await fetch(url, {
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
