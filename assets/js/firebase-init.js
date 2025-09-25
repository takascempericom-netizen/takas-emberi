/* firebase-init.js — GÜNCEL (tek import, tek export, güvenli init) */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, query, where, onSnapshot, doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ⚠️ App Check İMPORT YOK (bilerek kapalı) */

/* Proje config (bucket: appspot.com olmalı) */
const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com", // DÜZELTİLDİ
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

let app;
try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
  console.error("[fb] init error:", e);
}

/* Auth + kalıcılık */
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(()=>{});

/* Firestore */
const db = getFirestore(app);

/* Opsiyonel: login mecburiyeti */
function requireAuth(opts = {}) {
  const { redirectTo } = opts;
  onAuthStateChanged(auth, (user) => {
    if (!user && redirectTo) {
      try { location.href = redirectTo; } catch(_) {}
    }
  });
}

/* ===== Global Mesaj & Bildirim İzleyici =====
   - Mesajlar rozeti: #msgBadge
   - Bildirimler rozeti: #notifBadge
   - Ses: #notifySoundGlobal (yoksa #notifySound) */
function playPing(){
  const tag = document.getElementById('notifySoundGlobal') || document.getElementById('notifySound');
  if (tag) {
    tag.play().catch(()=>{ /* autoplay engeli: sessiz geç, fallback'a düş */ fallbackBeep(); });
  } else {
    fallbackBeep();
  }
}
function fallbackBeep(duration=160, freq=880){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ac = new Ctx(); const o = ac.createOscillator(); const g = ac.createGain();
    o.type='sine'; o.frequency.value=freq; o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + 0.01);
    o.start();
    setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.04); o.stop(); ac.close(); }, duration);
  }catch{}
}
function setBadge(el, n){
  if(!el) return;
  if(n > 0){ el.style.display = 'inline-grid'; el.textContent = String(n); }
  else     { el.style.display = 'none'; }
}
let _unsubChats = null, _unsubInbox = null;

/* LocalStorage tabanlı “görüldü” yardımcıları */
function getSeen(chatId){
  try{ return parseInt(localStorage.getItem(`seen_chat_${chatId}`)||'0',10); }catch{ return 0; }
}
function setSeen(chatId, ms){
  try{ localStorage.setItem(`seen_chat_${chatId}`, String(ms||Date.now())); }catch{}
}

/* Dışarıdan çağır: window.__fb.startGlobalMessagingWatcher() */
function startGlobalMessagingWatcher(){
  onAuthStateChanged(auth, async (user)=>{
    // eski listener'ları kapat
    try{ _unsubChats && _unsubChats(); }catch{} _unsubChats=null;
    try{ _unsubInbox && _unsubInbox(); }catch{} _unsubInbox=null;

    const msgBadge  = document.getElementById('msgBadge');   // Mesajlar rozeti
    const notifBadge= document.getElementById('notifBadge'); // Bildirimler rozeti
    setBadge(msgBadge, 0);
    setBadge(notifBadge, 0);

    if(!user) return;

    // === Mesajlar: katıldığım sohbetlerde karşıdan yeni mesaj var mı? ===
    const chatsQ = query(collection(db,'chats'), where('participants','array-contains', user.uid));
    let firstSnap = true;
    _unsubChats = onSnapshot(chatsQ, (snap)=>{
      let count = 0;
      let shouldPing = false;

      snap.forEach(d=>{
        const c = d.data()||{};
        const lastAt = c.lastMsgAt?.toMillis?.() || 0;
        const lastSender = c.lastSenderUid || c.lastSender || '';
        const seen = getSeen(d.id);

        // Rozet: bu sohbette “karşıdan” ve “görülmemiş” yeni mesaj varsa say
        if (lastAt && lastAt > seen && lastSender && lastSender !== user.uid) {
          count += 1;
          // Ses: ilk snapshot’ta çalma; sonrakilerde sayfa mesajlar değilken veya sekme gizliyken çal
          if (!firstSnap && (location.pathname !== '/messages.html' || document.hidden)) {
            shouldPing = true;
          }
        }
      });

      setBadge(msgBadge, count);
      if (shouldPing) playPing();
      firstSnap = false;
    }, (e)=>console.warn("[global chats] err:", e));

    // === Bildirimler: users/{uid}/inbox (read:false) ===
    const inboxQ = query(collection(db,'users', user.uid, 'inbox'), where('read','==', false));
    _unsubInbox = onSnapshot(inboxQ, (snap)=>{
      const n = snap.size || 0;
      setBadge(notifBadge, n);

      const added = snap.docChanges().some(ch=> ch.type==='added');
      if (added && (location.pathname !== '/notifications.html' || document.hidden)) {
        playPing();
      }
    }, (e)=>console.warn("[global inbox] err:", e));
  });
}

/* ---- Public profile upsert (Google/E-posta girişleri) ---- */
function splitName(displayName) {
  if (!displayName || typeof displayName !== 'string') return { firstName: '', lastName: '' };
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.slice(-1).join(' ') };
}

async function upsertPublicProfile(user) {
  try {
    const _db = db || getFirestore();

    const displayName = user.displayName || user.providerData?.[0]?.displayName || '';
    const photoURL    = user.photoURL    || user.providerData?.[0]?.photoURL    || '';
    const email       = user.email       || user.providerData?.[0]?.email       || '';
    const providerId  = user.providerData?.[0]?.providerId || 'password';

    const { firstName, lastName } = splitName(displayName);

    await setDoc(
      doc(_db, 'profiles_public', user.uid),
      {
        uid: user.uid,
        displayName: displayName || (email ? email.split('@')[0] : 'Kullanıcı'),
        firstName: firstName || '',
        lastName: lastName || '',
        photoURL: photoURL || '',
        email: email || '',
        provider: providerId,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      { merge: true }
    );

    await setDoc(
      doc(_db, 'users', user.uid),
      {
        uid: user.uid,
        displayName: displayName || (email ? email.split('@')[0] : 'Kullanıcı'),
        firstName: firstName || '',
        lastName: lastName || '',
        photoURL: photoURL || '',
        email: email || '',
        provider: providerId,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('upsertPublicProfile hata:', e);
  }
}

/* Global export — tek sefer, tekrar eden atamalar kaldırıldı */
if (!window.__fb) window.__fb = {};
Object.assign(window.__fb, { app, auth, db, requireAuth, startGlobalMessagingWatcher, upsertPublicProfile });
console.log("[fb] ready:", app?.options?.projectId);

/* ESM uyumu */
export {};
