/* firebase-init.js — basit, sağlam init (App Check KAPALI) */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ⚠️ App Check İMPORT ETME! (bilerek yok) */

/* Proje config (senin konsolundan) */
const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

let app;
try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
  console.error("[fb] init error:", e);
}

/* Auth + kalıcılık (hata verirse geç) */
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(()=>{});

/* Firestore */
const db = getFirestore(app);

/* İsteğe bağlı: login mecburiyeti tetikleyici (redirect parametreli) */
function requireAuth(opts = {}) {
  const { redirectTo } = opts;
  onAuthStateChanged(auth, (user) => {
    if (!user && redirectTo) {
      try { location.href = redirectTo; } catch(_) {}
    }
  });
}

/* Global nesne */
window.__fb = { app, auth, db, requireAuth };
console.log("[fb] ready:", app?.options?.projectId);

/* ESM uyumu */
export {};
