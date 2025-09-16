// assets/js/bildirimler.js
// Kullanıcı ve admin için anlık bildirimler (onay/ret/teklif/pending).
// Ses: /assets/sounds/notify.wav (repo'da mevcut)

'use strict';

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, collectionGroup, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SOUND_URL = "/assets/sounds/notify.wav";

// App init (varsa yeniden kullan)
let app;
if (!getApps().length) {
  // Sayfada ayrı bir config yoksa güvenli fallback:
  const firebaseConfig = {
    apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
    authDomain: "ureten-eller-v2.firebaseapp.com",
    projectId: "ureten-eller-v2",
    storageBucket: "ureten-eller-v2.firebasestorage.app",
    messagingSenderId: "621494781131",
    appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
  };
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const auth = getAuth(app);
const db = getFirestore(app);

// Basit uyarı + ses (sound.js varsa onun ayarını respect eder)
async function notify(msg, soundFile = SOUND_URL) {
  try { console.log("[notify]", msg);
    try{ window.dispatchEvent(new CustomEvent('tc:notify',{detail:{message:msg, at:Date.now()}})); }catch(_){}
    alert(msg); } catch(_) {}
  try {
    const canPlay = window.isSoundEnabled ? window.isSoundEnabled() : true;
    if (canPlay) {
      const a = new Audio(soundFile);
      await a.play();
    }
  } catch(_) {}
}

/* -------------------- Kullanıcı bildirimleri --------------------
   - pending -> active : "İlan onaylandı"
   - pending -> rejected : "İlan reddedildi"
   - offers (opsiyonel) : ilan sahibine teklif geldi
------------------------------------------------------------------ */
let unsubUser = [];
export function startUserNotifications() {
  stopUserNotifications();
  onAuthStateChanged(auth, (user) => {
    stopUserNotifications();
    if (!user) return;

    const lastStatus = new Map();

    // Kendi ilanları (ownerId==uid)
    const qMine = query(collection(db, "listings"), where("ownerId", "==", user.uid));
    const un1 = onSnapshot(qMine, (ss) => {
      ss.docChanges().forEach((ch) => {
        const d = ch.doc.data(); const id = ch.doc.id;
        const prev = lastStatus.get(id); const curr = d.status;
        if (ch.type === "added") {
          // ilk yüklemede sadece mevcut durumu kayda al
          lastStatus.set(id, curr);
        } else if (ch.type === "modified") {
          if (prev === "pending" && curr === "active") notify(`İlan onaylandı: ${d.title || id}`);
          if (prev === "pending" && curr === "rejected") notify(`İlan reddedildi: ${d.title || id}`);
          lastStatus.set(id, curr);
        } else if (ch.type === "removed") {
          lastStatus.delete(id);
        }
      });
    }, (e)=>console.warn("[notify:listings]", e));
    unsubUser.push(un1);

    // Teklifler (opsiyonel şema): offers collectionGroup (sellerId == uid)
    try {
      const qOffers = query(collectionGroup(db, "offers"), where("sellerId", "==", user.uid));
      const seen = new Set();
      const un2 = onSnapshot(qOffers, (ss) => {
        ss.docChanges().forEach((ch) => {
          if (ch.type === "added") {
            const d = ch.doc.data(); const id = ch.doc.id;
            if (seen.has(id)) return; seen.add(id);
            notify(`İlanınıza teklif geldi: ${d.title || d.listingTitle || "Teklif"}`);
          }
        });
      }, (e)=>console.warn("[notify:offers]", e));
      unsubUser.push(un2);
    } catch(e) {
      console.warn("[notify:offers] collectionGroup yok ya da index gerekir", e);
    }
  });
}
export function stopUserNotifications() {
  unsubUser.forEach(u=>{try{u();}catch(_){}}); unsubUser = [];
}

/* ---------------------- Admin bildirimleri ----------------------
   - Yeni pending ilan eklendiğinde uyar
------------------------------------------------------------------ */
let unsubAdmin = [];
export function startAdminNotifications() {
  stopAdminNotifications();
  onAuthStateChanged(auth, (user) => {
    stopAdminNotifications();
    if (!user) return;
    // Admin claim kontrolünü sayfa tarafında yapın (opsiyonel)
    try {
      const qPend = query(collection(db, "listings"), where("status", "==", "pending"));
      const seen = new Set();
      const un = onSnapshot(qPend, (ss) => {
        ss.docChanges().forEach((ch) => {
          if (ch.type === "added") {
            const d = ch.doc.data(); const id = ch.doc.id;
            if (seen.has(id)) return; seen.add(id);
            notify(`Yeni onay bekleyen ilan: ${d.title || id}`);
          }
        });
      }, (e)=>console.warn("[notify:pending]", e));
      unsubAdmin.push(un);
    } catch(e) {
      console.warn("[notify:pending] query hata", e);
    }
  });
}
export function stopAdminNotifications() {
  unsubAdmin.forEach(u=>{try{u();}catch(_){}}); unsubAdmin = [];
}

// Kolay erişim (opsiyonel)
window.Bildirimler = { startUserNotifications, stopUserNotifications, startAdminNotifications, stopAdminNotifications };
