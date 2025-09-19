import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, getDoc, doc, getDocs, query, where, orderBy, limit, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app = (()=>{ try{ const a=getApp(); const o=a.options||{};
  if(o.projectId!=="ureten-eller-v2" || o.storageBucket!=="ureten-eller-v2.appspot.com"){
    return initializeApp(cfg,"profileFix");
  }
  return a;
}catch{
  return initializeApp(cfg,"profileFix");
}})();
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
  seen.add(id