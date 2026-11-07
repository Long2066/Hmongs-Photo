export default async function handler(req, res) {
  const result = {};
  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
    const sa = JSON.parse(raw);
    
    if (!getApps().length) {
      initializeApp({ credential: cert(sa), projectId: sa.project_id });
    }
    
    const db = getFirestore();
    const snap = await db.collection('userAccess').doc('system_metrics').get();
    result.firestore = 'OK';
    result.docExists = snap.exists;
    result.data = snap.exists ? snap.data() : null;
  } catch (e) {
    result.error = e.message;
    result.stack = e.stack;
  }
  res.status(200).json(result);
}
