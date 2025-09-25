// /admin/pending.js — Onay Bekleyen İlanlar (en yeni üste)
// Özellikler: listele + küçük kapak + İncele/Onayla/Reddet + rozet güncelleme.
// index.html → mount({ auth, db, el, badgeEl }) ile çağırır.

import {
  collection, query, where, orderBy, limit, startAfter, getDocs,
  doc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function mount({ auth, db, el, badgeEl }){
  if(!el) return;

  // ---- STATE ----
  let lastDoc = null;
  let loading = false;
  const PAGE = 24;

  // ---- UI ----
  el.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
      <button id="p-more" class="btn-ghost" type="button">Daha Fazla</button>
      <span id="p-hint" class="muted"></span>
    </div>
    <div id="p-list" style="display:grid;gap:10px"></div>
  `;
  const $ = (s)=> el.querySelector(s);
  const listEl = $("#p-list");
  const moreBtn = $("#p-more");
  const hintEl = $("#p-hint");
  document.getElementById("pendingRefresh")?.addEventListener("click", ()=> reload(true));
  moreBtn.addEventListener("click", ()=> reload(false));
  listEl.addEventListener("click", onActionClick);

  // Modal (tek sefer)
  ensureModal();

  // İlk yükleme
  reload(true);

  async function reload(reset){
    if(loading) return;
    loading = true;
    try{
      if(reset){
        lastDoc = null;
        listEl.innerHTML = "";
        setHint("Yükleniyor…");
      }

      // Öncelik: status ∈ ['pending','review','waiting'] + createdAt DESC
      let snap;
      try{
        let q1 = query(
          collection(db,"listings"),
          where("status","in",["pending","review","waiting"]),
          orderBy("createdAt","desc"),
          ...(lastDoc?[startAfter(lastDoc)]:[]),
          limit(PAGE)
        );
        snap = await getDocs(q1);
      }catch{
        // Fallback: createdAt DESC çek → client-side pending filtrele
        let q2 = query(
          collection(db,"listings"),
          orderBy("createdAt","desc"),
          ...(lastDoc?[startAfter(lastDoc)]:[]),
          limit(PAGE*2)
        );
        snap = await getDocs(q2);
      }

      let used = 0;
      const rows = [];
      snap.forEach(d=>{
        const x = d.data()||{};
        const status = (x.status||"").toString().toLowerCase();
        const approved = (x.isApproved===true) || (x.approved===true);
        const isPending = ["pending","review","waiting"].includes(status) || !approved;
        if(!isPending) return;
        used++;
        rows.push(renderCard(d.id, x));
      });

      lastDoc = snap.docs.length ? snap.docs[snap.docs.length-1] : null;

      if(reset && used===0){
        listEl.innerHTML = `<div class="muted">Bekleyen ilan yok.</div>`;
      }else{
        listEl.insertAdjacentHTML("beforeend", rows.join(""));
      }

      // Rozet
      updateBadge();

      setHint(lastDoc ? "" : (used>0 ? "Hepsi yüklendi." : ""));
    }catch(e){
      setHint("Hata: " + (e?.message||e));
      console.error(e);
    }finally{
      loading = false;
    }
  }

  function renderCard(id, x){
    const esc = (s)=> String(s??"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
    const dt = (ts)=>{
      try{
        const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
        if(!d || isNaN(d)) return "-";
        return d.toLocaleString();
      }catch{ return "-"; }
    };
    const cover = (Array.isArray(x.photos) && x.photos[0]) || x.cover || x.photo || "/assets/img/seffaf.png";
    const city  = x.city || x.il || "";
    const owner = x.ownerId || x.uid || "-";
    const status = (x.status || (x.isApproved===true || x.approved===true ? "approved":"pending")).toString();

    return `
      <div class="card" data-id="${esc(id)}" style="border:1px solid #e5e7eb;border-radius:12px">
        <div class="body" style="display:flex;gap:12px;align-items:flex-start">
          <img src="${esc(cover)}" alt="" style="width:84px;height:84px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb;background:#fff">
          <div style="flex:1">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <div style="font-weight:700">${esc(x.title||x.name||"(başlıksız)")}</div>
              <span style="font-size:12px;color:#64748b">#${esc(id)}</span>
            </div>
            <div class="muted" style="margin-top:4px">
              Sahip: <code>${esc(owner)}</code> • ${esc(city)} • Oluşturma: ${esc(dt(x.createdAt))}
            </div>
            <div class="muted" style="margin-top:2px">Durum: <strong>${esc(status)}</strong></div>

            <div style="display:flex;gap:8px;margin-top:10px">
              <button class="btn-ghost" data-act="view" data-id="${esc(id)}">İncele</button>
              <button class="btn-ghost" data-act="approve" data-id="${esc(id)}" style="border-color:#10b981;color:#065f46">Onayla</button>
              <button class="btn-ghost" data-act="reject"  data-id="${esc(id)}" style="border-color:#ef4444;color:#991b1b">Reddet</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function onActionClick(ev){
    const btn = ev.target.closest("button[data-act]");
    if(!btn) return;
    const act = btn.getAttribute("data-act");
    const id  = btn.getAttribute("data-id");
    if(!id) return;

    try{
      btn.disabled = true;
      if(act==="view"){
        await viewListing(id);
        return;
      }
      if(act==="approve"){
        await updateDoc(doc(db,"listings", id), {
          isApproved: true, approved: true, status: "approved",
          approvedAt: serverTimestamp(), approvedBy: auth?.currentUser?.uid || null
        });
        btn.closest(".card")?.remove();
      }
      if(act==="reject"){
        if(!confirm("Bu ilan reddedilsin mi?")) return;
        await updateDoc(doc(db,"listings", id), {
          isApproved: false, approved: false, status: "rejected",
          rejectedAt: serverTimestamp(), rejectedBy: auth?.currentUser?.uid || null
        });
        btn.closest(".card")?.remove();
      }
      updateBadge();
      if(!el.querySelector('[data-id]')) listEl.innerHTML = `<div class="muted">Bekleyen ilan yok.</div>`;
    }catch(e){
      alert("İşlem başarısız: " + (e?.message||e));
    }finally{
      btn.disabled = false;
    }
  }

  async function viewListing(id){
    try{
      const s = await getDoc(doc(db,"listings",id));
      if(!s.exists()){ alert("İlan bulunamadı."); return; }
      const d = s.data()||{};
      const cover = (Array.isArray(d.photos) && d.photos[0]) || d.cover || d.photo || "/assets/img/seffaf.png";
      const dt = (ts)=>{ try{ const x=ts?.toDate?ts.toDate():new Date(ts); return isNaN(x)?"-":x.toLocaleString(); }catch{ return "-"; } };
      const $m = (id)=> document.getElementById(id);

      $m("apMTitle").textContent  = d.title||"İlan";
      $m("apMTitle2").textContent = d.title||"İlan";
      $m("apMStatus").textContent = "Onay Bekliyor";
      $m("apMDesc").textContent   = d.description||"";
      $m("apMMeta").textContent   = `Oluşturma: ${dt(d.createdAt)} • Bitiş: ${dt(d.expiresAt)} • ID: ${id}`;
      const img = $m("apMPhoto");
      img.src = cover; img.style.display = cover ? "block" : "none";
      img.alt = d.title||"İlan";

      const modal = $m("apModal");
      modal.dataset.id = id;
      modal.classList.add("show");
    }catch(e){
      alert("İnceleme açılamadı: " + (e?.message||e));
    }
  }

  function ensureModal(){
    if(document.getElementById("apModal")) return;
    const div = document.createElement("div");
    div.id = "apModal";
    div.className = "ap-modal";
    div.innerHTML = `
      <style>
        .ap-modal{position:fixed;inset:0;display:none;place-items:center;background:rgba(15,23,42,.45);z-index:50}
        .ap-modal.show{display:grid}
        .ap-dialog{width:min(860px,92vw);background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden}
        .ap-head,.ap-foot{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #e5e7eb}
        .ap-foot{border-top:1px solid #e5e7eb;border-bottom:none;justify-content:flex-end;gap:8px}
        .ap-body{display:grid;grid-template-columns:260px 1fr;gap:12px;padding:12px}
        .ap-body img{width:100%;border-radius:12px;border:1px solid #e5e7eb;object-fit:cover;aspect-ratio:1/1}
      </style>
      <div class="ap-dialog">
        <div class="ap-head"><strong id="apMTitle">İlan</strong><span id="apMStatus" class="muted">Onay Bekliyor</span></div>
        <div class="ap-body">
          <img id="apMPhoto" alt="ilan">
          <div>
            <div style="font-weight:700" id="apMTitle2"></div>
            <div class="muted" id="apMMeta" style="margin-top:4px"></div>
            <div id="apMDesc" style="margin-top:8px;white-space:pre-wrap"></div>
          </div>
        </div>
        <div class="ap-foot">
          <button class="btn-ghost" id="apClose">Kapat</button>
          <button class="btn-ghost" id="apReject" style="border-color:#ef4444;color:#991b1b">Reddet</button>
          <button class="btn-ghost" id="apApprove" style="border-color:#10b981;color:#065f46">Onayla</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    const modal = document.getElementById("apModal");
    modal.addEventListener("click",(e)=>{ if(e.target===modal) modal.classList.remove("show"); });
    document.getElementById("apClose").onclick = ()=> modal.classList.remove("show");
    document.getElementById("apApprove").onclick = async ()=>{
      const id = modal.dataset.id; if(!id) return;
      try{
        await updateDoc(doc(db,"listings", id), {
          isApproved: true, approved: true, status: "approved",
          approvedAt: serverTimestamp(), approvedBy: auth?.currentUser?.uid || null
        });
        modal.classList.remove("show");
        // Kartı listeden çıkar
        el.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.remove();
        updateBadge();
        if(!el.querySelector('[data-id]')) listEl.innerHTML = `<div class="muted">Bekleyen ilan yok.</div>`;
      }catch(e){ alert("Onaylanamadı: " + (e?.message||e)); }
    };
    document.getElementById("apReject").onclick = async ()=>{
      const id = modal.dataset.id; if(!id) return;
      if(!confirm("Bu ilan reddedilsin mi?")) return;
      try{
        await updateDoc(doc(db,"listings", id), {
          isApproved: false, approved: false, status: "rejected",
          rejectedAt: serverTimestamp(), rejectedBy: auth?.currentUser?.uid || null
        });
        modal.classList.remove("show");
        el.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.remove();
        updateBadge();
        if(!el.querySelector('[data-id]')) listEl.innerHTML = `<div class="muted">Bekleyen ilan yok.</div>`;
      }catch(e){ alert("Reddedilemedi: " + (e?.message||e)); }
    };
  }

  function updateBadge(){
    if(!badgeEl) return;
    const cnt = el.querySelectorAll('[data-id]').length;
    if(cnt>0){ badgeEl.textContent = String(cnt); badgeEl.style.display=""; }
    else{ badgeEl.style.display="none"; }
  }

  function setHint(t){ hintEl.textContent = t||""; }
}
