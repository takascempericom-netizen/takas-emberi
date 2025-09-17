import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, getDoc, doc, getDocs, query, where, orderBy, limit, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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

// URL'ye ?pfdebug=1 eklersen log açık olur
const DEBUG = new URLSearchParams(location.search).has("pfdebug");
const log = (...a)=>{ if(DEBUG) console.log("[profile-fix]", ...a); };

const $all = (sel,root=document)=>Array.from(root.querySelectorAll(sel));
const seen = new Set();

function normTitle(s){ return (s||"").toString().toLowerCase().replace(/\s+/g," ").trim(); }
function textOf(el, sels){ for(const s of sels){ const n=el.querySelector(s); if(n){ const t=n.textContent?.trim(); if(t) return t; } } return null; }

function pickIdTokensFromPath(path){
  return (path||"").split(/[/#?&=]/g).filter(x=>/^[A-Za-z0-9_-]{15,}$/.test(x));
}
function parseIdFromHref(href){
  try{
    const u = new URL(href, location.origin);
    const byQ = u.searchParams.get("id");
    if(byQ && /^[\w-]{15,}$/.test(byQ)) return byQ;
    const hash = u.hash || "";
    const byH  = (hash.match(/id=([\w-]{15,})/)||[])[1];
    if(byH) return byH;
    const toks = pickIdTokensFromPath(u.pathname + hash);
    return toks[0] || null;
  }catch{ return null; }
}
function findCardRoot(el){
  return el.closest?.(".listing-card, .ilan-card, .ilan, .listing, .card, article, li, .item, .row, .box, .grid-item, div") || el;
}

async function firstPhotoUrl(data){
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

    if(/^https?:\/\//i.test(u)) return u;
    try{
      const r = ref(st, u);
      const url = await getDownloadURL(r);
      if(url) return url;
    }catch(e){}
  }
  return null;
}

function applyImageToCard(card, url){
  if(!card || !url) return false;

  const picture = card.querySelector("picture");
  if(picture){ picture.querySelectorAll("source").forEach(s=>s.srcset=url); }

  const img = card.querySelector("img");
  if(img){
    img.src = url;
    img.srcset = url;
    img.setAttribute("data-src", url);
    img.setAttribute("data-srcset", url);
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    return true;
  }
  const bg = card.querySelector(".thumb, .cover, [data-bg], [class*='thumb'], [class*='cover']");
  if(bg){
    bg.style.backgroundImage = `url("${url}")`;
    bg.style.backgroundSize = "cover";
    bg.style.backgroundPosition = "center";
    bg.setAttribute("data-bg", url);
    return true;
  }
  return false;
}

async function fixByDocId(id, card){
  if(!id || seen.has(id)) return false;
  seen.add(id);
  try{
    const s = await getDoc(doc(db,"listings",id));
    if(!s.exists()){ log("doc yok", id); return false; }
    const url = await firstPhotoUrl(s.data());
    if(!url){ log("foto bulunamadı", id); return false; }
    const ok = applyImageToCard(card, url);
    log(ok ? "✓ id ile düzeltildi" : "kart görsel yeri bulunamadı", id, url);
    return ok;
  }catch(e){ log("hata(id)", id, e?.message||e); return false; }
}

async function fetchMyListingsMapByTitle(){
  // Kullanıcıya ait son 200 ilanı çek ve title-> {id,url} map oluştur
  const u = auth.currentUser;
  if(!u) return new Map();
  try{
    const qy = query(
      collection(db,"listings"),
      where("ownerId","==",u.uid),
      orderBy("createdAt","desc"),
      limit(200)
    );
    const snap = await getDocs(qy);
    const map = new Map();
    for(const d of snap.docs){
      const data = d.data();
      const title = normTitle(data.title || "");
      const url = await firstPhotoUrl(data);
      if(title && url) map.set(title, { id:d.id, url });
    }
    log("owner listings:", map.size);
    return map;
  }catch(e){ log("hata(fetch owner listings)", e?.message||e); return new Map(); }
}

function collectCards(root=document){
  const cards = new Set();

  // 1) data-* ile
  $all("[data-doc-id], [data-id], [data-listing-id], [data-open-listing], [data-listing]", root).forEach(el=>{
    const id = el.dataset.docId || el.dataset.id || el.dataset.listingId || el.dataset.openListing || el.dataset.listing || null;
    const card = findCardRoot(el);
    cards.add({ el: card, id: /^[\w-]{15,}$/.test(id||"") ? id : null });
  });

  // 2) linklerden
  $all("a[href]", root).forEach(a=>{
    const id = parseIdFromHref(a.getAttribute("href"));
    const card = findCardRoot(a);
    cards.add({ el: card, id: id });
  });

  // 3) Eğer hiç kart yakalanmadıysa genel grid/card ögelerini topla (fallback için)
  if(cards.size===0){
    $all(".listing-card, .ilan-card, .ilan, .listing, .card, article, li, .item, .row, .box, .grid-item, [class*='ilan']").forEach(el=>{
      cards.add({ el, id:null });
    });
  }
  return Array.from(cards);
}

async function fixAll(){
  const cards = collectCards();
  log("kart sayısı", cards.length);

  // Önce ID'si olanları düzelt
  const noId = [];
  for(const c of cards){
    if(c.id){ const ok = await fixByDocId(c.id, c.el); if(!ok){ /* yine de başlık fallback deneyeceğiz */ noId.push(c); } }
    else noId.push(c);
  }

  // Fallback: başlık eşlemesi + ownerId==me
  if(noId.length){
    const mapByTitle = await fetchMyListingsMapByTitle();
    for(const c of noId){
      const title = normTitle(textOf(c.el, [".title","h3","h2",".ad-title",".ilan-title",".listing-title",".name",".caption"]));
      if(!title) continue;
      const hit = mapByTitle.get(title);
      if(hit){
        const ok = applyImageToCard(c.el, hit.url);
        log(ok ? "✓ başlık eşleşti" : "eşleşti ama img yok", title, hit.id);
      }else{
        log("eşleşme yok (title)", title);
      }
    }
  }
}

function observe(){
  const mo = new MutationObserver(muts=>{
    for(const m of muts){ m.addedNodes?.forEach?.(n=>{ if(n.nodeType===1) fixAll(); }); }
  });
  mo.observe(document.documentElement, { childList:true, subtree:true });
}

document.addEventListener("DOMContentLoaded", ()=>{ fixAll(); observe(); });
onAuthStateChanged(auth, ()=>fixAll());
