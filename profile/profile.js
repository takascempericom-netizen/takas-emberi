// profile/profile.js — GÜNCEL SÜRÜM
// - ?uid=... ile başka kullanıcının profiline bakma
// - Kendi profilinde: +Yeni İlan, avatar değiştir, ilan yönet (incele/düzenle/sil/süre al)
// - Başkasının profilinde: ad/eposta/foto, aktif ilanlar, Mesaj yaz, Şikayet et
// - Puanlama: profil kartında yıldızlar. Başkasına 1 kez oy (doc id = rater uid).
//   Not: Firestore rules tarafında ratings okuma + tek oy kuralı tanımlı olmalı.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs,
  updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref as sref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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

const btnNew    = $("btnNew");    // + Yeni İlan
const btnDM     = $("btnDM");     // Mesaj yaz
const btnReport = $("btnReport"); // Şikayet et
// btnRate kaldırıldı (artık kullanılmıyor)

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

/* ==== Modal refs ==== */
function mrefs(){
  return {
    modal: $("listingModal"),
    mTitle: $("mTitle"), mStatus: $("mStatus"), mPhoto: $("mPhoto"),
    mInputTitle: $("mInputTitle"), mInputDesc: $("mInputDesc"),
    mMeta: $("mMeta"), mSave: $("mSave"), mClose: $("mClose"),
    liveEl: $("tab-live"), pendEl: $("tab-pending"), expEl: $("tab-expired"),
  };
}
function openModal(){ mrefs().modal?.classList.add("show"); }
function closeModal(){ mrefs().modal?.classList.remove("show"); }
$("mClose")?.addEventListener("click", closeModal);

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

/* ==== Rating (okuma) ==== */
async function loadRating(uid){
  const starsEl = $("rating");
  const numEl   = $("ratingNum");
  if (starsEl) starsEl.innerHTML = "";
  if (numEl)   numEl.textContent = "—";

  try{
    const votesCol = collection(db, "ratings", uid, "votes");
    const snap = await getDocs(votesCol);
    let sum = 0, n = 0;
    snap.forEach(d=>{
      const x = d.data()?.stars;
      const v = parseInt(x,10);
      if(!isNaN(v)) { sum += v; n += 1; }
    });
    const avg = n ? (sum/n) : 0;

    if (starsEl){
      const full = Math.round(avg);
      for(let i=1;i<=5;i++){
        const s = document.createElement("span");
        s.textContent = i<=full ? "★" : "☆";
        // 3D görünüm için hafif gölge
        s.style.cssText="font-size:22px;color:#f59e0b;text-shadow:0 1px 0 #fff,0 2px 0 #d1a000,0 3px 6px rgba(0,0,0,.15)";
        starsEl.appendChild(s);
      }
    }
    if (numEl){
      numEl.textContent = `${avg.toFixed(1)} / 5 (${n} oy)`;
    }
  }catch(e){
    console.warn("[rating] okunamadı:", e);
    // Yetki yoksa boş 5 yıldız göster
    if ($("rating")){
      for(let i=1;i<=5;i++){
        const s = document.createElement("span");
        s.textContent = "☆";
        s.style.cssText="font-size:22px;color:#cbd5e1;text-shadow:0 1px 0 #fff";
        $("rating").appendChild(s);
      }
    }
    if ($("ratingNum")) $("ratingNum").textContent = "—";
  }
}

/* ==== Rating (etkileşimli; yalnız başkasının profili ve daha önce oy vermediyse) ==== */
async function setupInteractiveRating(viewUid, myUid){
  const starsEl = $("rating"); const numEl = $("ratingNum");
  if (!starsEl) return;

  // Kendi profili değil + girişli olmalı
  if (!myUid || myUid === viewUid) return;

  // Daha önce oy vermiş mi?
  let voted = false;
  try{
    const myVote = await getDoc(doc(db, "ratings", viewUid, "votes", myUid));
    voted = myVote.exists();
  }catch(e){
    // Okuma yetkin yoksa etkileşimli yapmayalım
    voted = true;
  }
  if (voted) return; // Etkileşim yok; sadece ortalama görünsün

  // Etkileşimli 5 yıldız hazırlığı
  starsEl.innerHTML = "";
  const spans = [];
  for (let i=1;i<=5;i++){
    const sp = document.createElement("span");
    sp.textContent = "☆";
    sp.dataset.val = String(i);
    sp.style.cssText = "font-size:26px;cursor:pointer;transition:transform .12s;text-shadow:0 1px 0 #fff,0 2px 0 #d1a000,0 3px 6px rgba(0,0,0,.15)";
    sp.onmouseenter = ()=> highlight(i);
    sp.onmouseleave = ()=> {/* no-op; mouseout'ta eski ortalamayı loadRating resetleyecek */};
    sp.onclick = rate;
    spans.push(sp); starsEl.appendChild(sp);
  }
  function highlight(v){
    spans.forEach((s,idx)=> s.textContent = (idx < v) ? "★" : "☆");
  }
  async function rate(ev){
    const v = parseInt(ev.currentTarget?.dataset?.val||"0",10);
    if (!v) return;
    try{
      // Sadece ilk kez oy: kurallar create-only ise merge:false
      await setDoc(
        doc(db, "ratings", viewUid, "votes", myUid),
        { stars: v, createdAt: serverTimestamp() }, { merge: false }
      );
      starsEl.style.pointerEvents = "none";
      if (numEl) numEl.textContent = (numEl.textContent||"") + " • oyun kaydedildi";
      await loadRating(viewUid);
    }catch(e){
      console.error("Oy verilemedi:", e);
      alert("Oy verilemedi.");
      await loadRating(viewUid);
    }
  }
}

/* ==== Kart render ==== */
let VIEWING_SELF = false;
window.renderListing = (item) => {
  const { liveEl, pendEl, expEl } = mrefs();
  const container = VIEWING_SELF
    ? (item.status === "live" ? liveEl : item.status === "pending" ? pendEl : expEl)
    : liveEl;
  if (!container) return;

  const img = firstPhoto(item.photos) || "";
  const card = document.createElement("div");
  card.className = "item";
  card.dataset.id = item.id;
  card.dataset.status = item.status;

  const baseActions = VIEWING_SELF
    ? (item.status === "live"
        ? `<button class="btn sm" data-action="edit">Düzenle</button>
           <button class="btn sm danger" data-action="delete">Sil</button>`
        : item.status === "pending"
          ? ``
          : `<button class="btn sm" data-action="renew">Süre Al</button>
             <button class="btn sm danger" data-action="delete">Sil</button>`)
    : ``;

  card.innerHTML = `
    <div class="thumb" style="${img ? `background-image:url('${img}')` : ''}"></div>
    <div class="meta">
      <strong>${item.title || "İlan"}</strong>
      <div class="muted">${item.desc || item.description || ""}</div>
      <div class="muted">Oluşturma: ${fmt(item.createdAt)}${item.expiresAt ? " • Bitiş: "+fmt(item.expiresAt) : ""}</div>
      <span class="badge ${item.status}">
        ${item.status === "live" ? "Yayında" : item.status === "pending" ? "Onay Bekliyor" : "Süresi Doldu"}
      </span>
    </div>
    <div class="actions">
      <button class="btn sm" data-action="view">İncele</button>
      ${baseActions}
    </div>
  `;
  container.appendChild(card);
};

/* ==== Modal doldur ==== */
function fillModal(data, editable=false){
  const { mTitle, mStatus, mPhoto, mInputTitle, mInputDesc, mMeta, mSave } = mrefs();
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
  if (mMeta) mMeta.textContent = `Oluşturma: ${fmt(data.createdAt)}${data.expiresAt ? " • Bitiş: "+fmt(data.expiresAt) : ""} • İlan ID: ${data.id}`;
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

  const { mSave } = mrefs();
  if (mSave && editable) {
    mSave.onclick = async ()=>{
      try{
        await updateDoc(doc(db,"listings",id), {
          title: $("mInputTitle").value.trim(),
          description: $("mInputDesc").value.trim(),
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
    if (!VIEWING_SELF) return;
    if (action === "edit")  viewListing(id, true);
    if (action === "delete") deleteListing(id);
    if (action === "renew") renewListing(id);
  });
});

/* ==== İlanları getir & çiz ==== */
async function loadListings(uid){
  const { liveEl, pendEl, expEl } = mrefs();
  if (!(liveEl && pendEl && expEl)) return;
  const colRef = collection(db, "listings");

  // Başkasının profili → sadece 'live'
  if (!VIEWING_SELF) {
    const q1 = query(colRef, where("ownerId","==",uid), where("status","==","live"));
    const q2 = query(colRef, where("uid","==",uid),      where("status","==","live"));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const map = new Map();
    s1.forEach(d=>map.set(d.id,d)); s2.forEach(d=>map.set(d.id,d));
    const docs = Array.from(map.values());

    for (const docu of docs) {
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
    return;
  }

  // Kendi profili → live/pending/expired
  const qLive_owner    = query(colRef, where("ownerId","==",uid), where("status","==","live"));
  const qPending_owner = query(colRef, where("ownerId","==",uid), where("status","==","pending"));
  const qExpired_owner = query(colRef, where("ownerId","==",uid), where("status","==","expired"));

  const qLive_uid    = query(colRef, where("uid","==",uid), where("status","==","live"));
  const qPending_uid = query(colRef, where("uid","==",uid), where("status","==","pending"));
  const qExpired_uid = query(colRef, where("uid","==",uid), where("status","==","expired"));

  try{
    const [s1o,s2o,s3o,s1u,s2u,s3u] = await Promise.all([
      getDocs(qLive_owner),   getDocs(qPending_owner),   getDocs(qExpired_owner),
      getDocs(qLive_uid),     getDocs(qPending_uid),     getDocs(qExpired_uid)
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

/* ==== Auth + Görüntülenecek kullanıcı ==== */
onAuthStateChanged(auth, async (me)=>{
  if (!me) { location.href = "/auth.html?next=/profile/profile.html"; return; }

  const params  = new URLSearchParams(location.search);
  const urlUid  = params.get("uid");
  const myUid   = me.uid;
  const viewUid = (urlUid && urlUid !== myUid) ? urlUid : myUid;
  VIEWING_SELF  = (viewUid === myUid);

  // Üst bar görünürlük
  if (VIEWING_SELF) {
    btnDM?.style.setProperty('display','none');
    btnReport?.style.setProperty('display','none');
    btnNew?.style.setProperty('display','inline-block');
    btnChangeAvatar?.style.setProperty('display','inline-block');
  } else {
    btnDM?.style.setProperty('display','inline-block');
    btnReport?.style.setProperty('display','inline-block');
    btnNew?.style.setProperty('display','none');
    btnChangeAvatar?.style.setProperty('display','none');
  }

  // DM (sadece başkasının profili)
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
  });

  // Şikayet et
  btnReport?.addEventListener('click', async ()=>{
    const why = prompt("Şikayet nedeniniz:", "");
    if (!why) return;
    try{
      await setDoc(
        doc(collection(db, "complaints")),
        { targetUid: viewUid, fromUid: myUid, reason: why.trim(), status: "open", createdAt: serverTimestamp() }
      );
      alert("Şikayetin alındı.");
    }catch(e){
      console.error("Şikayet iletilemedi:", e);
      alert("Şikayet iletilemedi (izin?).");
    }
  });

  // Kendi temel bilgileri doldur
  if (VIEWING_SELF) {
    const displayName = me.displayName || (me.providerData?.[0]?.displayName) || '';
    const parts = displayName.trim().split(/\s+/);
    const first = parts.length ? (parts.slice(0,-1).join(' ') || parts[0]) : '';
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
    else if (VIEWING_SELF) {
      const userSnap = await getDoc(doc(db, "users", viewUid));
      if (userSnap.exists()) prof = userSnap.data();
    }

    if (prof) {
      const dispName =
        (prof.firstName && prof.lastName) ? `${prof.firstName} ${prof.lastName}` :
        prof.displayName || prof.username || "";
      const nameUnder = $("nameUnder");
      if (nameUnder) nameUnder.textContent = dispName || (VIEWING_SELF ? (auth.currentUser?.displayName || "—") : "—");

      if (prof.photoURL && !VIEWING_SELF) setSrc(avatarImg, prof.photoURL);
      if (prof.city && elCity) fill(elCity, prof.city);
      if (!VIEWING_SELF && elMail) fill(elMail, prof.email || "");
    }
  }catch(e){
    console.warn("[profile] profil okunamadı:", e);
  }

  // Avatar değişimi (sadece kendi profilimde)
  if (VIEWING_SELF) {
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

  // Puanı yükle + (başkasına bakıyorsak) etkileşimli yıldızları hazırla
  await loadRating(viewUid);
  await setupInteractiveRating(viewUid, myUid);

  // İlanları yükle
  await loadListings(viewUid);
});
