/** CORS only for the locally-served desktop UI; the bearer token still verifies the user. */
export function paymentCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    let parsed;
    try { parsed = new URL(origin); } catch { res.status(403).end(); return true; }
    const localDesktop = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
    const sameOrigin = parsed.protocol === 'https:' && parsed.host === req.headers.host;
    // Optional public Firebase-hosted frontend; never accept an arbitrary HTTPS origin.
    const frontendOrigin = process.env.PAYOS_FRONTEND_ORIGIN;
    const hostedFrontend = frontendOrigin && parsed.origin === frontendOrigin;
    if ((!localDesktop && !sameOrigin && !hostedFrontend) || parsed.username || parsed.password ||
        (localDesktop && parsed.port && !/^\d{1,5}$/.test(parsed.port))) {
      res.status(403).end(); return true;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}
