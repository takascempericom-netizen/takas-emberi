import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, getDocs, query, where, collection, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

// Başka bir sayfa yanlış app başlattıysa ayrı isimle temiz başlat
const app = (()=>{ try{ const a=getApp(); const o=a.options||{};
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

const DEBUG = new URLSearchParams(location.search).has("pfdebug");
const log = (...a)=>{ if(DEBUG) console.log("[profile.page]",...a); };

// Her türlü alanı çöz: coverPhoto/coverUrl/thumbnail/photos/... -> mutlak URL
async function resolveImageURL(d){
  const cand = [];

  // Öncelikler: cover alanları
  if (d?.coverPhoto) cand.push(d.coverPhoto);
  if (d?.coverUrl)   cand.push(d.coverUrl);
  if (d?.cover)      cand.push(d.cover);
  if (d?.thumbnail)  cand.push(d.thumbnail);
  if (d?.thumb)      cand.push(d.thumb);

  // Galeri dizileri
  if (Array.isArray(d?.photos))    cand.push(...d.photos);
  if (Array.isArray(d?.images))    cand.push(...d.images);
  if (Array.isArray(d?.imageUrls)) cand.push(...d.imageUrls);
  if (Array.isArray(d?.gallery))   cand.push(...d.gallery);
  if (Array.isArray(d?.media))     cand.push(...d.media);

  for (let x of cand){
    let u = null;
    if (typeof x === "string") u = x;
    else if (x && typeof x === "object") u = x.url || x.src || x.path || x.storagePath || null;
    if (!u) continue;

    // HTTP ise direkt kullan
    if (/^https?:\/\//i.test(u)) return u;

    // gs://bucket/path -> sadece path kısmını al, kendi bucket'tan indir
    if (/^gs:\/\//i.test(u)) {
      const pathOnly = u.replace(/^gs:\/\/[^/]+\//i, "");
      try { return await getDownloadURL(ref(st, pathOnly)); } catch {}
    }

    // çıplak storage path ise doğrudan indir
    try { return await getDownloadURL(ref(st, u)); } catch {}
  }
  return null; // hiçbirini çözemedi
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

  const qy = query(collection(db,"listings"), where("ownerId","==",uid), limit(120));
  const snap = await getDocs(qy);

  if (snap.empty) {
    listEl.innerHTML = "";
    note.textContent = "Bu kullanıcıya ait ilan bulunamadı.";
    stat.textContent = "0 ilan";
    return;
  }

  const items = [];
  for (const docu of snap.docs){
    const d = docu.data();
    items.push({ id: docu.id, title: d.title||"", price: d.price||null, city: d.city||"", district: d.district||"", _raw: d });
  }

  // kartları ekle
  const html = items.map(cardTpl).join("");
  listEl.innerHTML = html;

  // görselleri sırayla çöz
  let okCount = 0, failCount = 0;
  const cards = Array.from(listEl.querySelectorAll(".listing-card"));
  for (const el of cards){
    const id = el.getAttribute("data-doc-id");
    const item = items.find(x=>x.id===id);
    let url = await resolveImageURL(item?._raw);
    if (!url) {
      // fallback yok: boş bırak (yanlış resim çekmeyeceğiz)
      failCount++;
      continue;
    }
    const img = el.querySelector("img");
    img.src = url;
    img.srcset = url;
    img.referrerPolicy = "no-referrer";
    okCount++;
  }

  note.style.display = "none";
  stat.textContent = `${items.length} ilan • ${okCount} görsel yüklendi${failCount?`, ${failCount} eksik görsel`:``}`;
  log("loaded", { total: items.length, okCount, failCount });
}

function detectProfileUid(){
  const usp = new URLSearchParams(location.search);
  const q = usp.get("uid");
  if (q && /^[\w-]{10,}$/.test(q)) return q;

  // sayfada veri varsa
  const el = document.querySelector("[data-profile-uid],[data-user-id],[data-uid],#profile-uid,meta[name='profile-uid']");
  const v = el?.dataset?.profileUid || el?.dataset?.userId || el?.dataset?.uid || el?.content || el?.textContent;
  if (v && /^[\w-]{10,}$/.test(v.trim())) return v.trim();

  return null;
}

async function bootstrap(){
  const avatar = document.getElementById("profileAvatar");
  const nameEl = document.getElementById("profileName");
  const uidEl  = document.getElementById("profileUid");

  document.getElementById("btnRefresh").onclick = ()=>bootstrap();

  let targetUid = detectProfileUid();

  onAuthStateChanged(auth, async (user) => {
    // Header bilgileri
    if (user) {
      avatar.src = user.photoURL || "https://i.imgur.com/3SgkGmQ.png";
      nameEl.textContent = user.displayName || user.email || "Profil";
      uidEl.textContent  = user.uid;
    } else {
      avatar.src = "https://i.imgur.com/3SgkGmQ.png";
      nameEl.textContent = "Profil";
      uidEl.textContent  = "— oturum yok —";
    }

    // Hedef UID: ?uid=… varsa onu, yoksa kendi hesabını göster
    const uid = targetUid || user?.uid;
    if (!uid) {
      note.style.display = "block";
      note.textContent = "Giriş yapın veya URL'ye ?uid=<kullanıcıUid> ekleyin.";
      listEl.innerHTML = "";
      stat.textContent = "—";
      return;
    }

    await renderListings(uid);
  });
}

bootstrap();
