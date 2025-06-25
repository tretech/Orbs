import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

const firebaseConfig = {
  // 🔐 YOUR FIREBASE CONFIG HERE
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
