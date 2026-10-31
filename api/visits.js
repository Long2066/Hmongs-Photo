import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, increment } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAUFQb3vsZPVv6i5smRTeXJkVYZuJGoQZE",
  authDomain: "toolphoto-2025.firebaseapp.com",
  projectId: "toolphoto-2025",
  storageBucket: "toolphoto-2025.firebasestorage.app",
  messagingSenderId: "820992304466",
  appId: "1:820992304466:web:6400056a3bf60d747a868b"
};

let syncApp = null;
let syncDb = null;
let syncAuth = null;

async function getDb() {
  if (!syncDb) {
    const existing = getApps();
    syncApp = existing.find(a => a.name === 'serverVisitsWorker') || initializeApp(firebaseConfig, 'serverVisitsWorker');
    syncAuth = getAuth(syncApp);
    syncDb = getFirestore(syncApp);
    if (!syncAuth.currentUser) {
      await signInWithEmailAndPassword(syncAuth, 'guest_cloud_sync@toolphoto.vn', 'ToolPhotoCloud2025@');
    }
  }
  return syncDb;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = await getDb();
    const today = new Date().toISOString().split('T')[0];
    const visitRef = doc(db, 'userAccess', 'global_cloud_visits');

    if (req.method === 'POST' || req.query.record === '1') {
      const now = Date.now();
      const snap = await getDoc(visitRef);
      let totalVisits = 76;
      let todayVisits = 13;

      if (!snap.exists()) {
        await setDoc(visitRef, {
          totalVisits: 76,
          todayVisits: 13,
          lastDate: today,
          updatedAt: now
        });
      } else {
        const data = snap.data();
        const isNewDay = data.lastDate !== today;
        totalVisits = (data.totalVisits || 75) + 1;
        todayVisits = isNewDay ? 1 : (data.todayVisits || 12) + 1;

        await setDoc(visitRef, {
          totalVisits: increment(1),
          todayVisits: isNewDay ? 1 : increment(1),
          lastDate: today,
          updatedAt: now
        }, { merge: true });
      }

      return res.status(200).json({
        success: true,
        totalVisits,
        todayVisits,
        timestamp: now
      });
    }

    // Default GET: return current visit stats
    const snap = await getDoc(visitRef);
    const data = snap.exists() ? snap.data() : { totalVisits: 75, todayVisits: 12 };

    return res.status(200).json({
      success: true,
      totalVisits: data.totalVisits || 75,
      todayVisits: data.lastDate === today ? (data.todayVisits || 1) : 1,
      lastDate: data.lastDate || today
    });
  } catch (err) {
    console.error('Visits API error:', err);
    return res.status(500).json({
      error: 'Failed to process visit record',
      message: err.message
    });
  }
}
