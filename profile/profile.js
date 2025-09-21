// profile/profile.js — FINAL (modal güvenli, incele/düzenle/sil/süre al)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut, updateProfile,
  reauthenticateWithCredential, EmailAuthProvider, updatePassword, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, query, where, orderBy, getDocs,
  updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref as sref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/* Firebase Init */
const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const st   = getStorage(app, "gs://ureten-eller-v2.firebasestorage.app");

/* UI refs */
const $ = (id)=>document.getElementById(id);
const elFirst = $("firstName");
const elLast  = $("lastName");
const elMail  = $("email");
const elCity  = $("city");
const avatarImg  = $("avatar");
const avatarFile = $("avatarFile");
const btnChangeAvatar = $("btnChangeAvatar");
const btnLogout = $("btnLogout");

/* helpers */
const fill = (el,val)=>{ if(el){ el.value = val||""; } };
const setSrc = (el,src)=>{ if(el && src){ el.src = src; } };
const fmt = (ts)=> {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
    return d.toLocaleDateString("tr-TR", {day:"2-digit", month:"2-digit", year:"numeric"});
  } catch { return "—"; }
};
const firstPhoto = (arr)=> Array.isArray(arr) && arr.length ? arr[0] : "";

/* Çıkış */
btnLogout?.addEventListener("click", ()=> signOut(auth).then(()=>location.href="/auth.html"));

/* ---- Modal Refs (her seferinde taze al) ---- */
function getModalRefs(){
  return {
    modal: $("listingModal"),
    mTitle: $("mTitle"),
    mStatus: $("mStatus"),
    mPhoto: $("mPhoto"),
    mInputTitle: $("mInputTitle"),
    mInputDesc: $("mInputDesc"),
    mMeta: $("mMeta"),
    mSave: $("mSave"),
    mClose: $("mClose"),
  };
}
function openModal(){ const {modal}=getModalRefs(); modal?.classList.add("show"); }
function closeModal(){ const {modal}=getModalRefs(); modal?.classList.remove("show"); }

/* ---- RENDER LISTING (görsel + aksiyonlar) ---- */
window.renderListing = (item) => {
  const live    = document.getElementById("tab-live");
  const pending = document.getElementById("tab-pending");
  const expired = document.getElementById("tab-expired");
  const container =
    item.status === "live"    ? live :
    item.status === "pending" ? pending : expired;

  if (!container) { console.warn("[renderListing] container yok:", item.status); return; }

  const img = firstPhoto(item.photos) || "";
  const card = document.createElement("div");
  card.className = "item";
  card.dataset.id = item.id;
  card.dataset.status = item.status;

  card.innerHTML = `
    <div class="thumb" style="${img ? `background-image:url('${img}')` : ''}"></div>
    <div class="meta">
      <strong>${item.title || "İlan"}</strong>
      <div class="muted">${item.desc || item.description || ""}</div>
      <div class="muted">Oluşturma: ${fmt(item.createdAt)} • Bitiş: ${fmt(item.expiresAt)}</div>
      <span class="badge ${item.status}">${item.status === "live" ? "Yayında" : item.status === "pending" ? "Onay Bekliyor" : "Süresi Doldu"}</span>
    </div>
    <div class="actions">
      <button class="btn sm" data-action="view">İncele</button>
      ${item.status === "live" ? `
        <button class="btn sm" data-action="edit">Düzenle</button>
        <button class="btn sm danger" data-action="delete">Sil</button>
      ` : item.status === "pending" ? `` : `
        <button class="btn sm" data-action="renew">Süre Al</button>
        <button class="btn sm danger" data-action="delete">Sil</button>
      `}
    </div>
  `;
  container.appendChild(card);
};

/* ---- Modal doldur ---- */
function fillModal(data, editable=false){
  const {modal, mTitle, mStatus, mPhoto, mInputTitle, mInputDesc, mMeta, mSave, mClose} = getModalRefs();
  if (![modal, mTitle, mStatus, mPhoto, mInputTitle, mInputDesc, mMeta, mSave].every(Boolean)) {
    console.error("[modal] DOM eksik, HTML'deki modal bloğunu kontrol et.");
    alert("İnceleme penceresi yüklenemedi. Lütfen sayfayı yenileyin.");
    return;
  }
  mTitle.textContent = data.title || "İlan";
  mStatus.textContent = data.status === "live" ? "Yayında" : data.status === "pending" ? "Onay Bekliyor" : "Süresi Doldu";
  mStatus.className = "badge " + data.status;
  const url = firstPhoto(data.photos);
  if (url) { mPhoto.src = url; mPhoto.style.display = "block"; }
  else { mPhoto.removeAttribute("src"); mPhoto.style.display = "none"; }
  mInputTitle.value = data.title || "";
  mInputDesc.value  = data.description || data.desc || "";
  mInputTitle.disabled = !editable;
  mInputDesc.disabled  = !editable;
  mSave.style.display  = editable ? "inline-block" : "none";
  mMeta.textContent = `Oluşturma: ${fmt(data.createdAt)} • Bitiş: ${fmt(data.expiresAt)} • İlan ID: ${data.id}`;
  mClose?.addEventListener("click", closeModal, { once:true });
}

/* ---- İlan Aksiyonları ---- */
async function viewListing(id, editable=false){
  const snap = await getDoc(doc(db,"listings",id));
  if (!snap.exists()) { alert("İlan bulunamadı."); return; }
  const d = snap.data()||{};
  fillModal({ id, ...d }, editable);
  const { mSave } = getModalRefs();
  if (mSave) {
    mSave.onclick = async ()=>{
      try{
        await updateDoc(doc(db,"listings",id), {
          title: document.getElementById("mInputTitle").value.trim(),
          description: document.getElementById("mInputDesc").value.trim(),
          updatedAt: serverTimestamp()
        });
        alert("İlan güncellendi.");
        closeModal();
        location.reload();
      }catch(e){
        console.error(e);
        alert("Güncellenemedi: " + (e?.message||e));
      }
    };
  }
  openModal();
}

async function deleteListing(id){
  if (!confirm("Bu ilanı silmek istiyor musun?")) return;
  try{ await deleteDoc(doc(db,"listings",id)); alert("İlan silindi."); location.reload(); }
  catch(e){ console.error(e); alert("Silinemedi: " + (e?.message||e)); }
}

async function renewListing(id){
  if (!confirm("Süreyi +30 gün uzatıp incelemeye göndereyim mi?")) return;
  try{
    const now = new Date(); const newExp = new Date(); newExp.setDate(now.getDate()+30);
    await updateDoc(doc(db,"listings",id), {
      status: "pending", expiresAt: newExp, renewedAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    alert("Süre uzatıldı ve tekrar incelemeye gönderildi."); location.reload();
  }catch(e){ console.error(e); alert("Süre uzatılamadı: " + (e?.message||e)); }
}

/* Liste alanlarında event delegation */
["tab-live","tab-pending","tab-expired"].forEach(listId=>{
  const root = $(listId);
  root?.addEventListener("click",(ev)=>{
    const btn = ev.target.closest("button[data-action]"); if (!btn) return;
    const card = btn.closest(".item"); const id = card?.dataset.id; const action = btn.dataset.action; if (!id) return;
    if (action === "view")  viewListing(id, false);
    if (action === "edit")  viewListing(id, true);
    if (action === "delete") deleteListing(id);
    if (action === "renew") renewListing(id);
  });
});

/* ---- Auth + Profil doldurma ---- */
onAuthStateChanged(auth, async (user)=>{
  if (!user) { location.href = "/auth.html?next=/profile/profile.html"; return; }

  const displayName = user.displayName || (user.providerData?.[0]?.displayName) || "";
  const parts = displayName.trim().split(/\s+/);
  const first = parts.length ? parts.slice(0, -1).join(" ") || parts[0] : "";
  const last  = parts.length > 1 ? parts.at(-1) : "";

  fill(elFirst, first); fill(elLast, last);
  fill(elMail,  user.email || user.providerData?.[0]?.email || "");
  if (user.photoURL) setSrc(avatarImg, user.photoURL);

  try{
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const d = snap.data()||{};
      if (d.city) fill(elCity, d.city);
      if (!first && d.firstName) fill(elFirst, d.firstName);
      if (!last  && d.lastName)  fill(elLast,  d.lastName);
      if (!user.photoURL && d.photoURL) setSrc(avatarImg, d.photoURL);
      const nameUnder = $("nameUnder");
      if (nameUnder) nameUnder.textContent = (d.firstName && d.lastName) ? `${d.firstName} ${d.lastName}` : (displayName || "—");
    }
  }catch(e){ console.warn("[profile] users doc okunamadı:", e); }

  await loadListings(user.uid);

  btnChangeAvatar?.addEventListener("click", ()=> avatarFile?.click());
  avatarFile?.addEventListener("change", async ()=>{
    try{
      const f = avatarFile.files?.[0]; if (!f) return;
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g,'_'); const path = `avatars/${user.uid}/${Date.now()}_${safe}`;
      const r = sref(st, path); await uploadBytes(r, f); const url = await getDownloadURL(r);
      await updateProfile(user, { photoURL: url });
      await setDoc(doc(db,"users",user.uid), { photoURL: url, updatedAt: new Date() }, { merge:true });
      setSrc(avatarImg, url); alert("Profil fotoğrafı güncellendi.");
    }catch(e){ console.error("Avatar yükleme hatası:", e); alert("Profil fotoğrafı güncellenemedi."); }
  });

  window.addEventListener("change-pass-submit", async (ev)=>{
    const { old, n1, n2 } = ev.detail||{};
    try{
      if (!n1 || n1.length < 6)  throw new Error("Yeni şifre en az 6 karakter olmalı.");
      if (n1 !== n2)             throw new Error("Yeni şifreler eşleşmiyor.");
      const hasPasswordProvider = (user.providerData||[]).some(p=> (p.providerId||"").includes("password"));
      if (!hasPasswordProvider) { await sendPasswordResetEmail(auth, user.email); alert("Hesabın Google ile bağlı görünüyor. Mailine şifre oluşturma bağlantısı gönderdik."); return; }
      if (!old) throw new Error("Mevcut şifreni gir.");
      const cred = EmailAuthProvider.credential(user.email, old);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, n1);
      alert("Şifren güncellendi.");
      ["oldPassword","newPassword","newPassword2"].forEach(id=>{ const el=$(id); if(el) el.value=""; });
    }catch(e){ console.error("Şifre değiştirme hatası:", e); alert(e?.message || "Şifre güncellenemedi."); }
  });
});

/* ---- İlanları getir & çiz ---- */
async function loadListings(uid){
  const hasDom = $("tab-live") && $("tab-pending") && $("tab-expired");
  if (!hasDom) return;
  try{
    const col = collection(db, "listings");
    const qLive    = query(col, where("ownerId","==",uid), where("status","==","live"),    orderBy("createdAt","desc"));
    const qPending = query(col, where("ownerId","==",uid), where("status","==","pending"), orderBy("createdAt","desc"));
    const qExpired = query(col, where("ownerId","==",uid), where("status","==","expired"), orderBy("createdAt","desc"));

    const [s1, s2, s3] = await Promise.all([getDocs(qLive), getDocs(qPending), getDocs(qExpired)]);

    const renderSnap = (snap, status)=>{
      snap.forEach(docu=>{
        const d = docu.data()||{};
        window.renderListing({
          id: docu.id,
          title: d.title || "İlan",
          desc:  d.description || "",
          photos: d.photos || [],
          createdAt: d.createdAt,
          expiresAt: d.expiresAt,
          status
        });
      });
    };
    renderSnap(s1, "live");
    renderSnap(s2, "pending");
    renderSnap(s3, "expired");
  }catch(e){ console.error("[profile] listings yüklenemedi:", e); }
}
