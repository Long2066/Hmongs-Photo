export default async function handler(req, res) {
  try {
    const admin = (await import('firebase-admin')).default;
    const auth = admin.auth;
    const firestore = admin.firestore;
    res.status(200).json({ auth: typeof auth, firestore: typeof firestore });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
