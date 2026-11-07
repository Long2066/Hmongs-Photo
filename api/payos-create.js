import { paymentCors } from '../lib/payos/cors.js';
import { randomInt } from 'node:crypto';
import { admin, authenticate, checkoutUrls, orderRef, payos, PLANS } from '../lib/payos/core.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (paymentCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await authenticate(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const plan = req.body?.planId;
  if (typeof plan !== 'string' || !Object.hasOwn(PLANS, plan)) return res.status(400).json({ error: 'Invalid planId' });
  try {
    const { db } = admin();
    const client = payos();
    const { returnUrl, cancelUrl } = checkoutUrls();
    const amount = PLANS[plan];
    // PayOS order codes must be unique. Reserve before contacting PayOS, never mark paid by client input.
    let orderCode, ref;
    for (let attempt = 0; attempt < 5; attempt++) {
      orderCode = randomInt(1_000_000_000_000, 9_000_000_000_000);
      ref = orderRef(db, orderCode);
      try {
        await ref.create({ orderCode, userId: user.uid, userName: user.name || '', userEmail: user.email || '',
          plan, amount, status: 'CREATING', createdAt: Date.now() });
        break;
      } catch (error) {
        if (error.code !== 6 && error.code !== 'already-exists') throw error;
        ref = null;
      }
    }
    if (!ref) throw new Error('Unable to reserve a unique order code');
    try {
      const link = await client.paymentRequests.create({ orderCode, amount, description: `IMG ${plan.toUpperCase()}`, returnUrl, cancelUrl });
      if (link.orderCode !== orderCode || link.amount !== amount || !link.paymentLinkId || !link.checkoutUrl ||
        !/^https:\/\/pay\.payos\.vn\//.test(link.checkoutUrl)) throw new Error('Invalid PayOS checkout response');
      await ref.update({ status: 'PENDING', paymentLinkId: link.paymentLinkId, checkoutUrl: link.checkoutUrl });
      return res.status(201).json({ orderCode, checkoutUrl: link.checkoutUrl });
    } catch (error) {
      // A remote link may exist even when this update fails; never return it without a bound local order.
      await ref.update({ status: 'FAILED', failedAt: Date.now() }).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error('[payos-create] Failed:', error);
    return res.status(502).json({ error: 'Unable to create checkout' });
  }
}

