import { paymentCors } from '../lib/payos/cors.js';
﻿import { admin, authenticate, parseOrderCode, payos, verifiedOrderStatus } from '../lib/payos/core.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (paymentCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await authenticate(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const orderCode = parseOrderCode(req.query?.orderCode);
  if (!orderCode) return res.status(400).json({ error: 'Invalid orderCode' });
  try {
    const { db } = admin();
    const snapshot = await db.collection('payosOrders').doc(String(orderCode)).get();
    if (!snapshot.exists || snapshot.data().userId !== user.uid) return res.status(404).json({ error: 'Order not found' });
    const result = await verifiedOrderStatus(db, payos(), orderCode, user.uid);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[payos-status] Verification failed:', error);
    return res.status(502).json({ error: 'Unable to verify order status' });
  }
}

