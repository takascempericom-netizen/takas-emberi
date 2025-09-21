// profile/profile.js — Profil: otomatik doldur, avatar yükle, şifre değiştir, ilanları sekmelere doldur

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, onAuthStateChanged, signOut, updateProfile,
  reauthenticateWithCredential, EmailAuthProvider, updatePassword, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, query, where, orderBy, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref as sref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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
const st   = getStorage(app);

// UI refs
const $ = (id)=>document.getElementById(id);
const elFirst = $("firstName");
const elLast  = $("lastName");
const elMail  = $("email");
const elCity  = $("city");
const avatarImg  = $("avatar");
const avatarFile = $("avatarFile");
const btnChangeAvatar = $("btnChangeAvatar");
const btnLogout = $("btnLogout");

// Yardımcı
const fill = (el,val)=>{ if(el){ el.value = val||""; } };
const setSrc = (el,src)=>{ if(el && src){ el.src = src; } };

// Çıkış
btnLogout?.addEventListener("click", ()=> signOut(auth).then(()=>location.href="/auth.html"));

// Sekme renderer (HTML tarafında varsa onu kullan, yoksa burada tanımla)
if (typeof window.renderListing !== "function") {
  window.renderListing = (item)=>{
    const live = document.getElementById("tab-live");
    const pending = document.getElementById("tab-pending");
    const expired = document.getElementById("tab-expired");
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `<div><strong>${item.title||"İlan"}</strong><div style="font-size:12px;color:#64748b">${item.desc||""}</div></div>`+
                   `<span class="st ${item.status}">${item.status==='live'?'Yayında': item.status==='pending'?'Onay Bekliyor':'Süresi Doldu'}</span>`;
    (item.status==='live'? live : item.status==='pending'? pending : expired)?.appendChild(el);
  };
}

// Auth
onAuthStateChanged(auth, async (user)=>{
  if (!user) {
    location.href = "/auth.html?next=/profile/profile.html";
    return;
  }

  // Profil bilgilerini doldur (salt okunur alanlar)
  const displayName = user.displayName || (user.providerData?.[0]?.displayName) || "";
  const parts = displayName.trim().split(/\s+/);
  const first = parts.length ? parts.slice(0, -1).join(" ") || parts[0] : "";
  const last  = parts.length > 1 ? parts.at(-1) : "";

  fill(elFirst, first);
  fill(elLast,  last);
  fill(elMail,  user.email || user.providerData?.[0]?.email || "");
  setSrc(avatarImg, user.photoURL || "/assets/img/avatar.png");

  // Firestore users/{uid} → city, ad/soyad override (varsa)
  try{
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const d = snap.data()||{};
      if (d.city) fill(elCity, d.city);
      if (!first && d.firstName) fill(elFirst, d.firstName);
      if (!last  && d.lastName)  fill(elLast,  d.lastName);
      if (!user.photoURL && d.photoURL) setSrc(avatarImg, d.photoURL);
      const nameUnder = document.getElementById("nameUnder");
      if (nameUnder) nameUnder.textContent = (d.firstName && d.lastName) ? `${d.firstName} ${d.lastName}` : (displayName || "—");
    }
  }catch(e){ console.warn("[profile] users doc okunamadı:", e); }

  // İlanları sekmelere doldur
  await loadListings(user.uid);

  // Avatar yükleme
  btnChangeAvatar?.addEventListener("click", ()=> avatarFile?.click());
  avatarFile?.addEventListener("change", async ()=>{
    try{
      const f = avatarFile.files?.[0];
      if (!f) return;
      // Yükle
      const path = `avatars/${user.uid}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const r = sref(st, path);
      await uploadBytes(r, f);
      const url = await getDownloadURL(r);
      // Auth profili & Firestore güncelle
      await updateProfile(user, { photoURL: url });
      await setDoc(doc(db,"users",user.uid), { photoURL: url, updatedAt: new Date() }, { merge:true });
      setSrc(avatarImg, url);
      alert("Profil fotoğrafı güncellendi.");
    }catch(e){
      console.error("Avatar yükleme hatası:", e);
      alert("Profil fotoğrafı güncellenemedi.");
    }
  });

  // Şifre değiştirme: HTML butonundan gelen olayı yakala
  window.addEventListener("change-pass-submit", async (ev)=>{
    const { old, n1, n2 } = ev.detail||{};
    try{
      if (!n1 || n1.length < 6)  throw new Error("Yeni şifre en az 6 karakter olmalı.");
      if (n1 !== n2)             throw new Error("Yeni şifreler eşleşmiyor.");
      // Eğer kullanıcı e-posta/şifre sağlayıcısıyla bağlı değilse reset maili öner
      const hasPasswordProvider = (user.providerData||[]).some(p=> (p.providerId||"").includes("password"));
      if (!hasPasswordProvider) {
        await sendPasswordResetEmail(auth, user.email);
        alert("Hesabın Google ile bağlı görünüyor. Mailine şifre oluşturma bağlantısı gönderdik.");
        return;
      }
      if (!old) throw new Error("Mevcut şifreni gir.");
      // Reauth
      const cred = EmailAuthProvider.credential(user.email, old);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, n1);
      alert("Şifren güncellendi.");
      // Form temizle
      const o=$("oldPassword"), a=$("newPassword"), b=$("newPassword2");
      if(o) o.value=""; if(a) a.value=""; if(b) b.value="";
    }catch(e){
      console.error("Şifre değiştirme hatası:", e);
      alert(e?.message || "Şifre güncellenemedi.");
    }
  });

});

// Kullanıcının ilanlarını getir ve sekmelere yerleştir
async function loadListings(uid){
  try{
    // 3 ayrı sorgu: live, pending, expired
    const col = collection(db, "listings");
    const qLive    = query(col, where("ownerId","==",uid), where("status","==","live"),    orderBy("createdAt","desc"));
    const qPending = query(col, where("ownerId","==",uid), where("status","==","pending"), orderBy("createdAt","desc"));
    const qExpired = query(col, where("ownerId","==",uid), where("status","==","expired"), orderBy("createdAt","desc"));

    const [s1, s2, s3] = await Promise.all([getDocs(qLive), getDocs(qPending), getDocs(qExpired)]);

    const render = (snap, status)=>{
      snap.forEach(docu=>{
        const d = docu.data()||{};
        window.renderListing({
          title: d.title || "İlan",
          desc:  d.description || "",
          status
        });
      });
    };
    render(s1, "live");
    render(s2, "pending");
    render(s3, "expired");
  }catch(e){
    console.error("[profile] listings yüklenemedi:", e);
  }
}
