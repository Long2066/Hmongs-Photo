import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeJitteredBackoffMs,
  isTransientHttpOrNetworkError,
  parseConcurrencySetting,
  resolveEffectiveConcurrency,
  sleepWithAbort,
} from '../services/concurrencyService.ts';

test('parseConcurrencySetting accepts valid presets and falls back to auto', () => {
  assert.equal(parseConcurrencySetting('auto'), 'auto');
  assert.equal(parseConcurrencySetting(undefined), 'auto');
  assert.equal(parseConcurrencySetting('8'), 8);
  assert.equal(parseConcurrencySetting(10), 10);
  assert.equal(parseConcurrencySetting('99'), 'auto');
  assert.equal(parseConcurrencySetting('3'), 'auto');
});

test('resolveEffectiveConcurrency enables 8-10 parallel threads for multi-acc Muse & 9Router', () => {
  // Muse pool (8 accounts behind muse2api) -> 10 concurrent image & video threads when tasks >= 10
  assert.equal(
    resolveEffectiveConcurrency('image', 20, { modelId: 'muse-image', settingOverride: 'auto' }),
    10
  );
  assert.equal(
    resolveEffectiveConcurrency('video', 12, { modelId: 'muse/veo-3', settingOverride: 'auto' }),
    10
  );

  // 9Router gateway -> 10 concurrent image threads
  assert.equal(
    resolveEffectiveConcurrency('image', 15, { modelId: 'gpt-image-2.5', isNineRouter: true, settingOverride: 'auto' }),
    10
  );

  // Vivix / general gateways -> 8 concurrent threads
  assert.equal(
    resolveEffectiveConcurrency('video', 10, { modelId: 'veo_3_1-fast', settingOverride: 'auto' }),
    8
  );

  // Single-account Antigravity OAuth stays capped at 4 in auto mode
  assert.equal(
    resolveEffectiveConcurrency('image', 12, { modelId: 'gemini-3.1-flash-image', isAntigravity: true, settingOverride: 'auto' }),
    4
  );

  // Clamps to itemCount & explicit user override x2..x10
  assert.equal(
    resolveEffectiveConcurrency('image', 3, { modelId: 'muse-image', settingOverride: 10 }),
    3
  );
  assert.equal(
    resolveEffectiveConcurrency('image', 12, { modelId: 'gpt-image-2.5', settingOverride: 8 }),
    8
  );
});

test('isTransientHttpOrNetworkError distinguishes retryable throttling from permanent errors', () => {
  assert.equal(isTransientHttpOrNetworkError(429, 'Too Many Requests'), true);
  assert.equal(isTransientHttpOrNetworkError(502, 'Bad Gateway'), true);
  assert.equal(isTransientHttpOrNetworkError(503, 'Service Unavailable'), true);
  assert.equal(isTransientHttpOrNetworkError(undefined, 'Failed to fetch (ECONNRESET)'), true);
  assert.equal(isTransientHttpOrNetworkError(undefined, 'Gateway Timeout waiting for upstream'), true);

  assert.equal(isTransientHttpOrNetworkError(400, 'Bad Request'), false);
  assert.equal(isTransientHttpOrNetworkError(401, 'Unauthorized'), false);
  assert.equal(isTransientHttpOrNetworkError(undefined, 'Request blocked by content_policy'), false);
  assert.equal(isTransientHttpOrNetworkError(undefined, 'ABORTED by user'), false);
});

test('computeJitteredBackoffMs grows exponentially with bounded ceiling & jitter', () => {
  for (let i = 0; i < 10; i++) {
    const first = computeJitteredBackoffMs(0, 1500, 10000);
    assert.ok(first >= 1500 && first <= 1950);
    const high = computeJitteredBackoffMs(5, 1500, 10000);
    assert.ok(high >= 10000 && high <= 10000);
  }
});

test('sleepWithAbort rejects immediately when already aborted or during wait', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => sleepWithAbort(50, controller.signal), /ABORTED/);

  const midAbort = new AbortController();
  const promise = sleepWithAbort(5000, midAbort.signal);
  setTimeout(() => midAbort.abort(), 15);
  await assert.rejects(() => promise, /ABORTED/);
});
