import { admin, parseOrderCode, payos, verifiedOrderStatus } from '../lib/payos/core.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const client = payos();
    // SDK verifies PayOS HMAC signature; webhook data alone never triggers crediting.
    const data = await client.webhooks.verify(req.body);
    if (!req.body?.success || req.body.code !== '00' || data.code !== '00' ||
      !Number.isSafeInteger(data.amount) || data.amount <= 0 || data.currency !== 'VND') {
      return res.status(200).json({ success: true });
    }
    const orderCode = parseOrderCode(String(data.orderCode));
    if (!orderCode) return res.status(400).json({ error: 'Invalid orderCode' });
    const { db } = admin();
    const order = await db.collection('payosOrders').doc(String(orderCode)).get();
    if (!order.exists) return res.status(200).json({ success: true }); // PayOS registration/test webhook
    if (order.data().amount !== data.amount || order.data().paymentLinkId !== data.paymentLinkId) {
      return res.status(400).json({ error: 'Payment mismatch' });
    }
    // Query PayOS directly to verify link ID, order, exact amount and paid status.
    const result = await verifiedOrderStatus(db, client, orderCode);
    if (result?.status === 'PENDING') return res.status(503).json({ error: 'Payment not finalized' });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[payos-webhook] Verification failed:', error);
    return res.status(400).json({ error: 'Unable to verify webhook' });
  }
}

