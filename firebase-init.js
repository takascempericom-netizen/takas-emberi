// firebase-init.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "auth.takascemberi.com",   // 👈 özel domain
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

let app;
try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
  console.error("[fb] init error:", e);
}

const auth = getAuth(app);
const db = getFirestore(app);

if (!window.__fb) window.__fb = {};
Object.assign(window.__fb, { app, auth, db });
console.log("[fb] ready:", app?.options?.authDomain);
