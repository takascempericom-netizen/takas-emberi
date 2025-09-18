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

// Yanlış app başlatılmışsa ayrı isimle temiz başlat
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

const $ = sel => document.querySelector(sel);
const listEl = $("#list");
const note   = $("#note");
const stat   = $("#stat");
const avatar = $("#profileAvatar");
const nameEl = $("#profileName");
const uidEl  = $("#profileUid");

const DEBUG = new URLSearchParams(location.search).has("pfdebug");
const log = (...a)=>{ if(DEBUG) console.log("[profile.page]",...a); };

// ---- Yardımcılar ----
async function findUserBy(field, value){
  try{
    const snap = await getDocs(query(collection(db,"users"), where(field,"==",value), limit(1)));
    if(!snap.empty){
      const d = snap.docs[0];
      return { uid: d.id, ...d.data() };
    }
  }catch(e){ log("findUserBy hata", field, e?.message||e); }
  return null;
}

async function resolveTargetUid(){
  const usp = new URLSearchParams(location.search);
  // 1) uid/id parametresi
  const pid = usp.get("uid") || usp.get("id");
  if(pid && /^[\w-]{10,}$/.test(pid)) return { uid: pid, meta: null };

  // 2) username (u / username)
  const uname = usp.get("u") || usp.get("username");
  if(uname){
    const byU = await findUserBy("username", uname);
    if(byU) return { uid: byU.uid, meta: byU };
  }

  // 3) email
  const email = usp.get("email");
  if(email){
    const byE = await findUserBy("email", email);
    if(byE) return { uid: byE.uid, meta: byE };
  }

  // 4) oturum varsa kendisi
  if(auth.currentUser) return { uid: auth.currentUser.uid, meta: null };

  // 5) yoksa null
  return { uid: null, meta: null };
}

// Her türlü alanı çöz: coverPhoto/coverUrl/thumbnail/photos/... -> mutlak URL
async function resolveImageURL(d){
  const cand = [];
  // Öncelikler: cover alanları
  for(const k of ["coverPhoto","coverUrl","cover","thumbnail","thumb","mainImage","primaryImage","image","imageUrl","photo","photoUrl"]){
    if(d?.[k]) cand.push(d[k]);
  }
  // Galeri dizileri
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
    // oturum zorunlu değil; fakat hedef belirtemiyorsak yönlendirme mesajı
    listEl.innerHTML = "";
    note.style.display = "block";
    note.textContent = "Bir profil göstermek için URL’ye ?uid=<kullanıcıUid> veya ?u=<kullanıcıAdı> ekleyin.";
    stat.textContent = "—";
    avatar.src = "https://i.imgur.com/3SgkGmQ.png";
    nameEl.textContent = "Profil";
    uidEl.textContent  = "— oturum yok —";
    log("no uid; waiting for param or login");
    return;
  }

  await loadUserMeta(uid, meta);
  await renderListings(uid);
}

// Hem oturum değişiminde hem ilk yükte çalıştır
onAuthStateChanged(auth, ()=>start());
document.addEventListener("DOMContentLoaded", ()=>start());
