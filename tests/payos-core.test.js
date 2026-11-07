import test from 'node:test';
import assert from 'node:assert/strict';
import { PayOS } from '@payos/node';
import { creditPaidOrder, isVerifiedPayment, verifiedOrderStatus } from '../lib/payos/core.js';

const order = { orderCode: 12345, paymentLinkId: 'link-id', userId: 'user-a', amount: 50000, plan: 'plus', status: 'PENDING' };
const payment = { status: 'PAID', orderCode: 12345, id: 'link-id', amount: 50000, amountPaid: 50000 };
function fakeDb() {
  const docs = new Map([['payosOrders/12345', structuredClone(order)], ['userCredits/user-a', { credits: 10000, plan: 'plus' }]]);
  let commits = 0;
  const db = {
    collection(name) {
      return { doc(id) {
        const key = `${name}/${id}`;
        return { key, get: async () => ({ exists: docs.has(key), data: () => docs.get(key) }) };
      } };
    },
    async runTransaction(fn) {
      const writes = [];
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, payload, options) => writes.push(() => docs.set(ref.key, options?.merge ? { ...docs.get(ref.key), ...payload } : payload)),
        update: (ref, payload) => writes.push(() => docs.set(ref.key, { ...docs.get(ref.key), ...payload })),
        create: (ref, payload) => writes.push(() => { if (docs.has(ref.key)) throw new Error('duplicate'); docs.set(ref.key, payload); }),
      };
      const result = await fn(tx);
      for (const write of writes) write();
      commits += Number(writes.length > 0);
      return result;
    },
  };
  return { db, docs, get commits() { return commits; } };
}

test('PayOS SDK rejects tampered webhook signatures', async () => {
  const client = new PayOS({ clientId: 'test', apiKey: 'test', checksumKey: 'a-secret', logLevel: 'off' });
  const data = { orderCode: 12345, amount: 50000, code: '00' };
  const signature = await client.crypto.createSignatureFromObj(data, 'a-secret');
  assert.deepEqual(await client.webhooks.verify({ data, signature }), data);
  await assert.rejects(client.webhooks.verify({ data: { ...data, amount: 100000 }, signature }));
  await assert.rejects(client.webhooks.verify({ data, signature: 'bad' }));
});

test('payment validation requires matching identity and full exact amount', () => {
  assert.equal(isVerifiedPayment(payment, order), true);
  for (const bad of [{ id: 'other' }, { amount: 1000 }, { amountPaid: 49999 }, { orderCode: 99 }, { status: 'PENDING' }]) {
    assert.equal(isVerifiedPayment({ ...payment, ...bad }, order), false);
  }
});

test('duplicate delivery credits once in a transaction', async () => {
  const state = fakeDb();
  assert.deepEqual(await creditPaidOrder(state.db, 12345, payment), { status: 'PAID', balance: 60000, plan: 'plus' });
  assert.deepEqual(await creditPaidOrder(state.db, 12345, payment), { status: 'PAID' });
  assert.equal(state.docs.get('userCredits/user-a').credits, 60000);
  assert.equal(state.docs.get('approvedBills/PAYOS_12345').amount, 50000);
  assert.equal(state.commits, 1);
});

test('status denies non-owner before requesting PayOS', async () => {
  const state = fakeDb();
  const result = await verifiedOrderStatus(state.db, { paymentRequests: { get: () => { throw Error('must not request'); } } }, 12345, 'user-b');
  assert.equal(result, null);
});



test('status only reports PAID after authoritative payment verification and committed credit', async () => {
  const state = fakeDb();
  const client = { paymentRequests: { get: async () => payment } };
  assert.deepEqual(await verifiedOrderStatus(state.db, client, 12345, 'user-a'), { status: 'PAID', balance: 60000, plan: 'plus' });
  assert.deepEqual(await verifiedOrderStatus(state.db, client, 12345, 'user-a'), { status: 'PAID', balance: 60000, plan: 'plus' });
  assert.equal(state.commits, 1);
  await assert.rejects(verifiedOrderStatus(state.db, { paymentRequests: { get: async () => ({ ...payment, id: 'other' }) } }, 12345, 'user-a'));
});

test('pending mismatched link cannot credit', async () => {
  const state = fakeDb();
  const client = { paymentRequests: { get: async () => ({ ...payment, amountPaid: 49999 }) } };
  assert.deepEqual(await verifiedOrderStatus(state.db, client, 12345, 'user-a'), { status: 'PENDING' });
  assert.equal(state.commits, 0);
  assert.equal(state.docs.get('userCredits/user-a').credits, 10000);
});
