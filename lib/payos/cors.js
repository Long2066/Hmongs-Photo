/** CORS for local desktop UI, Electron app, and authorized web frontends. */
export function paymentCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    let parsed;
    try { parsed = new URL(origin); } catch { res.status(403).end(); return true; }
    const localDesktop = (parsed.protocol === 'http:' || parsed.protocol === 'https:') && ['localhost', '127.0.0.1'].includes(parsed.hostname);
    const sameOrigin = parsed.protocol === 'https:' && parsed.host === req.headers.host;
    const allowedHosts = ['toolphoto-2025.web.app', 'toolphoto-2025.firebaseapp.com', 'vip-imagetools.vercel.app'];
    const isAllowedWeb = parsed.protocol === 'https:' && allowedHosts.includes(parsed.hostname);
    const frontendOrigin = process.env.PAYOS_FRONTEND_ORIGIN;
    const hostedFrontend = frontendOrigin && parsed.origin === frontendOrigin;
    if ((!localDesktop && !sameOrigin && !hostedFrontend && !isAllowedWeb) || parsed.username || parsed.password ||
        (localDesktop && parsed.port && !/^\d{1,5}$/.test(parsed.port))) {
      res.status(403).end(); return true;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}
