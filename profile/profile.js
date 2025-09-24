// profile/profile.js — GÜNCEL TAM SÜRÜM
// - Başkasının profiline bakıldığında: isim, şehir, avatar ve (görülebilen) ilanlar listelenir.
// - Kendi profilinde: avatar değişimi, şifre değiştirme, ilan yönetimi (incele/düzenle/sil/yenile).
// - DM (Mesaj yaz) butonu: yalnız başkasının profilinde görünür, sohbeti oluşturup messages.html’e yönlendirir.
// - Destek (Support) butonu: support_{uid} sohbetini açar (HTML’de id="btnSupport" varsa).

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
// Not: ikinci parametre bucket URL’i; projende bu şekilde kullanılmıyorsa getStorage(app) kullan.
const st   = getStorage(app, "gs://ureten-eller-v2.firebasestorage.app");

/* ==== UI refs & helpers ==== */
const $ = (id)=>document.getElementById(id);
const fill  = (el,val)=>{ if(el){ el.value = val||""; } };
const setSrc= (el,src)=>{ if(el && src){ el.src = src; } };
const showName = (name)=>{ const el=$("nameUnder"); if(el) el.textContent = name || "—"; };
const fmt = (ts)=> {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
    return isNaN(d) ? "—" : d.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"});
  } catch { return "—"; }
};
const firstPhoto = (arr)=> Array.isArray(arr) && arr.length ? arr[0] : "";

/* ==== DOM elemanları ==== */
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
const btnSupport = $("btnSupport");

/* ==== Çıkış ==== */
btnLogout?.addEventListener("click", ()=> signOut(auth).then(()=>location.href="/auth.html"));

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
let PROFILE_VIEWING_SELF = true; // onAuthStateChanged içinde set edilecek

function renderListingItem(item){
  // Hangi liste?
  const liveEl = $("tab-live");
  const pendEl = $("tab-pending");
  const expEl  = $("tab-expired");
  const container =
    item.status === "live"    ? liveEl :
    item.status === "pending" ? pendEl : expEl;
  if (!container) return;

  const img = firstPhoto(item.photos) || "";
  const card = document.createElement("div");
  card.className = "item";
  card.dataset.id = item.id;
  card.dataset.status = item.status;

  // Yönetim aksiyonları sadece KENDİ profilimde
  let actions = "";
  if (PROFILE_VIEWING_SELF) {
    if (item.status === "live") {
      actions = `
        <button class="btn sm" data-action="view">İncele</button>
        <button class="btn sm" data-action="edit">Düzenle</button>
        <button class="btn sm danger" data-action="delete">Sil</button>
      `;
    } else if (item.status === "pending") {
      actions = `
        <button class="btn sm" data-action="view">İncele</button>
        <button class="btn sm danger" data-action="delete">Sil</button>
      `;
    } else {
      actions = `
        <button class="btn sm" data-action="renew">Süre Al</button>
        <button class="btn sm danger" data-action="delete">Sil</button>
      `;
    }
  } else {
    // Başkasının profili: sadece incele linki (ilan sayfasına)
    actions = `
      <a class="btn sm" href="/ilan/index.html?id=${encodeURIComponent(item.id)}">İncele</a>
    `;
  }

  card.innerHTML = `
    <div class="thumb" style="${img ? `background-image:url('${img}')` : ''}"></div>
    <div class="meta">
      <strong>${item.title || "İlan"}</strong>
      <div class="muted">${item.desc || ""}</div>
      <div class="muted">Oluşturma: ${fmt(item.createdAt)} ${item.expiresAt ? `• Bitiş: ${fmt(item.expiresAt)}` : ""}</div>
      <span class="badge ${item.status}">
        ${item.status === "live" ? "Yayında" : item.status === "pending" ? "Onay Bekliyor" : "Süresi Doldu"}
      </span>
    </div>
    <div class="actions">${actions}</div>
  `;
  container.appendChild(card);
}

/* ==== Modal doldur / aç-kapat ==== */
function fillModal(data, editable=false){
  const mTitle = $("mTitle");
  const mStatus= $("mStatus");
  const mPhoto = $("mPhoto");
  const mInputTitle = $("mInputTitle");
  const mInputDesc  = $("mInputDesc");
  const mMeta  = $("mMeta");
  const mSave  = $("mSave");

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

  $("mClose")?.addEventListener("click", ()=> $("listingModal")?.classList.remove("show"), { once:true });
}
function openModal(){ $("listingModal")?.classList.add("show"); }

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

  const mSave = $("mSave");
  if (mSave) {
    mSave.onclick = async ()=>{
      try{
        await updateDoc(doc(db,"listings",id), {
          title: $("mInputTitle").value.trim(),
          description: $("mInputDesc").value.trim(),
          updatedAt: serverTimestamp()
        });
        alert("İlan güncellendi.");
        $("listingModal")?.classList.remove("show");
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

/* ==== Liste alanları: event delegation (sadece kendi profilimde yönetim var) ==== */
["tab-live","tab-pending","tab-expired"].forEach(listId=>{
  const root = $(listId);
  root?.addEventListener("click",(ev)=>{
    if (!PROFILE_VIEWING_SELF) return; // başkasının profilinde yönetim yok
    const btn = ev.target.closest("button[data-action]"); if (!btn) return;
    const card = btn.closest(".item"); const id = card?.dataset.id; const action = btn.dataset.action; if (!id) return;
    if (action === "view")  viewListing(id, false);
    if (action === "edit")  viewListing(id, true);
    if (action === "delete") deleteListing(id);
    if (action === "renew") renewListing(id);
  });
});

/* ==== İlanları getir & çiz (uid + ownerId) ==== */
async function loadListings(uid){
  const liveEl = $("tab-live"), pendEl=$("tab-pending"), expEl=$("tab-expired");
  if (!(liveEl && pendEl && expEl)) return;

  // Liste alanlarını temizle
  liveEl.innerHTML = ""; pendEl.innerHTML = ""; expEl.innerHTML = "";

  const colRef = collection(db, "listings");

  const qLive_owner    = query(colRef, where("ownerId","==",uid), where("status","==","live"));
  const qPending_owner = query(colRef, where("ownerId","==",uid), where("status","==","pending"));
  const qExpired_owner = query(colRef, where("ownerId","==",uid), where("status","==","expired"));

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

    // Tekilleştir
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

    PROFILE_VIEWING_SELF
      ? [...liveItems, ...pendingItems, ...expiredItems].forEach(renderListingItem)
      : liveItems.forEach(renderListingItem); // başkasında yalnızca live göstermek anlamlı

  }catch(e){
    console.error("[profile] listings yüklenemedi:", e);
  }
}

/* ==== Support (Destek) sohbeti ==== */
btnSupport?.addEventListener("click", async ()=>{
  const me = auth.currentUser;
  if (!me) { location.href = "/auth.html?next=/messages.html?support=1"; return; }
  try{
    const chatId = `support_${me.uid}`;
    await setDoc(
      doc(db, "chats", chatId),
      { participants: [me.uid], type: "support", createdAt: serverTimestamp(), lastMsgAt: serverTimestamp() },
      { merge: true }
    );
    location.href = `/messages.html?chatId=${encodeURIComponent(chatId)}&support=1`;
  }catch(e){
    console.error("Support sohbeti açılamadı:", e);
    alert("Sohbet açılamadı.");
  }
});

/* ==== Şifre değiştirme (HTML bu eventi fırlatıyor) ==== */
window.addEventListener("change-pass-submit", async (ev)=>{
  const me = auth.currentUser;
  if (!me) { alert("Önce giriş yap."); return; }
  const { old, n1, n2 } = ev.detail||{};
  try{
    if (!n1 || n1.length < 6)  throw new Error("Yeni şifre en az 6 karakter olmalı.");
    if (n1 !== n2)             throw new Error("Yeni şifreler eşleşmiyor.");

    const hasPasswordProvider = (me.providerData||[]).some(p=> (p.providerId||"").includes("password"));
    if (!hasPasswordProvider) {
      await sendPasswordResetEmail(auth, me.email);
      alert("Google ile giriş yapmışsın. Mailine şifre oluşturma bağlantısı gönderdik.");
      return;
    }

    if (!old) throw new Error("Mevcut şifreni gir.");
    const cred = EmailAuthProvider.credential(me.email, old);
    await reauthenticateWithCredential(me, cred);
    await updatePassword(me, n1);
    alert("Şifren güncellendi.");
    ["oldPassword","newPassword","newPassword2"].forEach(id=>{ const el=$(id); if(el) el.value=""; });
  }catch(e){ console.error("Şifre değiştirme hatası:", e); alert(e?.message || "Şifre güncellenemedi."); }
});

/* ==== Auth + Görüntülenecek kullanıcıyı belirle ==== */
onAuthStateChanged(auth, async (me)=>{
  if (!me) { location.href = "/auth.html?next=/profile/profile.html"; return; }

  const urlUid  = new URLSearchParams(location.search).get('uid'); // ?uid=...
  const myUid   = me.uid;
  const viewUid = urlUid || myUid;
  PROFILE_VIEWING_SELF = (viewUid === myUid);

  // UI görünürlükleri
  btnDM?.style.setProperty('display', PROFILE_VIEWING_SELF ? 'none' : 'inline-block');
  btnNew?.style.setProperty('display', PROFILE_VIEWING_SELF ? 'inline-block' : 'none');
  btnChangeAvatar?.style.setProperty('display', PROFILE_VIEWING_SELF ? 'inline-block' : 'none');
  if (!PROFILE_VIEWING_SELF) avatarFile?.setAttribute('disabled','disabled'); else avatarFile?.removeAttribute('disabled');

  // DM aç (sadece başkasının profili)
  btnDM?.addEventListener('click', async ()=>{
    try{
      const pair = [myUid, viewUid].sort();
      const chatId = `dm_${pair[0]}_${pair[1]}`;
      await setDoc(
        doc(db, "chats", chatId),
        { participants: pair, type: "dm", createdAt: serverTimestamp(), lastMsgAt: serverTimestamp() },
        { merge: true }
      );
      location.href = `/messages.html?chatId=${encodeURIComponent(chatId)}&peer=${encodeURIComponent(viewUid)}`;
    }catch(e){
      console.error("DM açılamadı:", e);
      alert("Sohbet açılamadı.");
    }
  }, { once:true });

  // Kendi temel bilgilerini doldur (kendi profilinde)
  if (PROFILE_VIEWING_SELF) {
    const displayName = me.displayName || (me.providerData?.[0]?.displayName) || '';
    const parts = displayName.trim().split(/\s+/);
    const first = parts.length ? parts.slice(0,-1).join(' ') || parts[0] : '';
    const last  = parts.length > 1 ? parts.at(-1) : '';
    fill(elFirst, first);
    fill(elLast,  last);
    fill(elMail,  me.email || me.providerData?.[0]?.email || '');
    if (me.photoURL) setSrc(avatarImg, me.photoURL);
  }

  // Profil verisi (public → users fallback)
  try{
    let prof = null;
    const pubSnap = await getDoc(doc(db, "profiles_public", viewUid));
    if (pubSnap.exists()) prof = pubSnap.data();
    else if (PROFILE_VIEWING_SELF) {
      const userSnap = await getDoc(doc(db, "users", viewUid));
      if (userSnap.exists()) prof = userSnap.data();
    }

    if (prof) {
      if (PROFILE_VIEWING_SELF) {
        const nameUnder = $("nameUnder");
        const displayName = (prof.firstName && prof.lastName) ? `${prof.firstName} ${prof.lastName}` : (auth.currentUser?.displayName || "—");
        if (nameUnder) nameUnder.textContent = displayName;
        if (!auth.currentUser?.photoURL && prof.photoURL) setSrc(avatarImg, prof.photoURL);
        if (prof.city && elCity) fill(elCity, prof.city);
      } else {
        showName( (prof.firstName && prof.lastName) ? `${prof.firstName} ${prof.lastName}` : prof.displayName || prof.username || "—" );
        if (prof.photoURL) setSrc(avatarImg, prof.photoURL);
        if (elCity) fill(elCity, prof.city || "");
      }
    }
  }catch(e){
    console.warn("[profile] profil okunamadı:", e);
  }

  // Avatar değişimi (sadece kendi profilim)
  if (PROFILE_VIEWING_SELF) {
    btnChangeAvatar?.addEventListener("click", ()=> avatarFile?.click());
    avatarFile?.addEventListener("change", async ()=>{
      try{
        const f = avatarFile.files?.[0]; if (!f) return;
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        const path = `avatars/${myUid}/${Date.now()}_${safe}`;
        const r = sref(st, path);
        await uploadBytes(r, f);
        const url = await getDownloadURL(r);
        await updateProfile(me, { photoURL: url });
        await setDoc(doc(db,"users",myUid), { photoURL: url, updatedAt: new Date() }, { merge:true });
        setSrc(avatarImg, url);
        alert("Profil fotoğrafı güncellendi.");
      }catch(e){
        console.error("Avatar yükleme hatası:", e);
        alert("Profil fotoğrafı güncellenemedi.");
      }
    });
  }

  // İlanları yükle (başkasının profilinde yalnızca 'live' olanlar dönecektir)
  await loadListings(viewUid);
});
