import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, where, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import authState from './state.js';
import { initAdmin } from './admin.js';
import { initExplorer } from './explorer.js';

export function initializeFirebase() {
  const firebaseApp = firebase.app();
  const auth = firebase.auth();
  const db = firebase.firestore();
  const appId = firebaseApp.options.appId;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      authState.update({ userId: user.uid, isAuthenticated: true });
      initAdmin(db, auth, appId, user.uid, serverTimestamp, Papa, showConfirmModal, collection, query, where, addDoc, getDocs, doc, updateDoc, deleteDoc);
      initExplorer(db, appId, collection, query, getDocs);
    } else {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Anonymous sign-in failed:", err);
        authState.update({ userId: 'anonymous', isAuthenticated: false });
        initAdmin(null, null, appId, 'anonymous', () => new Date(), Papa, showConfirmModal, null, null, null, null, null, null, null);
        initExplorer(null, appId, null, null, null);
      }
    }
  });
}
