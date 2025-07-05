import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, where, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import authState from './state.js';
import { initAdmin } from './admin.js';
import { initExplorer } from './explorer.js';

// Firebase should already be initialized in index.html
export function initializeFirebase(showConfirmModal) {
  const auth = getAuth();
  const db = getFirestore();
  const appId = getAuth().app.options.appId;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("Firebase initialized and user signed in:", user.uid);
      authState.update({ userId: user.uid, isAuthenticated: true });

      initAdmin(db, auth, appId, user.uid, serverTimestamp, Papa, showConfirmModal, collection, query, where, addDoc, getDocs, doc, updateDoc, deleteDoc);
      if (document.getElementById('orb-display-area')) {
        initExplorer(db, appId, collection, query, getDocs);
      } else {
        console.warn("Explorer skipped: #orb-display-area not present (possibly due to tab state).");
      }
    } else {
      try {
        console.log("No user signed in. Attempting anonymous sign-in.");
        await signInAnonymously(auth);
        // onAuthStateChanged will fire again with the signed-in user
      } catch (error) {
        console.error("Error during anonymous sign-in:", error);
        authState.update({ userId: 'anonymous', isAuthenticated: false });

        initAdmin(null, null, appId, 'anonymous', () => new Date(), Papa, showConfirmModal, null, null, null, null, null, null, null);
        initExplorer(null, appId, null, null, null);
      }
    }
  });
}
