import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, getDocs, getDoc, doc, query, where, collection, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app = (()=>{ try{
  const a=getApp(); const o=a.options||{};
  if(o.projectId!=="ureten-eller-v2" || o.storageBucket!=="ureten-eller-v2.firebasestorage.app"){
    return initializeApp(cfg,"profilePageApp");
  }
  return a;
}catch{ return initializeApp(cfg,"profilePageApp"); } })();

const auth = getAuth(app);
const db   = getFirestore(app);
const st   = getStorage(app);

const $  = sel => document.querySelector(sel);
const listEl = $("#list");
const note   = $("#note");
const stat   = $("#stat");
const avatar = $("#profileAvatar");
const nameEl = $("#profileName");
const uidEl  = $("#profileUid");

const DEBUG = new URLSearchParams(location.search).has("pfdebug");
const log = (...a)=>{ if(DEBUG) console.log("[profile.page]",...a); };

const UID_RE = /^[A-Za-z0-9_-]{15,}$/;
const UNAME_RE = /^[A-Za-z0-9_.-]{3,}$/;

async function findUserBy(field, value){
  try{
    const snap = await getDocs(query(collection(db,"users"), where(field,"==",value), limit(1)));
    if(!snap.empty){
      const d = snap.docs[0];
      return { uid: d.id, ...d.data() };
    }
  }catch(e){ log("findUserBy hata", field, value, e?.message||e); }
  return null;
}

function firstTokenRe(arr, re){
  for(const s of arr){ if(s && re.test(s)) return s; }
  return null;
}

function getFromMeta(){
  const metas = [
    document.querySelector('meta[name="profile-uid"]')?.content,
    document.querySelector('meta[name="uid"]')?.content,
  ].filter(Boolean);
  return firstTokenRe(metas, UID_RE);
}
function getFromMetaUsername(){
  const metas = [
    document.querySelector('meta[name="username"]')?.content,
    document.querySelector('meta[name="profile-username"]')?.content,
  ].filter(Boolean);
  const s = metas.find(x=>x && UNAME_RE.test(x));
  return s || null;
}
function getFromDataset(){
  const cands = [
    document.querySelector("[data-profile-uid]")?.dataset?.profileUid,
    document.querySelector("[data-user-id]")?.dataset?.userId,
    document.querySelector("[data-uid]")?.dataset?.uid,
    document.querySelector("#profile-uid")?.textContent?.trim(),
  ].filter(Boolean);
  return firstTokenRe(cands, UID_RE);
}
function getFromLocalStorage(){
  try{
    const KEYS = [
      "tc_uid","uid","userUid","authUid","__uid","current_uid","firebase:uid"
    ];
    for(const k of KEYS){
      const v = localStorage.getItem(k);
      if(v && UID_RE.test(v)) return v;
    }
    // JSON saklayan anahtarlar
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i); if(!k) continue;
      const v = localStorage.getItem(k);
      if(!v) continue;
      try{
        const j = JSON.parse(v);
        const u = j?.uid || j?.user?.uid || j?.auth?.uid || j?.account?.uid;
        if(u && UID_RE.test(u)) return u;
      }catch{}
    }
  }catch{}
  return null;
}
function getFromCookie(){
  try{
    const m = document.cookie.match(/(?:^|;)\s*uid=([^;]+)/);
    if(m && UID_RE.test(decodeURIComponent(m[1]))) return decodeURIComponent(m[1]);
  }catch{}
  return null;
}
function getFromPathOrHash(){
  const toks = (location.pathname + " " + location.hash).split(/[\/#?&=]/g);
  return toks.find(t=>UID_RE.test(t)) || null;
}
function getFromUsernameInPath(){
  const toks = location.pathname.split(/[\/]/g).filter(Boolean);
  return toks.find(t=>UNAME_RE.test(t)) || null;
}

async function resolveTargetUid(){
  const usp = new URLSearchParams(location.search);
  // 1) Query param
  const byUid = usp.get("uid") || usp.get("id");
  if(byUid && UID_RE.test(byUid)) return { uid: byUid, meta: null };

  const byUser = usp.get("u") || usp.get("username");
  if(byUser && UNAME_RE.test(byUser)){
    const uu = await findUserBy("username", byUser);
    if(uu) return { uid: uu.uid, meta: uu };
  }

  const byEmail = usp.get("email");
  if(byEmail){
    const ue = await findUserBy("email", byEmail);
    if(ue) return { uid: ue.uid, meta: ue };
  }

  // 2) Meta / dataset
  const mUid = getFromMeta() || getFromDataset();
  if(mUid) return { uid: mUid, meta: null };

  const mUname = getFromMetaUsername();
  if(mUname){
    const u = await findUserBy("username", mUname);
    if(u) return { uid: u.uid, meta: u };
  }

  // 3) localStorage / cookie
  const lUid = getFromLocalStorage() || getFromCookie();
  if(lUid) return { uid: lUid, meta: null };

  // 4) path/hash içi UID ya da username
  const pUid = getFromPathOrHash();
  if(pUid) return { uid: pUid, meta: null };

  const pUser = getFromUsernameInPath();
  if(pUser){
    const u = await findUserBy("username", pUser);
    if(u) return { uid: u.uid, meta: u };
  }

  // 5) auth (varsa)
  if(auth.currentUser) return { uid: auth.currentUser.uid, meta: null };

  return { uid: null, meta: null };
}

// Görsel çözümleyici
async function resolveImageURL(d){
  const cand = [];
  for(const k of ["coverPhoto","coverUrl","cover","thumbnail","thumb","mainImage","primaryImage","image","imageUrl","photo","photoUrl"]){
    if(d?.[k]) cand.push(d[k]);
  }
  for(const k of ["photos","images","imageUrls","gallery","media","files","attachments"]){
    if(Array.isArray(d?.[k])) cand.push(...d[k]);
  }
  for (let x of cand){
    let u=null;
    if(typeof x==="string") u=x;
    else if(x && typeof x==="object") u=x.url||x.src||x.path||x.storagePath||x.downloadURL||x.downloadUrl||x.fullPath||null;
    if(!u) continue;
    if(/^https?:\/\//i.test(u)) return u;
    if(/^gs:\/\//i.test(u)){
      const pathOnly=u.replace(/^gs:\/\/[^/]+\//i,"");
      try{ return await getDownloadURL(ref(st, pathOnly)); }catch{}
    }
    try{ return await getDownloadURL(ref(st, u)); }catch{}
  }
  return null;
}

function cardTpl(item){
  const safeTitle = (item.title || "-");
  const price = (item.price != null) ? `${item.price}₺` : "";
  const loc = [item.city, item.district].filter(Boolean).join(" / ");
  return `
    <div class="listing-card" data-doc-id="${item.id}">
      <div class="ph"><img alt="${safeTitle}" loading="lazy" decoding="async"></div>
      <div class="body">
        <h3 class="title">${safeTitle}</h3>
        <div class="muted">${loc || ""}</div>
        <div class="muted">${price}</div>
      </div>
    </div>`;
}

async function renderListings(uid){
  listEl.innerHTML = "";
  note.style.display = "block";
  note.textContent = "İlanlar yükleniyor…";

  const snap = await getDocs(query(collection(db,"listings"), where("ownerId","==",uid), limit(120)));
  if(snap.empty){
    listEl.innerHTML = "";
    note.textContent = "Bu kullanıcıya ait ilan bulunamadı.";
    stat.textContent = "0 ilan";
    log("no listings for", uid);
    return;
  }

  const items = [];
  for (const docu of snap.docs){
    const d = docu.data();
    items.push({ id: docu.id, title: d.title||"", price: d.price??null, city: d.city||"", district: d.district||"", _raw:d });
  }

  listEl.innerHTML = items.map(cardTpl).join("");
  let ok=0, fail=0;
  const cards = Array.from(listEl.querySelectorAll(".listing-card"));
  for (const el of cards){
    const id = el.getAttribute("data-doc-id");
    const item = items.find(x=>x.id===id);
    const url = await resolveImageURL(item?._raw);
    if(url){
      const img = el.querySelector("img");
      img.src = url; img.srcset = url; img.referrerPolicy="no-referrer";
      ok++;
    } else {
      fail++;
    }
  }
  note.style.display="none";
  stat.textContent = `${items.length} ilan • ${ok} görsel yüklendi${fail?`, ${fail} eksik görsel`:``}`;
  log("loaded", {total:items.length, ok, fail});
}

async function loadUserMeta(uid, metaHint=null){
  try{
    const snap = await getDoc(doc(db,"users",uid));
    const data = snap.exists()? snap.data() : (metaHint||{});
    const display = data.displayName || data.username || data.email || "Profil";
    const photo   = data.photoURL || data.avatar || auth.currentUser?.photoURL || "https://i.imgur.com/3SgkGmQ.png";
    avatar.src = photo;
    nameEl.textContent = display;
    uidEl.textContent  = uid;
  }catch(e){
    log("loadUserMeta hata",e?.message||e);
    avatar.src = "https://i.imgur.com/3SgkGmQ.png";
    nameEl.textContent = "Profil";
    uidEl.textContent  = uid;
  }
}

async function start(){
  $("#btnRefresh").onclick = ()=>start();
  const { uid, meta } = await resolveTargetUid();

  if(!uid){
    listEl.innerHTML = "";
    note.style.display = "block";
    note.textContent = "Bir profil göstermek için URL’ye ?uid=<kullanıcıUid> veya ?u=<kullanıcıAdı> ekleyin.";
    stat.textContent = "—";
    avatar.src = "https://i.imgur.com/3SgkGmQ.png";
    nameEl.textContent = "Profil";
    uidEl.textContent  = "— oturum yok —";
    log("no uid; not found in params/meta/dataset/localStorage/cookie/path");
    return;
  }

  await loadUserMeta(uid, meta);
  await renderListings(uid);
}

onAuthStateChanged(auth, ()=>start());
document.addEventListener("DOMContentLoaded", ()=>start());
