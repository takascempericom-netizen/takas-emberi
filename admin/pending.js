// takas-emberi/admin/pending.js
// Onay bekleyen ilanlar: listele, incele, onayla, reddet

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, query, where, orderBy, limit, startAfter,
  getDocs, doc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Firebase init ---
const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Config ---
const ADMIN_EMAIL = 'ozkank603@gmail.com';
const PAGE_SIZE = 20;

// --- Helpers ---
const $  = (s, r=document)=>r.querySelector(s);

function toast(msg, type='info'){
  const t = document.createElement('div');
  t.textContent = msg;
  t.className = `adm-toast ${type}`;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add('show'));
  setTimeout(()=>{t.classList.remove('show'); t.remove();}, 3000);
}

function humanDate(ts){
  try{ return new Date(ts?.seconds? ts.seconds*1000 : ts).toLocaleString('tr-TR'); }catch{ return '-'; }
}

// --- State ---
let lastDoc = null;
let loading = false;
let reachedEnd = false;

// --- UI refs ---
const listEl   = $('#pendingList');
const moreBtn  = $('#btnMore');
const searchIn = $('#search');
const fCat     = $('#fCat');
const fCity    = $('#fCity');
const refresh  = $('#btnRefresh');
const dlg      = $('#dlgView');
const dlgBody  = $('#dlgBody');
const dlgClose = $('#dlgClose');
const dlgApprove = $('#dlgApprove');
const dlgReject  = $('#dlgReject');

let currentViewItem = null; // { id, ...data }

// --- Auth gate ---
onAuthStateChanged(auth, (user)=>{
  if(!user || user.email !== ADMIN_EMAIL){
    toast('Yetkisiz erişim. Giriş sayfasına yönlendiriliyorsunuz.', 'warn');
    setTimeout(()=>{ window.location.replace('/admin/login.html'); }, 600);
    return;
  }
  resetAndLoad();
});

function resetAndLoad(){
  if(listEl) listEl.innerHTML = '';
  lastDoc = null; reachedEnd = false;
  if(moreBtn) moreBtn.disabled = false;
  loadMore();
}

async function loadMore(){
  if(loading || reachedEnd) return; loading = true;

  let q = query(
    collection(db, 'listings'),
    where('status','==','pending'),
    orderBy('createdAt','desc'),
    limit(PAGE_SIZE)
  );
  if(lastDoc) q = query(
    collection(db, 'listings'),
    where('status','==','pending'),
    orderBy('createdAt','desc'),
    startAfter(lastDoc),
    limit(PAGE_SIZE)
  );

  const snap = await getDocs(q);
  if(snap.empty){
    reachedEnd = true;
    if(moreBtn) moreBtn.disabled = true;
    loading = false;
    return;
  }
  lastDoc = snap.docs[snap.docs.length-1];

  snap.forEach(d=>{
    const item = { id:d.id, ...d.data() };
    if(!passesClientFilter(item)) return;
    listEl && listEl.appendChild(renderCard(item));
  });

  loading = false;
}

function passesClientFilter(it){
  const s = (searchIn?.value||'').trim().toLowerCase();
  const cat = fCat?.value||''; const city = fCity?.value||'';
  if(s && !(it.title||'').toLowerCase().includes(s)) return false;
  if(cat && it.cat !== cat) return false;
  if(city && it.city !== city) return false;
  return true;
}

function renderCard(item){
  const el = document.createElement('div');
  el.className = 'card';
  const thumb = (item.photoURLs && item.photoURLs[0]) || '';
  el.innerHTML = `
    <div class="row">
      <img src="${thumb}" alt="thumb" onerror="this.style.display='none'" style="width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid #262b3d"/>
      <div class="grow">
        <div class="ttl">${escapeHtml(item.title||'-')}</div>
        <div class="meta">${escapeHtml(item.city||'-')} • ${escapeHtml(item.district||'-')} • ${escapeHtml(item.cat||'-')}</div>
        <div class="muted">${humanDate(item.createdAt)}</div>
      </div>
      <div class="actions">
        <button class="btn sm" data-act="view">İncele</button>
        <button class="btn sm ok" data-act="approve">Onayla</button>
        <button class="btn sm danger" data-act="reject">Reddet</button>
      </div>
    </div>
  `;
  el.querySelector('[data-act="view"]').onclick = ()=> openDetail(item);
  el.querySelector('[data-act="approve"]').onclick = ()=> approve(item.id);
  el.querySelector('[data-act="reject"]').onclick = ()=> rejectFlow(item.id);
  return el;
}

function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

function openDetail(item){
  currentViewItem = item;
  if(!dlg || !dlgBody) return;
  const photos = (item.photoURLs||[]).map(u=>`<img src="${u}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;border:1px solid #262b3d"/>`).join('');
  const sub = typeof item.subcat === 'object' ? JSON.stringify(item.subcat, null, 2) : (item.subcat||'-');
  dlgBody.innerHTML = `
    <h3 style="margin:0 0 8px">${escapeHtml(item.title||'-')}</h3>
    <p style="margin:0 0 8px;color:#aab3d1;white-space:pre-wrap">${escapeHtml(item.desc||'-')}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">${photos}</div>
    <div class="grid2">
      <div><b>Şehir/İlçe:</b> ${escapeHtml(item.city||'-')} / ${escapeHtml(item.district||'-')}</div>
      <div><b>Kategori:</b> ${escapeHtml(item.cat||'-')}</div>
      <div><b>Durum:</b> ${escapeHtml(item.cond||'-')}</div>
      <div><b>Oluşturulma:</b> ${humanDate(item.createdAt)}</div>
    </div>
    <details style="margin-top:8px"><summary>Alt Kategori Alanları</summary><pre style="white-space:pre-wrap;background:#0b0f1b;border:1px solid #23263a;border-radius:10px;padding:10px">${escapeHtml(sub)}</pre></details>
  `;
  if(typeof dlg.showModal === 'function') dlg.showModal();
}

dlgClose && (dlgClose.onclick = ()=> dlg.close());

const dlgApprove = $('#dlgApprove');
const dlgReject  = $('#dlgReject');
dlgApprove && (dlgApprove.onclick = ()=> currentViewItem && approve(currentViewItem.id));
dlgReject  && (dlgReject.onclick  = ()=> currentViewItem && rejectFlow(currentViewItem.id));

async function approve(id){
  try{
    await updateDoc(doc(db, 'listings', id), {
      status: 'approved',
      approvedAt: serverTimestamp()
    });
    toast('İlan onaylandı', 'ok');
    resetAndLoad();
    dlg?.open && dlg.close();
  }catch(e){ toast('Onay hata: '+(e?.message||e), 'danger'); }
}

async function rejectFlow(id){
  const reason = prompt('Reddetme gerekçesi:');
  if(!reason) return;
  try{
    await updateDoc(doc(db, 'listings', id), {
      status: 'rejected',
      rejectedAt: serverTimestamp(),
      rejectReason: reason
    });
    toast('İlan reddedildi', 'danger');
    resetAndLoad();
    dlg?.open && dlg.close();
  }catch(e){ toast('Red hata: '+(e?.message||e), 'danger'); }
}

// Etkileşimler
moreBtn && moreBtn.addEventListener('click', loadMore);
refresh && refresh.addEventListener('click', resetAndLoad);
searchIn && searchIn.addEventListener('input', ()=>{ if(!loading) { listEl.innerHTML=''; lastDoc=null; reachedEnd=false; loadMore(); }});
fCat && fCat.addEventListener('change', ()=> resetAndLoad());
fCity && fCity.addEventListener('change', ()=> resetAndLoad());

// Çıkış
const logoutBtn = document.getElementById('btnLogout');
logoutBtn && logoutBtn.addEventListener('click', ()=> signOut(auth).then(()=>location.href='/admin/login.html'));
