import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCu-BzgP0lNddLYn8CohmXxIcwPFTG7hJ4",
  authDomain: "otp-email-tool-photo.firebaseapp.com",
  projectId: "otp-email-tool-photo",
  storageBucket: "otp-email-tool-photo.firebasestorage.app",
  messagingSenderId: "373643803980",
  appId: "1:373643803980:web:502063defae05e5f27a3e9",
  measurementId: "G-4ZKY28E89J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Auth and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app, analytics };
