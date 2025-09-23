// profile/profile.js — FINAL (modal kendini ekler, incele/düzenle/sil/süre al, foto fallback, uid/ownerId destekli)

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut, updateProfile,
  reauthenticateWithCredential, EmailAuthProvider, updatePassword, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs,
  updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref as sref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/* ==== Firebase Init ==== */
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
// Storage (bucket belirtilmiş)
const st   = getStorage(app, "gs://ureten-eller-v2.firebasestorage.app");

/* ==== UI refs ==== */
const $ = (id)=>document.getElementById(id);
const elFirst = $("firstName");
const elLast  = $("lastName");
const elMail  = $("email");
const elCity  = $("city");
const avatarImg  = $("avatar");
const avatarFile = $("avatarFile");
const btnChangeAvatar = $("btnChangeAvatar");
const btnLogout = $("btnLogout");

/* ==== Helpers ==== */
const fill = (el,val)=>{ if(el){ el.value = val||""; } };
const setSrc = (el,src)=>{ if(el && src){ el.src = src; } };
const fmt = (ts)=> {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
    return isNaN(d) ? "—" : d.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"});
  } catch { return "—"; }
};
const firstPhoto = (arr)=> Array.isArray(arr) && arr.length ? arr[0] : "";

/* ==== Çıkış ==== */
btnLogout?.addEventListener("click", ()=> signOut(auth).then(()=>location.href="/auth.html"));

/* ==== MODAL: eksikse otomatik ekle ==== */
function ensureModal(){
  if (document.getElementById('listingModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
<div class="modal" id="listingModal" aria-hidden="true" style="position:fixed;inset:0;display:none;place-items:center;background:rgba(15,23,42,.45);z-index:50">
  <div class="dialog" style="width:min(880px,92vw);background:#fff;border-radius:18px;border:1px solid #e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden">
    <div class="head" style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #e2e8f0">
      <strong id="mTitle">İlan</strong>
      <span class="badge" id="mStatus"></span>
    </div>
    <div class="body" style="padding:14px;display:grid;grid-template-columns:220px 1fr;gap:14px">
      <img id="mPhoto" alt="ilan" style="width:100%;border-radius:12px;border:1px solid #e5e7eb;object-fit:cover;aspect-ratio:1/1">
      <div class="f" style="display:grid;gap:8px">
        <label>Başlık</label>
        <input id="mInputTitle" style="border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;background:#f8fafc">
        <label>Açıklama</label>
        <textarea id="mInputDesc" style="border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;background:#f8fafc;min-height:120px;resize:vertical"></textarea>
        <div class="muted" id="mMeta" style="font-size:12px;color:#64748b"></div>
      </div>
    </div>
    <div class="foot" style="display:flex;gap:8px;justify-content:flex-end;padding:12px 14px;border-top:1px solid #e2e8f0;background:#f8fafc">
      <button class="btn sm ghost" id="mClose">Kapat</button>
      <button class="btn sm" id="mSave" style="display:none">Kaydet</button>
    </div>
  </div>
</div>`);
  const modal = document.getElementById('listingModal');
  const obs = new MutationObserver(()=>{
    modal.style.display = modal.classList.contains('show') ? 'grid' : 'none';
  });
  obs.observe(modal, { attributes:true, attributeFilter:['class'] });
}

/* ==== Modal refs + kontrol ==== */
function refs(){
  ensureModal();
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
    liveEl: $("tab-live"),
    pendEl: $("tab-pending"),
    expEl: $("tab-expired"),
  };
}
function openModal(){ ensureModal(); refs().modal?.classList.add("show"); }
function closeModal(){ refs().modal?.classList.remove("show"); }

/* ==== Alt koleksiyondan ilk foto (fallback) ==== */
async function getFirstPhotoFromSub(listingId){
  try{
    const sub = collection(db, "listings", listingId, "photos");
    const ss = await getDocs(sub);
    for (const docu of ss.docs) {
      const urls = docu.data()?.urls;
      if (Array.isArray(urls) && urls.length) return urls[0];
    }
  }catch(e){ console.warn("[photos-sub] okunamadı:", e); }
  return "";
}

/* ==== Kart render ==== */
window.renderListing = (item) => {
  const { liveEl, pendEl, expEl } = refs();
  const container =
    item.status === "live"    ? liveEl :
    item.status === "pending" ? pendEl : expEl;

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

/* ==== Modal doldur ==== */
function fillModal(data, editable=false){
  const { mTitle, mStatus, mPhoto, mInputTitle, mInputDesc, mMeta, mSave, mClose } = refs();
  if (!mTitle) return;

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
  if (mSave) mSave.style.display  = editable ? "inline-block" : "none";
  if (mMeta) mMeta.textContent = `Oluşturma: ${fmt(data.createdAt)} • Bitiş: ${fmt(data.expiresAt)} • İlan ID: ${data.id}`;

  mClose?.addEventListener("click", closeModal, { once:true });
}

/* ==== İlan aksiyonları ==== */
async function viewListing(id, editable=false){
  const snap = await getDoc(doc(db,"listings",id));
  if (!snap.exists()) { alert("İlan bulunamadı."); return; }
  const d = snap.data()||{};
  let photos = Array.isArray(d.photos) ? d.photos : [];
  if (!photos.length) {
    const first = await getFirstPhotoFromSub(id);
    if (first) photos = [first];
  }
  fillModal({ id, ...d, photos }, editable);

  const { mSave } = refs();
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
      status: "pending",
      expiresAt: newExp,
      renewedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    alert("Süre uzatıldı ve tekrar incelemeye gönderildi.");
    location.reload();
  }catch(e){ console.error(e); alert("Süre uzatılamadı: " + (e?.message||e)); }
}

/* ==== Liste alanları: event delegation ==== */
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

/* ==== Auth + Profil doldurma (URL'den ?uid al; başkasının profili için profiles_public oku) ==== */
onAuthStateChanged(auth, async (user)=>{
  if (!user) {
    const next = location.pathname + location.search;
    location.href = "/auth.html?next=" + encodeURIComponent(next);
    return;
  }

  // 1) URL'den ?uid= al; yoksa kendi uid'in
  const params = new URLSearchParams(location.search);
  const uidFromUrl = params.get('uid');
  const targetUid = uidFromUrl || user.uid;
  const isMe = (targetUid === user.uid);

  // 2) Veriyi oku: kendinse /users, başkasıysa /profiles_public
  let profileSnap = null;
  try{
    const ref = isMe ? doc(db, "users", targetUid) : doc(db, "profiles_public", targetUid);
    profileSnap = await getDoc(ref);
  }catch(e){
    console.warn("[profile] profil okunamadı:", e);
  }
  const pdata = profileSnap?.exists() ? (profileSnap.data()||{}) : {};

  // 3) İsim / e-posta / şehir alanlarını doldur
  const displayNameAuth = user.displayName || user.providerData?.[0]?.displayName || "";
  const parts = displayNameAuth.trim().split(/\s+/);
  const fallbackFirst = parts.length ? (parts.slice(0, -1).join(" ") || parts[0]) : "";
  const fallbackLast  = parts.length > 1 ? parts.at(-1) : "";

  const first = pdata.firstName || (isMe ? fallbackFirst : "");
  const last  = pdata.lastName  || (isMe ? fallbackLast  : "");
  const email = isMe ? (user.email || user.providerData?.[0]?.email || "") : (pdata.emailPublic || "");
  const city  = pdata.city || "";

  fill(elFirst, first);
  fill(elLast,  last);
  fill(elMail,  email);
  fill(elCity,  city);

  // 4) Avatar
  const photo = pdata.photoURL || (isMe ? user.photoURL : "");
  if (photo) setSrc(avatarImg, photo);

  const nameUnder = $("nameUnder");
  if (nameUnder) {
    nameUnder.textContent =
      (first || last) ? `${first} ${last}`.trim() :
      (pdata.displayName || displayNameAuth || "—");
  }

  // 5) Başkasının profilindeysek düzenleme alanlarını gizle
  if (!isMe) {
    ["btnChangeAvatar","avatarFile","oldPassword","newPassword","newPassword2","btnChangePass"]
      .forEach(id => { const el = $(id); if (el) el.style.display = "none"; });
  }

  // 6) Kendi profilinde avatar & şifre event’leri
  if (isMe) {
    // Avatar değişimi
    btnChangeAvatar?.addEventListener("click", ()=> avatarFile?.click());
    avatarFile?.addEventListener("change", async ()=>{
      try{
        const f = avatarFile.files?.[0]; if (!f) return;
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        const path = `avatars/${user.uid}/${Date.now()}_${safe}`;
        const r = sref(st, path);
        await uploadBytes(r, f);
        const url = await getDownloadURL(r);
        await updateProfile(user, { photoURL: url });
        await setDoc(doc(db,"users",user.uid), { photoURL: url, updatedAt: new Date() }, { merge:true });
        setSrc(avatarImg, url);
        alert("Profil fotoğrafı güncellendi.");
      }catch(e){
        console.error("Avatar yükleme hatası:", e);
        alert("Profil fotoğrafı güncellenemedi.");
      }
    });

    // Şifre değiştirme
    window.addEventListener("change-pass-submit", async (ev)=>{
      const { old, n1, n2 } = ev.detail||{};
      try{
        if (!n1 || n1.length < 6)  throw new Error("Yeni şifre en az 6 karakter olmalı.");
        if (n1 !== n2)             throw new Error("Yeni şifreler eşleşmiyor.");

        const hasPasswordProvider = (user.providerData||[]).some(p=> (p.providerId||"").includes("password"));
        if (!hasPasswordProvider) {
          await sendPasswordResetEmail(auth, user.email);
          alert("Google ile giriş yapmışsın. Mailine şifre oluşturma bağlantısı gönderdik.");
          return;
        }
        if (!old) throw new Error("Mevcut şifreni gir.");
        const cred = EmailAuthProvider.credential(user.email, old);
        await reauthenticateWithCredential(user, cred);
        await updatePassword(user, n1);
        alert("Şifren güncellendi.");
        ["oldPassword","newPassword","newPassword2"].forEach(id=>{ const el=$(id); if(el) el.value=""; });
      }catch(e){ console.error("Şifre değiştirme hatası:", e); alert(e?.message || "Şifre güncellenemedi."); }
    });
  }

  // 7) Bu profilin ilanlarını yükle
  await loadListings(targetUid);
});

/* ==== İlanları getir & çiz (uid + ownerId) ==== */
async function loadListings(uid){
  const { liveEl, pendEl, expEl } = refs();
  if (!(liveEl && pendEl && expEl)) return;

  const colRef = collection(db, "listings");

  // ownerId alanı
  const qLive_owner    = query(colRef, where("ownerId","==",uid), where("status","==","live"));
  const qPending_owner = query(colRef, where("ownerId","==",uid), where("status","==","pending"));
  const qExpired_owner = query(colRef, where("ownerId","==",uid), where("status","==","expired"));

  // uid alanı (eski kayıtlar)
  const qLive_uid    = query(colRef, where("uid","==",uid), where("status","==","live"));
  const qPending_uid = query(colRef, where("uid","==",uid), where("status","==","pending"));
  const qExpired_uid = query(colRef, where("uid","==",uid), where("status","==","expired"));

  try{
    const [
      s1o, s2o, s3o,
      s1u, s2u, s3u
    ] = await Promise.all([
      getDocs(qLive_owner), getDocs(qPending_owner), getDocs(qExpired_owner),
      getDocs(qLive_uid),   getDocs(qPending_uid),   getDocs(qExpired_uid)
    ]);

    // Tekille
    const mergeSnaps = (...snaps)=>{
      const map = new Map();
      snaps.forEach(s => s.forEach(docu => map.set(docu.id, docu)));
      return Array.from(map.values());
    };

    const liveDocs    = mergeSnaps(s1o, s1u);
    const pendingDocs = mergeSnaps(s2o, s2u);
    const expiredDocs = mergeSnaps(s3o, s3u);

    // Doc → item (foto fallback)
    async function docsToItems(docs, status){
      return Promise.all(docs.map(async (docu)=>{
        const d = docu.data()||{};
        let photos = Array.isArray(d.photos) ? d.photos : [];
        if (!photos.length) {
          const first = await getFirstPhotoFromSub(docu.id);
          if (first) photos = [first];
        }
        return {
          id: docu.id,
          title: d.title || "İlan",
          desc:  d.description || "",
          photos,
          createdAt: d.createdAt,
          expiresAt: d.expiresAt,
          status
        };
      }));
    }

    const [liveItems, pendingItems, expiredItems] = await Promise.all([
      docsToItems(liveDocs, "live"),
      docsToItems(pendingDocs, "pending"),
      docsToItems(expiredDocs, "expired")
    ]);

    [...liveItems, ...pendingItems, ...expiredItems].forEach(window.renderListing);

  }catch(e){
    console.error("[profile] listings yüklenemedi:", e);
  }
}
