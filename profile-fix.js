import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
const db   = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, useFetchStreams: false });
const st   = getStorage(app);

const q = (sel,root=document)=>Array.from(root.querySelectorAll(sel));

function parseListingIdFromHref(href){
  try{ const u=new URL(href, location.origin); return u.searchParams.get('id'); }catch{ return null; }
}

async function firstPhotoUrl(d){
  const arr = d?.photos || d?.images || d?.imageUrls || [];
  if(!arr || !arr.length) return null;
  const x = arr[0];
  if(typeof x === "string"){
    if(/^https?:\/\//i.test(x)) return x;       // zaten tam URL
    try{ return await getDownloadURL(ref(st, x)); }catch{ return null; }  // storage path -> URL
  }
  // obje ise {url:"..."} vb.
  const u = x.url || x.src || x.path;
  if(!u) return null;
  if(/^https?:\/\//i.test(u)) return u;
  try{ return await getDownloadURL(ref(st, u)); }catch{ return null; }
}

function findCardByDocId(id){
  // 1) data-doc-id / data-id
  const ds = q(`[data-doc-id="${id}"],[data-id="${id}"]`);
  if(ds.length) return ds[0];
  // 2) aynı id'yi taşıyan linkin kartı
  const a = q('a[href*="id="]').find(el=>parseListingIdFromHref(el.getAttribute('href'))===id);
  if(a) return a.closest('.card, .item, .listing, .listing-card, li, article, .row, div');
  return null;
}

function findImgInsideCard(card){
  if(!card) return null;
  return card.querySelector('img') || null;
}

async function fixOne(id){
  try{
    const snap = await getDoc(doc(db,'listings',id));
    if(!snap.exists()) return;
    const url = await firstPhotoUrl(snap.data());
    if(!url) return;
    const card = findCardByDocId(id);
    const img  = card ? findImgInsideCard(card) : null;
    if(img){ img.src = url; img.decoding="async"; img.loading="lazy"; }
  }catch(e){ /* sessiz geç */ }
}

async function fixAll(){
  // profil sayfasındaki linklerden ID'leri topla
  const ids = new Set(
    q('a[href*="id="]').map(a => parseListingIdFromHref(a.getAttribute('href'))).filter(Boolean)
  );
  // Ayrıca veri attribute'larından yakala
  q('[data-doc-id],[data-id]').forEach(el=>{ ids.add(el.dataset.docId || el.dataset.id); });
  if(ids.size===0) return;
  for(const id of ids){ await fixOne(id); }
}

document.addEventListener('DOMContentLoaded', fixAll);
onAuthStateChanged(auth, ()=>fixAll());
