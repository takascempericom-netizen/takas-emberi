// profile/profile.js — minimal stabil sürüm (önce yüklenmeyi doğrula)

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase init
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

// Basit UI refs (varsa)
const logoutBtn = document.getElementById("btnLogout");

// Log: dosya yüklendi
console.log("[profile.js] loaded", new Date().toISOString());

// Çıkış
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => location.href="/auth.html");
  });
}

// Auth gate
onAuthStateChanged(auth, (user) => {
  if (!user) {
    console.warn("[profile.js] not signed in → redirect");
    location.href = "/auth.html?next=/profile/";
    return;
  }
  console.log("[profile.js] signed in as", user.email);
});
