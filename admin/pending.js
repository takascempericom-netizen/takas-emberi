// admin/pending.js — tek dosya, eksiksiz, modül hatası vermez.
// Özellikler: Onay bekleyenleri listeler + küçük kapak gösterir + İncele/Onayla/Reddet.
// Modal DOM'u yoksa otomatik ekler. Hata olursa ekranda gösterir.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, query, where, orderBy, getDocs,
  doc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Firebase init (tek yerde, tekrar init olmasın) ---
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

// --- Basit stil (sayfan var ise dokunmaz; yoksa şık görünür) ---
(function injectStyles(){
  if (document.getElementById("ap-pending-styles")) return;
  const css = `
  :root{ --fg:#0f172a; --brd:#e5e7eb; --muted:#64748b; --accent:#111827; }
  body{ font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial; color:var(--fg); }
  .ap-wrap{ max-width:1100px; margin:16px auto 80px; padding:0 14px; }
  .ap-title{ font-weight:800; margin:10px 0 14px; }
  .ap-err,.ap-ok{ display:none; margin:12px 0; padding:10px 12px; border-radius:12px }
  .ap-err{ border:1px solid #fecaca; background:#fee2e2; color:#7f1d1d }
  .ap-ok{ border:1px solid #bbf7d0; background:#dcfce7; color:#065f46 }
  .ap-list{ display:grid; gap:10px }
  .ap-card{
    display:grid; grid-template-columns:90px 1fr auto; gap:12px;
    background:#fff; border:1px solid var(--brd); border-radius:14px; padding:10px;
  }
  .ap-thumb{ width:90px; height:90px; border-radius:12px; border:1px solid var(--brd);
             background:#f1f5f9 center/cover no-repeat }
  .ap-ttl{ font-weight:700 }
  .ap-muted{ font-size:12px; color:var(--muted) }
  .ap-actions{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end }
  .ap-btn{ appearance:none; border:1px solid var(--brd); background:#fff; padding:8px 10px; border-radius:10px; cursor:pointer; font-weight:600 }
  .ap-btn:hover{ background:#f9fafb }
  .ap-btn.primary{ background:var(--accent); color:#fff; border-color:var(--accent) }
  .ap-btn.danger{ border-color:#fecaca; color:#7f1d1d; background:#fee2e2 }
  /* Modal */
  .ap-modal{ position:fixed; inset:0; display:none; place-items:center; background:rgba(15,23,42,.45); z-index:50 }
  .ap-modal.show{ display:grid }
  .ap-dialog{ width:min(860px,92vw); background:#fff; border:1px solid var(--brd); border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,.2); overflow:hidden }
  .ap-head,.ap-foot{ display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border-bottom:1px solid var(--brd) }
  .ap-foot{ border-top:1px solid var(--brd); border-bottom:none; justify-content:flex-end; gap:8px }
  .ap-body{ display:grid; grid-template-columns:260px 1fr; gap:12px; padding:12px }
  .ap-body img{ width:100%; border-radius:12px; border:1px solid var(--brd); object-fit:cover; aspect-ratio:1/1 }
  .ap-f{ display:grid; gap:8px }
  `;
  const style = document.createElement("style");
  style.id = "ap-pending-styles";
  style.textContent = css;
  document.head.appendChild(style);
})();

// --- Kök alan (yoksa oluşturur) ---
const root = (()=>{
  let r = document.getElementById("ap-pending-root");
  if (!r) {
    r = document.createElement("div");
    r.id = "ap-pending-root";
    r.className = "ap-wrap";
    // Admin index.html içinde bir içerik alanı varsa ona ekle; yoksa body'ye ekle
    (document.getElementById("content") || document.body).appendChild(r);
  }
  r.innerHTML = `
    <h2 class="ap-title">Onay Bekleyen İlanlar</h2>
    <div id="apErr" class="ap-err"></div>
    <div id="apOk"  class="ap-ok"></div>
    <div id="apNote" class="ap-muted" style="margin:10px 0"></div>
    <div id="apList" class="ap-list"></div>
  `;
  return r;
})();

const $ = (id)=>document.getElementById(id);
const showErr = (msg)=>{ const el=$("apErr"); if(!el) return; el.textContent = msg; el.style.display="block"; };
const showOk  = (msg)=>{ const el=$("apOk");  if(!el) return; el.textContent = msg; el.style.display="block"; setTimeout(()=>{ el.style.display="none"; }, 2000); };
const fmt = (ts)=>{ try{ const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts)); return isNaN(d) ? "—" : d.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"});}catch{return "—";} };
const firstPhoto = (d)=> Array.isArray(d?.photos) && d.photos[0] ? d.photos[0] : "";

// --- Modal (yoksa ekle) ---
function ensureModal(){
  if (document.getElementById("apModal")) return;
  const div = document.createElement("div");
  div.id = "apModal";
  div.className = "ap-modal";
  div.innerHTML = `
    <div class="ap-dialog">
      <div class="ap-head"><strong id="apMTitle">İlan</strong><span id="apMStatus" class="ap-muted">Onay Bekliyor</span></div>
      <div class="ap-body">
        <img id="apMPhoto" alt="ilan">
        <div class="ap-f">
          <div class="ap-ttl" id="apMTitle2"></div>
          <div class="ap-muted" id="apMMeta"></div>
          <div id="apMDesc" style="white-space:pre-wrap"></div>
        </div>
      </div>
      <div class="ap-foot">
        <button class="ap-btn" id="apClose">Kapat</button>
        <button class="ap-btn danger" id="apReject">Reddet</button>
        <button class="ap-btn primary" id="apApprove">Onayla</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  $("apClose").onclick = ()=> div.classList.remove("show");
}
ensureModal();

let currentDocId = null;

async function requireAdmin(user){
  try{
    const s = await getDoc(doc(db,"users", user.uid));
    const role = s.exists() ? (s.data().role || "") : "";
    if (role !== "admin") {
      $("apNote").innerHTML = `Bu sayfayı görmek için <b>users/${user.uid}</b> dokümanında <b>role: "admin"</b> olmalı. (Giriş/çıkış yapıp yenileyin.)`;
      return false;
    }
    $("apNote").textContent = "Admin girişi doğrulandı.";
    return true;
  }catch(e){
    showErr("Admin kontrolü başarısız: " + (e?.message||e));
    return false;
  }
}

function renderCard(id, d){
  const list = $("apList");
  if (!list) return;
  const cover = firstPhoto(d);
  const div = document.createElement("div");
  div.className = "ap-card";
  div.innerHTML = `
    <div class="ap-thumb" style="${cover ? `background-image:url('${cover}')` : ""}"></div>
    <div>
      <div class="ap-ttl">${d.title||"İlan"}</div>
      <div class="ap-muted">${(d.description||"").slice(0,140)}</div>
      <div class="ap-muted">Oluşturma: ${fmt(d.createdAt)} • Bitiş: ${fmt(d.expiresAt)} • ID: ${id}</div>
    </div>
    <div class="ap-actions">
      <button class="ap-btn" data-act="view" data-id="${id}">İncele</button>
      <button class="ap-btn primary" data-act="approve" data-id="${id}">Onayla</button>
      <button class="ap-btn danger" data-act="reject" data-id="${id}">Reddet</button>
    </div>
  `;
  list.appendChild(div);
}

async function loadPending(){
  const list = $("apList");
  if (!list) return;
  list.innerHTML = "";
  try{
    // Sadece status == "pending"
    const qPending = query(collection(db,"listings"), where("status","==","pending"), orderBy("createdAt","desc"));
    const snap = await getDocs(qPending);
    if (snap.empty) {
      list.innerHTML = `<div class="ap-muted">Şu anda onay bekleyen ilan yok.</div>`;
      return;
    }
    snap.forEach(docu => renderCard(docu.id, docu.data()||{}));
  }catch(e){
    showErr("Modül hatası (liste yüklenemedi): " + (e?.message||e));
    console.error(e);
  }
}

async function viewListing(id){
  try{
    const s = await getDoc(doc(db,"listings",id));
    if (!s.exists()){ showErr("İlan bulunamadı."); return; }
    const d = s.data()||{};
    $("apMTitle").textContent = d.title||"İlan";
    $("apMTitle2").textContent = d.title||"İlan";
    $("apMStatus").textContent = "Onay Bekliyor";
    $("apMDesc").textContent = d.description||"";
    $("apMMeta").textContent = `Oluşturma: ${fmt(d.createdAt)} • Bitiş: ${fmt(d.expiresAt)} • ID: ${id}`;
    const cover = firstPhoto(d);
    const img = $("apMPhoto");
    if (cover){ img.src = cover; img.style.display="block"; } else { img.removeAttribute("src"); img.style.display="none"; }
    currentDocId = id;
    $("apModal").classList.add("show");
  }catch(e){
    showErr("İnceleme açılamadı: " + (e?.message||e));
  }
}

async function approve(id){
  try{
    await updateDoc(doc(db,"listings",id), {
      status: "live",
      isApproved: true,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    showOk("İlan onaylandı.");
    $("apModal").classList.remove("show");
    await loadPending();
  }catch(e){
    showErr("Onaylanamadı: " + (e?.message||e));
  }
}
async function reject(id){
  try{
    await updateDoc(doc(db,"listings",id), {
      status: "rejected",
      isApproved: false,
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    showOk("İlan reddedildi.");
    $("apModal").classList.remove("show");
    await loadPending();
  }catch(e){
    showErr("Reddedilemedi: " + (e?.message||e));
  }
}

// Modal butonları
$("apApprove").onclick = ()=> currentDocId && approve(currentDocId);
$("apReject").onclick  = ()=> currentDocId && reject(currentDocId);

// Kartlar için event delegation
document.addEventListener("click",(ev)=>{
  const b = ev.target.closest("button[data-act]");
  if (!b) return;
  const id  = b.dataset.id;
  const act = b.dataset.act;
  if (!id) return;
  if (act==="view")    viewListing(id);
  if (act==="approve") approve(id);
  if (act==="reject")  reject(id);
});

// Global hata → ekranda göster
window.addEventListener("error", (e)=> showErr("Hata: " + (e?.message || "bilinmeyen")));
window.addEventListener("unhandledrejection", (e)=> showErr("Hata: " + (e?.reason?.message || e?.reason || "bilinmeyen")));

// Auth gate
onAuthStateChanged(auth, async (user)=>{
  if (!user){ showErr("Lütfen giriş yapın."); return; }
  const ok = await requireAdmin(user);
  if (!ok){ showErr(`Bu sayfa yalnızca admin içindir (users/${user.uid} → role: "admin").`); }
  await loadPending();
});
