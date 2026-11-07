export default async function handler(req, res) {
  const diag = {
    node: process.version,
    envKeys: Object.keys(process.env).filter(k => k.includes('PAYOS') || k.includes('FIREBASE')),
    steps: {}
  };

  try {
    const payosMod = await import('@payos/node');
    diag.steps.payosNode = 'OK';
  } catch (e) {
    diag.steps.payosNode = e.message;
  }

  try {
    const fbMod = await import('firebase-admin');
    diag.steps.firebaseAdmin = 'OK';
  } catch (e) {
    diag.steps.firebaseAdmin = e.message;
  }

  try {
    const coreMod = await import('../lib/payos/core.js');
    diag.steps.libCore = 'OK';
  } catch (e) {
    diag.steps.libCore = e.message;
  }

  res.status(200).json(diag);
}
