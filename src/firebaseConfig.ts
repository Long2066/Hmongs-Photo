import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, inMemoryPersistence } from "firebase/auth";
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
const analytics = getAnalytics(app);

// Initialize Auth with session-only persistence (forces login on each app open)
export const auth = getAuth(app);

// Set persistence to inMemory - session will NOT persist after closing app
setPersistence(auth, inMemoryPersistence)
  .then(() => {
    console.log("Auth persistence set to inMemory (session-only)");
  })
  .catch((error) => {
    console.error("Error setting auth persistence:", error);
  });

export const db = getFirestore(app);
export { app, analytics };
