// assets/js/firebase-init.js
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Kalıcı oturum (IndexedDB → olmazsa LocalStorage)
(async () => {
  try { await setPersistence(auth, indexedDBLocalPersistence); }
  catch { await setPersistence(auth, browserLocalPersistence); }
})();

// Basit yönlendirme yardımcısı
function requireAuth(redirect = "/auth.html") {
  onAuthStateChanged(auth, (u) => { if (!u) location.href = redirect; });
}

// Global export
window.__fb = { app, auth, db, requireAuth };
