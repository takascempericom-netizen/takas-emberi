import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app = getApps().length ? getApp() : initializeApp(cfg);
const auth = getAuth(app);
const db   = getFirestore(app);
const st   = getStorage(app);

// URL'ye ?pfdebug=1 eklersen log açılır
const DEBUG = new URLSearchParams(location.search).has("pfdebug");
const seen  = new Set(); // işlenen listing id'leri

const $all = (sel,root=document)=>Array.from(root.querySelectorAll(sel));
const log  = (...a)=>{ if(DEBUG) console.log("[profile-fix]", ...a); };

function pickIdTokensFromPath(path){
  // /ilan/ABCDEF... , /listing/XYZ..., /detay/<id> gibi; 15+ uzun tokenları aday al
  return (path||"").split(/[/#?&=]/g).filter(x=>/^[A-Za-z0-9_-]{15,}$/.test(x));
}
function parseIdFromHref(href){
  try{
    const u = new URL(href, location.origin);
    // 1) ?id= paramı
    const byQ = u.searchParams.get("id");
    if(byQ && /^[\w-]{15,}$/.test(byQ)) return byQ;
    // 2) hash içinde id= veya uzun token
    const hash = u.hash || "";
    const byH  = (hash.match(/id=([\w-]{15,})/)||[])[1];
    if(byH) return byH;
    const toks = pickIdTokensFromPath(u.pathname + hash);
    return toks[0] || null;
  }catch{ return null; }
}
function findCardRoot(el){
  return el.closest?.(".listing-card, .ilan-card, .ilan, .listing, .card, article, li, .item, .row, .box, div") || el;
}

async function firstPhotoUrl(data){
  // Olası alan adları
  const lists = [
    ...(Array.isArray(data?.photos)? data.photos : []),
    ...(Array.isArray(data?.images)? data.images : []),
    ...(Array.isArray(data?.imageUrls)? data.imageUrls : []),
    ...(Array.isArray(data?.gallery)? data.gallery : []),
    ...(Array.isArray(data?.media)? data.media : []),
  ];
  const cover = data?.cover || data?.thumbnail || data?.thumb;
  if(cover) lists.unshift(cover);

  for(const x of lists){
    let u = null;
    if(typeof x === "string") u = x;
    else if(x && typeof x === "object") u = x.url || x.src || x.path || x.storagePath || null;
    if(!u) continue;

    // Zaten http(s) ise direkt
    if(/^https?:\/\//i.test(u)) return u;

    // gs:// veya plain storage path ise downloadURL üret
    try{
      const r = ref(st, u.startsWith("gs://") ? u : u);
      const url = await getDownloadURL(r);
      if(url) return url;
    }catch(e){ /* devam */ }
  }
  return null;
}

function applyImageToCard(card, url){
  if(!card || !url) return false;

  // 1) picture > source + img
  const picture = card.querySelector("picture");
  if(picture){
    const srcs = picture.querySelectorAll("source");
    srcs.forEach(s=>{ s.srcset = url; });
  }
  // 2) <img>
  const img = card.querySelector("img");
  if(img){
    img.src = url;
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    return true;
  }
  // 3) background-image (thumb/cover)
  const bg = card.querySelector(".thumb, .cover, [data-bg], [class*='thumb'], [class*='cover']");
  if(bg){
    bg.style.backgroundImage = `url("${url}")`;
    bg.style.backgroundSize = "cover";
    bg.style.backgroundPosition = "center";
    return true;
  }
  return false;
}

async function fixCardById(id, card){
  if(!id || seen.has(id)) return;
  seen.add(id);
  try{
    const s = await getDoc(doc(db, "listings", id));
    if(!s.exists()){ log("doc yok", id); return; }
    const url = await firstPhotoUrl(s.data());
    if(!url){ log("foto bulunamadı", id); return; }
    const ok = applyImageToCard(card, url);
    log(ok ? "✓ düzeltildi" : "kart img bulunamadı", id, url);
  }catch(e){
    log("hata", id, e?.message||e);
  }
}

function collectAndFix(root=document){
  const pairs = [];

  // 1) data-* ile
  $all("[data-doc-id], [data-id], [data-listing-id], [data-open-listing], [data-listing]", root).forEach(el=>{
    const id = el.dataset.docId || el.dataset.id || el.dataset.listingId || el.dataset.openListing || el.dataset.listing || null;
    if(id && /^[\w-]{15,}$/.test(id)){
      pairs.push([id, findCardRoot(el)]);
    }
  });

  // 2) linklerden
  $all("a[href]", root).forEach(a=>{
    const id = parseIdFromHref(a.getAttribute("href"));
    if(id) pairs.push([id, findCardRoot(a)]);
  });

  // 3) benzersizleştir ve çalıştır
  const done = new Set();
  for(const [id, card] of pairs){
    if(done.has(id)) continue;
    done.add(id);
    fixCardById(id, card);
  }
}

function observe(){
  const mo = new MutationObserver(muts=>{
    for(const m of muts){
      m.addedNodes?.forEach?.(n=>{
        if(n.nodeType===1) collectAndFix(n);
      });
    }
  });
  mo.observe(document.documentElement, { childList:true, subtree:true });
}

document.addEventListener("DOMContentLoaded", ()=>{ collectAndFix(); observe(); });
onAuthStateChanged(auth, ()=>collectAndFix());
