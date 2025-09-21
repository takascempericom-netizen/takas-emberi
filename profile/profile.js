// profile/profile.js — minimal + autofill (stabil)

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// UI refs (ID'leri HTML'de böyle ver)
const $ = (id) => document.getElementById(id);
const elFirst = $("firstName");   // Ad
const elLast  = $("lastName");    // Soyad
const elMail  = $("email");       // E-posta
const elCity  = $("city");        // Şehir
const btnSave = $("btnSave");     // (opsiyonel) Kaydet
const logoutBtn = $("btnLogout");

console.log("[profile.js] loaded", new Date().toISOString());

// Çıkış
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => (location.href = "/auth.html"));
  });
}

// Yardımcılar
const fillIfEmpty = (input, value) => {
  if (!input) return;
  if (!input.value || input.dataset.autofill === "1") {
    input.value = value || "";
    input.dataset.autofill = "1";
  }
};
const splitName = (displayName = "") => {
  const p = displayName.trim().split(/\s+/);
  if (!p.length) return { first: "", last: "" };
  if (p.length === 1) return { first: p[0], last: "" };
  return { first: p.slice(0, -1).join(" "), last: p[p.length - 1] };
};

// Auth gate + doldurma
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.warn("[profile.js] not signed in → redirect");
    location.href = "/auth.html?next=/profile/";
    return;
  }
  console.log("[profile.js] signed in as", user.email);

  // E-posta
  fillIfEmpty(elMail, user.email || user.providerData?.[0]?.email || "");

  // Ad / Soyad
  const dn = user.displayName || user.providerData?.[0]?.displayName || "";
  const { first, last } = splitName(dn);
  fillIfEmpty(elFirst, first);
  fillIfEmpty(elLast, last);

  // Firestore'dan şehir (ve profil alanları) çek
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() || {};
      if (data.city)       fillIfEmpty(elCity, data.city);
      if (!elFirst?.value && data.firstName) fillIfEmpty(elFirst, data.firstName);
      if (!elLast?.value  && data.lastName)  fillIfEmpty(elLast,  data.lastName);
      if (!elMail?.value  && data.email)     fillIfEmpty(elMail,  data.email);
    }
  } catch (e) {
    console.error("[profile] Firestore read error:", e);
  }

  // (Opsiyonel) Kaydet: formu Firestore'a yazar
  if (btnSave) {
    btnSave.addEventListener("click", async (ev) => {
      ev.preventDefault();
      try {
        const payload = {
          firstName: elFirst?.value?.trim() || "",
          lastName:  elLast?.value?.trim()  || "",
          email:     elMail?.value?.trim()  || user.email || "",
          city:      elCity?.value?.trim()  || "",
          updatedAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", user.uid), payload, { merge: true });
        console.log("[profile] saved");
        btnSave.disabled = true;
        setTimeout(() => (btnSave.disabled = false), 800);
      } catch (e) {
        console.error("[profile] save error:", e);
        alert("Kaydedilemedi. Konsolu kontrol edin.");
      }
    }, { once: true });
  }
});
