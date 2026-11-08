export const TERM_MS = 30 * 24 * 60 * 60 * 1000;
export const ALLOWANCE = Object.freeze({ plus: 100, pro: 200 });

const paid = (plan) => plan === 'plus' || plan === 'pro';
const validImages = (images) => Number.isSafeInteger(images) && images >= 0;

/** Migrate legacy paid accounts once, independent of their prior monetary balance. */
export function normalizeSubscription(data, now) {
  const current = { ...data };
  if (!paid(current.plan)) return { data: current, changed: false };
  if (!current.planMigratedAt) {
    current.remainingImages = 50;
    current.planStartedAt = now;
    current.planExpiresAt = now + TERM_MS;
    current.planAllowanceImages = 50;
    current.planMigratedAt = now;
    current.lastUpdated = now;
    return { data: current, changed: true };
  }
  if (!validImages(current.remainingImages) || !Number.isSafeInteger(current.planExpiresAt)) {
    throw new Error('Invalid stored subscription entitlement');
  }
  if (current.planExpiresAt <= now || current.remainingImages === 0) {
    current.plan = 'free';
    current.remainingImages = 0;
    current.lastUpdated = now;
    return { data: current, changed: true };
  }
  return { data: current, changed: false };
}

/** Only an active Plus -> Pro purchase carries leftover images. All other purchases start a new allotment. */
export function purchaseSubscription(data, purchasedPlan, now) {
  if (!paid(purchasedPlan)) throw new Error('Invalid plan');
  const { data: existing } = normalizeSubscription(data, now);
  const carryPlus = existing.plan === 'plus' && purchasedPlan === 'pro' ? existing.remainingImages : 0;
  // Preserve Pro status on a smaller top-up; never silently downgrade an active Pro purchase.
  const proTopUp = existing.plan === 'pro' && purchasedPlan === 'plus';
  const finalPlan = proTopUp ? 'pro' : purchasedPlan;
  const images = ALLOWANCE[purchasedPlan] + (proTopUp ? existing.remainingImages : carryPlus);
  if (!validImages(images)) throw new Error('Invalid image allowance');
  return {
    ...existing,
    plan: finalPlan,
    remainingImages: images,
    planAllowanceImages: images,
    planStartedAt: now,
    planExpiresAt: now + TERM_MS,
    planMigratedAt: existing.planMigratedAt || now,
    lastUpdated: now,
  };
}

export function consumeImages(data, count, now) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 200) throw new Error('Invalid image count');
  const { data: current } = normalizeSubscription(data, now);
  if (!paid(current.plan) || current.remainingImages < count) return null;
  const remainingImages = current.remainingImages - count;
  return {
    ...current,
    remainingImages,
    plan: remainingImages === 0 ? 'free' : current.plan,
    lastUpdated: now,
  };
}
