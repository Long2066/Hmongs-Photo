import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, inMemoryPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// New Firebase Project: ToolPhoto 2025
const firebaseConfig = {
  apiKey: "AIzaSyAUFQb3vsZPVv6i5smRTeXJkVYZuJGoQZE",
  authDomain: "toolphoto-2025.firebaseapp.com",
  projectId: "toolphoto-2025",
  storageBucket: "toolphoto-2025.firebasestorage.app",
  messagingSenderId: "820992304466",
  appId: "1:820992304466:web:6400056a3bf60d747a868b",
  measurementId: "G-TDZCN54YD4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Initialize Auth
export const auth = getAuth(app);

// Use browserLocalPersistence so users stay logged in across page refreshes
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log("Auth persistence set to browserLocal (stays logged in)");
    })
    .catch((error) => {
      console.error("Error setting auth persistence:", error);
    });
}

export const db = getFirestore(app);
export { app, analytics };
