import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
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

// Yanlış app başlatılmışsa kendi app'ini aç
const app = (()=>{ try{ const a=getApp(); const o=a.options||{};
  if(o.projectId!=="ureten-eller-v2" || o.storageBucket!=="ureten-eller-v2.appspot.com"){
    return initializeApp(cfg,"profileFix");
  }
  return a;
}catch{ return initializeApp(cfg,"profileFix"); } })();

const auth = getAuth(app);
const db   = getFirestore(app);
const st   = getStorage(app);

const DEBUG = new URLSearchParams(location.search).has("pfdebug");
const log   = (...a)=>{ if(DEBUG) console.log("[profile-fix]",...a); };
const $all  = (sel,root=document)=>Array.from(root.querySelectorAll(sel));
const seen  = new Set();
const norm  = s => (s||"").toString().toLowerCase().replace(/\s+/g," ").trim();

function detectProfileUid(){
  const usp=new URLSearchParams(location.search);
  const q=usp.get("uid"); if(q && /^[\w-]{10,}$/.test(q)) return q;

  const cands = [
    '[data-profile-uid]','[data-user-id]','[data-uid]','#profile-uid','#user-uid',
    'meta[name="profile-uid"]','meta[name="user-uid"]','input[name="profile-uid"]','input[name="user-uid"]'
  ];
  for(const sel of cands){
    const el=document.querySelector(sel);
    const v = el?.content || el?.value || el?.dataset?.profileUid || el?.dataset?.userId || el?.dataset?.uid || el?.textContent;
    if(v && /^[\w-]{10,}$/.test(v.trim())) return v.trim();
  }
  // linklerden
  for(const a of $all('a[href*="uid="], a[href*="/u/"]')){
    try{
      const u = new URL(a.getAttribute('href'), location.origin);
      const v = u.searchParams.get('uid') || (u.pathname.match(/\/u\/([\w-]{10,})/)||[])[1];
      if(v && /^[\w-]{10,}$/.test(v)) return v;
    }catch{}
  }
  return null;
}

function pickIdTokensFromPath(path){
  return (path||"").split(/[/#?&=]/g).filter(x=>/^[A-Za-z0-9_-]{15,}$/.test(x));
}
function parseIdFromHref(href){
  try{
    const u=new URL(href,location.origin);
    const byQ=u.searchParams.get("id"); if(byQ && /^[\w-]{15,}$/.test(byQ)) return byQ;
    const h=u.hash||""; const byH=(h.match(/id=([\w-]{15,})/)||[])[1]; if(byH) return byH;
    const toks=pickIdTokensFromPath(u.pathname+h); return toks[0]||null;
  }catch{ return null; }
}
function parseIdFromImgSrc(src){
  if(!src) return null;
  const m=src.match(/picsum\.photos\/seed\/([\w-]{15,})\//i);
  return m ? m[1] : null;
}

async function firstPhotoUrl(data){
  const lists=[
    // ÖNCE kapak URL/Path alanları:
    ...(data?.coverPhoto ? [data.coverPhoto] : []),
    ...(data?.coverUrl   ? [data.coverUrl]   : []),
    ...(data?.cover      ? [data.cover]      : []),
    ...(data?.thumbnail  ? [data.thumbnail]  : []),
    ...(data?.thumb      ? [data.thumb]      : []),
    // Galeri alanları:
    ...(Array.isArray(data?.photos)?data.photos:[]),
    ...(Array.isArray(data?.images)?data.images:[]),
    ...(Array.isArray(data?.imageUrls)?data.imageUrls:[]),
    ...(Array.isArray(data?.gallery)?data.gallery:[]),
    ...(Array.isArray(data?.media)?data.media:[]),
  ];
  for(const x of lists){
    let u=null;
    if(typeof x==="string") u=x;
    else if(x && typeof x==="object") u=x.url||x.src||x.path||x.storagePath||null;
    if(!u) continue;
    if(/^https?:\/\//i.test(u)) return u;
    try{ const url=await getDownloadURL(ref(st,u)); if(url) return url; }catch{}
  }
  return null;
}

function applyImageToCard(card,url){
  if(!card||!url) return false;
  const picture=card.querySelector("picture");
  if(picture){ picture.querySelectorAll("source").forEach(s=>s.srcset=url); }
  const img=card.querySelector("img");
  if(img){
    img.src=url; img.srcset=url; img.setAttribute("data-src",url); img.setAttribute("data-srcset",url);
    img.loading="lazy"; img.decoding="async"; img.referrerPolicy="no-referrer";
    return true;
  }
  const bg=card.querySelector(".thumb,.cover,[data-bg],[class*='thumb'],[class*='cover']");
  if(bg){ bg.style.backgroundImage=`url("${url}")`; bg.style.backgroundSize="cover"; bg.style.backgroundPosition="center"; bg.setAttribute("data-bg",url); return true; }
  return false;
}

async function fixByDocId(id,card){
  if(!id||seen.has(id)) return false; seen.add(id);
  try{
    const s=await getDoc(doc(db,"listings",id));
    if(!s.exists()){ log("doc yok",id); return false; }
    const url=await firstPhotoUrl(s.data());
    if(!url){ log("foto yok",id); return false; }
    const ok=applyImageToCard(card,url);
    log(ok?"✓ id ile düzeltildi":"img bulunamadı",id,url);
    if(ok) { card.dataset.docId = id; }
    return ok;
  }catch(e){ log("hata(id)",id,e?.message||e); return false; }
}

async function fetchListingsByOwner(uid){
  if(!uid) return [];
  try{
    const qy=query(collection(db,"listings"), where("ownerId","==",uid), orderBy("createdAt","desc"), limit(200));
    const snap=await getDocs(qy);
    const arr=[];
    for(const d of snap.docs){
      const data=d.data();
      const url=await firstPhotoUrl(data);
      arr.push({id:d.id, title: data.title||"", url});
    }
    log("owner listings:",arr.length, "uid:", uid);
    return arr;
  }catch(e){ log("hata(fetch owner)",e?.message||e); return []; }
}

function buildTitleMap(arr){
  const m=new Map();
  for(const it of arr){
    const t=norm(it.title);
    if(t && it.url) m.set(t, it);
  }
  return m;
}

function findCardRoot(el){
  return el.closest?.(".listing-card,.ilan-card,.ilan,.listing,.card,article,li,.item,.row,.box,.grid-item,div,[class*='ilan']")||el;
}

function collectCards(root=document){
  const cards=[];
  const seenEl=new Set();
  const push=(id,el)=>{ const card=findCardRoot(el); if(!seenEl.has(card)) { cards.push({id,el:card}); seenEl.add(card);} };

  // data-* ve linklerden
  $all("[data-doc-id],[data-id],[data-listing-id],[data-open-listing],[data-listing]",root).forEach(el=>{
    const id=el.dataset.docId||el.dataset.id||el.dataset.listingId||el.dataset.openListing||el.dataset.listing||null;
    if(id && /^[\w-]{15,}$/.test(id)) push(id,el);
  });
  $all("a[href]",root).forEach(a=>{
    const id=parseIdFromHref(a.getAttribute("href")); if(id) push(id,a);
  });
  // picsum seed'den
  $all("img[src*='picsum.photos/seed/']",root).forEach(img=>{
    const id=parseIdFromImgSrc(img.getAttribute("src")); if(id) push(id,img);
  });
  // Genel kartlar (id'sizleri de tutalım)
  $all(".listing-card,.ilan-card,.ilan,.listing,.card,article,li,.item,.row,.box,.grid-item,[class*='ilan']").forEach(el=>{
    if(!seenEl.has(el)) cards.push({id:null, el});
  });
  return cards;
}

async function fixAll(){
  const cards=collectCards();
  log("kart sayısı",cards.length);

  const noId=[];
  for(const c of cards){
    if(c.id){ const ok=await fixByDocId(c.id,c.el); if(!ok) noId.push(c); }
    else noId.push(c);
  }
  if(!noId.length) return;

  // profil UID tespit et (oturumsuz bile çalışır)
  let uid = detectProfileUid();
  if(!uid && auth.currentUser) uid = auth.currentUser.uid;

  const mine = await fetchListingsByOwner(uid);
  const mapByTitle = buildTitleMap(mine);
  const used = new Set();

  // önce başlık eşleşmesi
  for(const c of noId){
    const t = norm( (c.el.querySelector(".title,h2,h3")?.textContent)||"" );
    if(!t) continue;
    const hit = mapByTitle.get(t);
    if(hit && hit.url && !used.has(hit.id)){
      const ok=applyImageToCard(c.el,hit.url);
      if(ok){ log("✓ title match", t, hit.id); used.add(hit.id); c.el.dataset.docId = hit.id; }
    }
  }
  // kalanlar için sıra fallback
  const rest = mine.filter(x=>x.url && !used.has(x.id));
  let k=0;
  for(const c of noId){
    const cur = c.el.querySelector("img")?.src || "";
    if(cur && !/picsum\.photos|^data:image\/svg\+xml/i.test(cur)) continue; // zaten düzeltilmiş
    if(k>=rest.length) break;
    const hit = rest[k++];
    const ok = applyImageToCard(c.el, hit.url);
    if(ok){ log("✓ sıra fallback", hit.id); c.el.dataset.docId = hit.id; }
  }
}

function observe(){
  const mo=new MutationObserver(muts=>{
    for(const m of muts){ m.addedNodes?.forEach?.(n=>{ if(n.nodeType===1) fixAll(); }); }
  });
  mo.observe(document.documentElement,{childList:true,subtree:true});
}

document.addEventListener("DOMContentLoaded", ()=>{ fixAll(); observe(); });
onAuthStateChanged(auth, ()=>fixAll());
