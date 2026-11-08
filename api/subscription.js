import { paymentCors } from '../lib/payos/cors.js';
import { admin, authenticate } from '../lib/payos/core.js';
import { consumeImages, normalizeSubscription } from '../lib/payos/subscription.js';

/** A verified Firebase identity may only read or consume its own entitlement. */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (paymentCors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await authenticate(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (req.method === 'POST' && (req.body?.action !== 'consume' || !Number.isSafeInteger(req.body?.count) || req.body.count < 1 || req.body.count > 200 || typeof req.body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.body.requestId))) {
    return res.status(400).json({ error: 'Invalid image request' });
  }
  try {
    const { db } = admin();
    const ref = db.collection('userCredits').doc(user.uid);
    const debitRef = req.method === 'POST' ? db.collection('subscriptionDebits').doc(`${user.uid}_${req.body.requestId}`) : null;
    const result = await db.runTransaction(async (tx) => {
      const debit = debitRef ? await tx.get(debitRef) : null;
      if (debit?.exists) {
        if (debit.data().count !== req.body.count) return { error: 'Request ID reused with different count' };
        return debit.data().result;
      }
      const snapshot = await tx.get(ref);
      const now = Date.now();
      const previous = snapshot.exists ? snapshot.data() : {};
      const { data: normalized, changed } = normalizeSubscription(previous, now);
      if (req.method === 'POST') {
        const updated = consumeImages(normalized, req.body.count, now);
        if (!updated) {
          if (changed) tx.set(ref, { ...normalized, userId: user.uid }, { merge: true });
          return { error: 'Insufficient active images', ...entitlement(normalized) };
        }
        tx.set(ref, { ...updated, userId: user.uid }, { merge: true });
        const result = entitlement(updated);
        tx.create(debitRef, { userId: user.uid, count: req.body.count, result, createdAt: now });
        return result;
      }
      if (changed) tx.set(ref, { ...normalized, userId: user.uid }, { merge: true });
      return entitlement(normalized);
    });
    return res.status(result.error ? 409 : 200).json(result);
  } catch (error) {
    console.error('[subscription] Entitlement transaction failed:', error);
    return res.status(502).json({ error: 'Unable to process subscription' });
  }
}

function entitlement(data) {
  return {
    plan: data.plan === 'plus' || data.plan === 'pro' ? data.plan : 'free',
    remainingImages: data.remainingImages || 0,
    planExpiresAt: data.planExpiresAt || null,
    planStartedAt: data.planStartedAt || null,
    planAllowanceImages: data.planAllowanceImages || 0,
  };
}
