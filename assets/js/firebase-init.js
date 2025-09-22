// assets/js/firebase-init.js
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, setPersistence, indexedDBLocalPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js";

// ---- Firebase config (seninki) ----
const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ---- App Check (reCAPTCHA v3) ----
// Firebase Console → App Check → Web app → reCAPTCHA v3 → "Site key" BURAYA
const SITE_KEY = "REPLACE_WITH_YOUR_REAL_RECAPTCHA_V3_SITE_KEY";

let appCheckOk = false;
try {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
  appCheckOk = true;
} catch (e) {
  // App Check başlatılamasa bile app/auth/db set edilir; uygulama kırılmaz
  console.warn("[AppCheck] init başarısız:", e);
}

const auth = getAuth(app);
try {
  await setPersistence(auth, indexedDBLocalPersistence);
} catch {
  await setPersistence(auth, browserLocalPersistence);
}

const db = getFirestore(app);

// Basit guard: giriş yoksa /auth.html
function requireAuth() {
  onAuthStateChanged(auth, (u) => { if (!u) location.href = "/auth.html"; });
}

// Global export — her sayfa buradan alacak
window.__fb = { app, auth, db, requireAuth, appCheckOk };
