import { getApps, initializeApp, cert } from 'firebase-admin/app';
import * as jose from 'jose';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { PayOS } from '@payos/node';

export const PLANS = Object.freeze({ plus: 50000, pro: 100000 });
export const orderRef = (db, orderCode) => db.collection('payosOrders').doc(String(orderCode));

export function admin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON missing');
  if (!getApps().length) {
    const serviceAccount = JSON.parse(raw);
    initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  return { db: getFirestore() };
}

export function payos() {
  const { PAYOS_CLIENT_ID: clientId, PAYOS_API_KEY: apiKey, PAYOS_CHECKSUM_KEY: checksumKey } = process.env;
  if (!clientId || !apiKey || !checksumKey) throw new Error('PayOS credentials missing');
  return new PayOS({ clientId, apiKey, checksumKey, logLevel: 'off' });
}

export async function authenticate(req) {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
  if (!match) return null;
  try {
    const token = match[1];
    const projectId = 'toolphoto-2025';
    if (!globalThis.__firebaseJwks) {
      globalThis.__firebaseJwks = jose.createRemoteJWKSet(
        new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
      );
    }
    const { payload } = await jose.jwtVerify(token, globalThis.__firebaseJwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    return {
      uid: payload.sub,
      email: payload.email || '',
      name: payload.name || payload.display_name || ''
    };
  } catch {
    return null;
  }
}

export function checkoutUrls() {
  const returnUrl = new URL(process.env.PAYOS_RETURN_URL);
  const cancelUrl = new URL(process.env.PAYOS_CANCEL_URL);
  if (returnUrl.protocol !== 'https:' || cancelUrl.protocol !== 'https:' || returnUrl.origin !== cancelUrl.origin || returnUrl.username || returnUrl.password || cancelUrl.username || cancelUrl.password) {
    throw new Error('PayOS return and cancel URLs must share a HTTPS origin');
  }
  return { returnUrl: returnUrl.href, cancelUrl: cancelUrl.href };
}

export function parseOrderCode(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,14}$/.test(value)) return null;
  const code = Number(value);
  return Number.isSafeInteger(code) ? code : null;
}

export function isVerifiedPayment(payment, order) {
  return payment?.status === 'PAID' && payment.orderCode === order.orderCode &&
    payment.id === order.paymentLinkId && Number.isSafeInteger(payment.amount) &&
    payment.amount === order.amount && Number.isSafeInteger(payment.amountPaid) &&
    payment.amountPaid >= order.amount;
}

/** A transaction owns both the credit increment and the paid marker; retries are no-ops. */
export async function creditPaidOrder(db, orderCode, payment) {
  const ref = orderRef(db, orderCode);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return { status: 'NOT_FOUND' };
    const order = snapshot.data();
    if (order.status === 'PAID') return { status: 'PAID' };
    if (order.status !== 'PENDING' || !isVerifiedPayment(payment, order)) return { status: order.status };
    const creditsRef = db.collection('userCredits').doc(order.userId);
    const balanceSnapshot = await tx.get(creditsRef);
    const oldBalance = balanceSnapshot.exists ? balanceSnapshot.data().credits : 0;
    if (!Number.isSafeInteger(oldBalance) || oldBalance < 0 || !Number.isSafeInteger(oldBalance + order.amount)) {
      throw new Error('Invalid stored credit balance');
    }
    const oldPlan = balanceSnapshot.exists ? balanceSnapshot.data().plan : undefined;
    const finalPlan = oldPlan === 'pro' && order.plan === 'plus' && oldBalance >= 500 ? 'pro' : order.plan;
    const now = Date.now();
    const newBalance = oldBalance + order.amount;
    tx.set(creditsRef, { userId: order.userId, credits: newBalance, plan: finalPlan, lastUpdated: now }, { merge: true });
    tx.update(ref, { status: 'PAID', paidAt: now, paymentReference: payment.transactions?.[0]?.reference || null });
    tx.set(db.collection('userAccess').doc('system_metrics'), { totalDeposited: FieldValue.increment(order.amount), lastUpdated: now }, { merge: true });
    tx.create(db.collection('approvedBills').doc(`PAYOS_${orderCode}`), {
      userId: order.userId, userName: order.userName || 'User', userEmail: order.userEmail || '',
      amount: order.amount, credits: order.amount, transferTime: new Date(now).toISOString(),
      content: `PayOS ${order.plan}`, senderName: 'PayOS Checkout', billHash: `PAYOS_${orderCode}`,
      timestamp: now, verificationStatus: 'approved', plan: finalPlan,
    });
    return { status: 'PAID', balance: newBalance, plan: finalPlan };
  });
}

export async function verifiedOrderStatus(db, client, orderCode, ownerUid) {
  const snapshot = await orderRef(db, orderCode).get();
  if (!snapshot.exists || (ownerUid && snapshot.data().userId !== ownerUid)) return null;
  const order = snapshot.data();
  if (order.status === 'PAID') {
    // Always recheck PayOS before disclosing PAID, even when Firestore already says paid.
    const payment = await client.paymentRequests.get(orderCode);
    if (!isVerifiedPayment(payment, order)) throw new Error('Paid order fails PayOS verification');
    const credits = await db.collection('userCredits').doc(order.userId).get();
    return { status: 'PAID', balance: credits.data()?.credits ?? 0, plan: credits.data()?.plan ?? order.plan };
  }
  if (order.status !== 'PENDING') return { status: order.status };
  const payment = await client.paymentRequests.get(orderCode);
  if (isVerifiedPayment(payment, order)) {
    const result = await creditPaidOrder(db, orderCode, payment);
    if (result.status === 'PAID' && result.balance === undefined) {
      const credits = await db.collection('userCredits').doc(order.userId).get();
      return { status: 'PAID', balance: credits.data()?.credits ?? 0, plan: credits.data()?.plan ?? order.plan };
    }
    return result;
  }
  return { status: ['CANCELLED', 'EXPIRED', 'FAILED'].includes(payment.status) ? payment.status : 'PENDING' };
}
