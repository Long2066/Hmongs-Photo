import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Same Firebase Project as ImageTool
const firebaseConfig = {
    apiKey: "AIzaSyAUFQb3vsZPVv6i5smRTeXJkVYZuJGoQZE",
    authDomain: "toolphoto-2025.firebaseapp.com",
    projectId: "toolphoto-2025",
    storageBucket: "toolphoto-2025.firebasestorage.app",
    messagingSenderId: "820992304466",
    appId: "1:820992304466:web:6400056a3bf60d747a868b",
    measurementId: "G-TDZCN54YD4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };
