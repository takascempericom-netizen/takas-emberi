// assets/js/firebase-init.js
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, setPersistence, indexedDBLocalPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// App Check
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/* █ App Check: reCAPTCHA v3 █
   Firebase Console → Build → App Check → Web app → reCAPTCHA v3
   “Site key” değerini BURAYA koy.
*/
const SITE_KEY = "YOUR_RECAPTCHA_V3_SITE_KEY";

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(SITE_KEY),
  isTokenAutoRefreshEnabled: true
});

// (Opsiyonel) Token’ı alıp logla — prod’da kalabilir:
try {
  const tok = await getToken(app, /* forceRefresh */ false);
  console.debug("[AppCheck] token kısaltılmış:", tok?.token?.slice(0, 12) || "(yok)");
} catch (e) {
  console.warn("[AppCheck] token alınamadı:", e);
}

const auth = getAuth(app);
try { await setPersistence(auth, indexedDBLocalPersistence); } catch { await setPersistence(auth, browserLocalPersistence); }

const db = getFirestore(app);

// Basit helper
function requireAuth() {
  onAuthStateChanged(auth, (u) => { if (!u) location.href = "/auth.html"; });
}

window.__fb = { app, auth, db, requireAuth };
