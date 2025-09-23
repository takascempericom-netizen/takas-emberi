// /profile/profile.js — Başkasının profiline bakınca foto/ad + aktif ilanlar + DM

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
const btnDM = $("btnDM");
const btnNew = $("btnNew");

/* ==== Helpers ==== */
const fill = (el,val)=>{ if(el){ el.value = val||""; } };
const setSrc = (el,src)=>{ if(el){ el.src = src || "/assets/img/seffaf.png"; } };
const fmt = (ts)=> {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
    return isNaN(d) ? "—" : d.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"});
  } catch { return "—"; }
};
const firstPhoto = (arr)=> Array.isArray(arr) && arr.length ? arr[0] : "";

/* ==== Çıkış ==== */
btnLogout?.addEventListener("click", ()=> signOut(auth).then(()=>location.href="/auth.html"));

/* ==== DM aç ==== */
async function openDirectChat(myUid, peerUid){
  try{
    const pair = [myUid, peerUid].sort();
    const chatId = `dm_${pair[0]}_${pair[1]}`;
    const chatRef = doc(db, "chats", chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) {
      await setDoc(chatRef, {
        participants: pair,
        type: "dm",
        createdAt: serverTimestamp(),
        lastMsgAt: serverTimestamp()
      });
    }
    location.href = `/messages.html?chatId=${encodeURIComponent(chatId)}&peer=${encodeURIComponent(peerUid)}`;
  }catch(e){
    console.error("Sohbet açılamadı:", e);
    alert("Sohbet açılamadı.");
  }
}

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
  const obs = new MutationObserver(()=>{ modal.style.display = modal.classList.contains('show') ? 'grid' : 'none'; });
  obs.observe(modal, { attributes:true, attributeFilter:['class'] });
}
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

  if (!container) return;

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
  mSave.style.display  = editable ? "inline-block" : "none";
  mMeta.textContent = `Oluşturma: ${fmt(data.createdAt)} • Bitiş: ${fmt(data.expiresAt)} • İlan ID: ${data.id}`;

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

/* ==== İlanları getir & çiz ==== */
async function loadListingsFor(uid, viewingSelf){
  const { liveEl, pendEl, expEl } = refs();
  if (!(liveEl && pendEl && expEl)) return;

  const colRef = collection(db, "listings");

  // Sadece başkasına bakıyorsak: yalnızca live
  if (!viewingSelf) {
    // sekmeler: sadece live kalsın
    document.querySelector(`.tab[data-tab="pending"]`)?.remove();
    document.querySelector(`.tab[data-tab="expired"]`)?.remove();
    $("tab-pending")?.remove();
    $("tab-expired")?.remove();

    const qLive_owner = query(colRef, where("ownerId","==",uid), where("status","==","live"));
    const qLive_uid   = query(colRef, where("uid","==",uid),      where("status","==","live"));

    try{
      const [s1, s2] = await Promise.all([getDocs(qLive_owner), getDocs(qLive_uid)]);
      const map = new Map();
      s1.forEach(d=>map.set(d.id,d));
      s2.forEach(d=>map.set(d.id,d));
      const docs = Array.from(map.values());

      for (const docu of docs){
        const d = docu.data()||{};
        let photos = Array.isArray(d.photos) ? d.photos : [];
        if (!photos.length) {
          const first = await getFirstPhotoFromSub(docu.id);
          if (first) photos = [first];
        }
        window.renderListing({
          id: docu.id,
          title: d.title || "İlan",
          desc:  d.description || "",
          photos,
          createdAt: d.createdAt,
          expiresAt: d.expiresAt,
          status: "live"
        });
      }
    }catch(e){ console.error("[profile] live listings yüklenemedi:", e); }
    return;
  }

  // Kendi profilimse: live + pending + expired (eski/ownerId destekli)
  const qLive_owner    = query(colRef, where("ownerId","==",uid), where("status","==","live"));
  const qPending_owner = query(colRef, where("ownerId","==",uid), where("status","==","pending"));
  const qExpired_owner = query(colRef, where("ownerId","==",uid), where("status","==","expired"));
  const qLive_uid      = query(colRef, where("uid","==",uid),     where("status","==","live"));
  const qPending_uid   = query(colRef, where("uid","==",uid),     where("status","==","pending"));
  const qExpired_uid   = query(colRef, where("uid","==",uid),     where("status","==","expired"));

  try{
    const [s1o,s2o,s3o,s1u,s2u,s3u] = await Promise.all([
      getDocs(qLive_owner), getDocs(qPending_owner), getDocs(qExpired_owner),
      getDocs(qLive_uid),   getDocs(qPending_uid),   getDocs(qExpired_uid)
    ]);

    const mergeSnaps = (...snaps)=>{ const m=new Map(); snaps.forEach(s=>s.forEach(d=>m.set(d.id,d))); return Array.from(m.values()); };

    const liveDocs    = mergeSnaps(s1o, s1u);
    const pendingDocs = mergeSnaps(s2o, s2u);
    const expiredDocs = mergeSnaps(s3o, s3u);

    async function docsToItems(docs, status){
      return Promise.all(docs.map(async (docu)=>{
        const d = docu.data()||{};
        let photos = Array.isArray(d.photos) ? d.photos : [];
        if (!photos.length) {
          const first = await getFirstPhotoFromSub(docu.id);
          if (first) photos = [first];
        }
        return { id: docu.id, title: d.title||"İlan", desc: d.description||"", photos, createdAt: d.createdAt, expiresAt: d.expiresAt, status };
      }));
    }

    const [liveItems, pendingItems, expiredItems] = await Promise.all([
      docsToItems(liveDocs, "live"),
      docsToItems(pendingDocs, "pending"),
      docsToItems(expiredDocs, "expired")
    ]);

    [...liveItems, ...pendingItems, ...expiredItems].forEach(window.renderListing);

  }catch(e){ console.error("[profile] listings yüklenemedi:", e); }
}

/* ==== Profil bilgisi doldurma ==== */
function showName(name){
  const nameUnder = $("nameUnder");
  if (nameUnder) nameUnder.textContent = name || "—";
}

/* ==== Auth + Görüntülenecek kullanıcıyı belirle ==== */
onAuthStateChanged(auth, async (me)=>{
  if (!me) { location.href = "/auth.html?next=/profile/profile.html"; return; }

  // URL ile gelen hedef profil (başkasına bakıyor olabiliriz)
  const params = new URLSearchParams(location.search);
  const targetUid = params.get("uid");
  const viewUid = (targetUid && targetUid !== me.uid) ? targetUid : me.uid;
  const viewingSelf = (viewUid === me.uid);

  // UI: DM / Yeni İlan / Avatar Değiştir görünürlüğü
  if (btnDM)  btnDM.style.display  = viewingSelf ? "none" : "";
  if (btnNew) btnNew.style.display = viewingSelf ? "" : "none";
  if (btnChangeAvatar) btnChangeAvatar.style.display = viewingSelf ? "" : "none";
  avatarFile?.setAttribute("aria-hidden", viewingSelf ? "false" : "true");

  // ---- PROFİL VERİSİ ----
  try{
    if (viewingSelf) {
      // KENDİ PROFİLİM
      const displayName = me.displayName || (me.providerData?.[0]?.displayName) || "";
      const parts = displayName.trim().split(/\s+/);
      const first = parts.length ? parts.slice(0, -1).join(" ") || parts[0] : "";
      const last  = parts.length > 1 ? parts.at(-1) : "";

      fill(elFirst, first); fill(elLast, last);
      fill(elMail,  me.email || me.providerData?.[0]?.email || "");
      if (me.photoURL) setSrc(avatarImg, me.photoURL);

      // /users kendi doc (kurallar izin veriyor)
      try{
        const snap = await getDoc(doc(db, "users", me.uid));
        if (snap.exists()) {
          const d = snap.data()||{};
          if (d.city) fill(elCity, d.city);
          if (!first && d.firstName) fill(elFirst, d.firstName);
          if (!last  && d.lastName)  fill(elLast,  d.lastName);
          if (!me.photoURL && d.photoURL) setSrc(avatarImg, d.photoURL);
          showName((d.firstName && d.lastName) ? `${d.firstName} ${d.lastName}` : (displayName || "—"));
        } else {
          showName(displayName || "—");
        }
      }catch(e){ console.warn("[profile] users doc okunamadı:", e); showName(me.displayName || "—"); }

    } else {
      // BAŞKA KULLANICININ PROFİLİ → public collection'dan oku
      try{
        const psnap = await getDoc(doc(db, "profiles_public", viewUid));
        if (psnap.exists()) {
          const p = psnap.data()||{};
          // Görünür alanlar
          if (p.photoURL) setSrc(avatarImg, p.photoURL); else setSrc(avatarImg, "");
          fill(elCity, p.city || "");
          showName(p.displayName || (p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : "—"));
        } else {
          // public profil yoksa sadece avatar fallback ve isim boş
          setSrc(avatarImg, "");
          showName("—");
        }
      }catch(e){
        console.warn("[profile] profiles_public okunamadı:", e);
        setSrc(avatarImg, ""); showName("—");
      }

      // Başkasına bakarken kişisel alanları boş/donuk bırak
      fill(elFirst, ""); fill(elLast, ""); fill(elMail, ""); // disabled zaten
    }
  }catch(e){ console.warn("[profile] profil doldurma hatası:", e); }

  // DM butonu
  btnDM?.addEventListener("click", ()=> openDirectChat(me.uid, viewUid));

  // İLANLAR
  await loadListingsFor(viewUid, viewingSelf);

  // ---- SADECE KENDİ PROFİLİM İSE: Avatar değişimi & Şifre ----
  if (viewingSelf) {
    // Avatar değişimi
    btnChangeAvatar?.addEventListener("click", ()=> avatarFile?.click());
    avatarFile?.addEventListener("change", async ()=>{
      try{
        const f = avatarFile.files?.[0]; if (!f) return;
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        const path = `avatars/${me.uid}/${Date.now()}_${safe}`;
        const r = sref(st, path);
        await uploadBytes(r, f);
        const url = await getDownloadURL(r);
        await updateProfile(me, { photoURL: url });
        await setDoc(doc(db,"users",me.uid), { photoURL: url, updatedAt: new Date() }, { merge:true });
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
        const hasPasswordProvider = (me.providerData||[]).some(p=> (p.providerId||"").includes("password"));
        if (!hasPasswordProvider) { await sendPasswordResetEmail(auth, me.email); alert("Google ile giriş yapmışsın. Mailine şifre oluşturma bağlantısı gönderdik."); return; }
        if (!old) throw new Error("Mevcut şifreni gir.");
        const cred = EmailAuthProvider.credential(me.email, old);
        await reauthenticateWithCredential(me, cred);
        await updatePassword(me, n1);
        alert("Şifren güncellendi.");
        ["oldPassword","newPassword","newPassword2"].forEach(id=>{ const el=$(id); if(el) el.value=""; });
      }catch(e){ console.error("Şifre değiştirme hatası:", e); alert(e?.message || "Şifre güncellenemedi."); }
    });
  } else {
    // Başkasının profili: modalda düzenleme/sil butonlarını devre dışı bırak (renderListing yine basar ama kullanıcı yetkisi olmayınca update denemeleri kuralda reddedilir)
    // İstersen burada card içindeki "edit/delete/renew" butonlarını runtime'da gizleyebilirsin:
    // document.querySelectorAll('.actions .btn[data-action="edit"], .actions .btn[data-action="delete"], .actions .btn[data-action="renew"]').forEach(b=> b.remove());
  }
});
