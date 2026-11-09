import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSubscription, purchaseSubscription, consumeImages, TERM_MS } from '../lib/payos/subscription.js';

const NOW = 1700000000000;
test('migration grants 50 images for 30 days once despite legacy VND balance', () => {
  for (const plan of ['plus', 'pro']) for (const credits of [0, 120000]) {
    const first = normalizeSubscription({ plan, credits }, NOW);
    assert.equal(first.changed, true);
    assert.equal(first.data.remainingImages, 50);
    assert.equal(first.data.planExpiresAt, NOW + TERM_MS);
    assert.equal(first.data.credits, credits);
    const second = normalizeSubscription(first.data, NOW + 1000);
    assert.equal(second.changed, false);
    assert.equal(second.data.remainingImages, 50);
  }
});
test('new purchase has fixed images and resets 30-day term', () => {
  const plus = purchaseSubscription({ credits: 0, plan: 'free' }, 'plus', NOW);
  assert.equal(plus.remainingImages, 100);
  assert.equal(plus.planExpiresAt, NOW + TERM_MS);
  assert.equal(purchaseSubscription({}, 'pro', NOW).remainingImages, 200);
  const upgrade = purchaseSubscription({ ...plus, remainingImages: 37 }, 'pro', NOW + 1000);
  assert.equal(upgrade.remainingImages, 237);
  assert.equal(upgrade.planExpiresAt, NOW + 1000 + TERM_MS);
  assert.equal(upgrade.credits, 0);
});
test('exhaustion and expiry return Free without migrating again', () => {
  const plus = { ...purchaseSubscription({}, 'plus', NOW), remainingVideoSeconds: 0 };
  assert.equal(consumeImages(plus, 100, NOW + 1).plan, 'free');
  assert.equal(consumeImages(plus, 101, NOW + 1), null);
  const expired = normalizeSubscription(plus, NOW + TERM_MS);
  assert.equal(expired.data.plan, 'free');
  assert.equal(expired.data.remainingImages, 0);
  assert.equal(normalizeSubscription(expired.data, NOW + TERM_MS + 1).changed, false);
  assert.equal(consumeImages(plus, 1, NOW + TERM_MS), null);
});
