// /admin/support.js — Canlı Destek (admin) • v4
// - Sol listede kullanıcı adı + profil linki
// - Sağda mesaj akışı, seçim modu, seçili sil, thread’i sil
// - Yeni mesaj (kullanıcıdan) geldiğinde sesli uyarı
// - collectionGroup KULLANMAZ; sadece /supportThreads altında çalışır
// - Yetki hatasına dayanıklı: parent update (lastAt/lastMsg/lastSenderUid) başarısızsa mesaj yine gönderilir

import {
  collection,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let _ctx = null;
let _unsubList = null;
let _unsubMsgs = null;
let _activeUid = null;

// seçim modu
let _selectMode = false;
const _selected = new Set();

// ad/soyad cache
const _metaCache = new Map(); // uid -> { name, email, photo }

// liste değişim takibi (ses için)
const _lastMap = new Map();   // uid -> lastAt (number)
let _listReady = false;

// thread değişim takibi (ses için)
const _threadFirstLoad = new Map(); // uid -> bool

const esc = (s) => (s||"").replace(/[<>&]/g, (c)=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));

// ---- Ses
let _notifyAudio = null;
function ensureAudio(){
  if (_notifyAudio) return _notifyAudio;
  try{
    _notifyAudio = new Audio("/assets/sounds/notify.wav");
    _notifyAudio.preload = "auto";
  }catch{}
  return _notifyAudio;
}
function playNotify(){
  if (document.visibilityState !== "visible") return;
  const a = ensureAudio();
  if (!a) return;
  try{ a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(()=>{}); }catch{}
}

// ---- Stil
function injectCSS(){
  if (document.getElementById("admin-support-css")) return;
  const css = `
  .sup-wrap{display:block}
  .sup-cols{display:grid;grid-template-columns:320px 1fr;gap:12px}
  @media (max-width: 920px){ .sup-cols{grid-template-columns:1fr} }

  .sup-left{background:#fff;border:1px solid var(--brd);border-radius:12px;overflow:hidden}
  .sup-right{background:#fff;border:1px solid var(--brd);border-radius:12px;display:flex;flex-direction:column;min-height:480px}

  .sup-list{max-height:66vh;overflow:auto}
  .sup-item{display:flex;align-items:flex-start;gap:10px;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--brd);cursor:pointer}
  .sup-item:hover{background:#fafafa}
  .sup-item.active{background:#f1f5f9}
  .sup-item .u{display:flex;align-items:center;gap:6px;font-weight:700;color:#0f172a}
  .sup-item .u .uid{font-weight:500;color:#64748b;font-size:12px}
  .sup-item .muted{color:var(--muted);font-size:12px}
  .sup-item .u a{color:#0f172a;text-decoration:none}
  .sup-item .u a:hover{text-decoration:underline}

  .sup-toolbar{display:flex;gap:8px;border-bottom:1px solid var(--brd);padding:8px 10px;background:#f8fafc}
  .sup-toolbar .btn{border:1px solid var(--brd);background:#fff;color:#0f172a;border-radius:10px;padding:8px 10px;cursor:pointer}
  .sup-toolbar .btn.danger{background:#ef4444;color:#fff;border-color:#ef4444}

  .sup-msgs{flex:1;overflow:auto;padding:12px}
  .sup-bubble{position:relative;max-width:68%;padding:10px 12px;border-radius:12px;border:1px solid var(--brd);background:#f8fafc;margin:6px 0}
  .sup-bubble.me{margin-left:auto;background:#111827;color:#fff;border-color:#0b1220}
  .sup-time{margin-top:4px;font-size:11px;color:var(--muted)}
  .sup-empty{color:var(--muted)}
  .sup-check{position:absolute;left:-26px;top:10px;display:none}
  .select-on .sup-check{display:block}

  .sup-send{display:flex;gap:8px;border-top:1px solid var(--brd);padding:10px}
  .sup-send input{flex:1;min-width:0;border:1px solid var(--brd);border-radius:10px;padding:10px 12px;font:inherit}
  .sup-send .btn{background:var(--pri);color:var(--pri-ink);border:1px solid var(--pri);border-radius:10px;padding:10px 14px;cursor:pointer}
  `;
  const tag = document.createElement("style");
  tag.id = "admin-support-css";
  tag.textContent = css;
  document.head.appendChild(tag);
}

// ---- Kabuğu çiz
function renderShell(el){
  el.innerHTML = `
    <div class="sup-wrap">
      <div class="sup-cols">
        <aside class="sup-left">
          <div class="sup-list" id="supList">
            <div class="sup-item"><div class="sup-empty">Yükleniyor…</div></div>
          </div>
        </aside>
        <section class="sup-right">
          <div class="sup-toolbar">
            <button class="btn" id="btnSelectMode" type="button">Seçim Modu</button>
            <button class="btn" id="btnDeleteSel" type="button" disabled>Seçili Mesajları Sil</button>
            <button class="btn danger" id="btnDeleteThread" type="button" disabled>Thread’i Sil</button>
            <div style="margin-left:auto"></div>
          </div>
          <div class="sup-msgs" id="supMsgs">
            <div class="sup-empty">Soldan bir kullanıcı seçin.</div>
          </div>
          <div class="sup-send">
            <input id="supInput" placeholder="Yanıt yaz…" autocomplete="off" />
            <button class="btn" id="supSend" type="button">Gönder</button>
          </div>
        </section>
      </div>
    </div>
  `;
}

// ---- Kullanıcı meta getir (users veya profiles_public)
async function fetchUserMeta(uid){
  if (_metaCache.has(uid)) return _metaCache.get(uid);
  const { db } = _ctx;
  let name = uid, email = "", photo = "";
  try{
    const u = await getDoc(doc(db, "users", uid));
    if (u.exists()){
      const d = u.data() || {};
      name = d.displayName || d.name || d.fullName || d.username || d.email || uid;
      email = d.email || "";
      photo = d.photoURL || d.photo || "";
    }else{
      const p = await getDoc(doc(db, "profiles_public", uid));
      if (p.exists()){
        const d = p.data() || {};
        name = d.name || d.displayName || name;
        photo = d.photoURL || d.photo || photo;
      }
    }
  }catch{}
  const meta = { name, email, photo };
  _metaCache.set(uid, meta);
  return meta;
}

// ---- Listeyi dinle (sadece /supportThreads)
function subscribeList(){
  const { db, badgeEl, auth } = _ctx;
  const listEl = document.getElementById("supList");
  if (!listEl) return;

  if (_unsubList) { try{ _unsubList(); }catch{} _unsubList = null; }

  const qThreads = query(
    collection(db, "supportThreads"),
    orderBy("lastAt","desc"),
    limit(500)
  );

  _unsubList = onSnapshot(qThreads, async (snap)=>{
    const rows = [];
    snap.forEach(d=>{
      const uid = d.id;
      const data = d.data() || {};
      const lastAt = data.lastAt && data.lastAt.toMillis ? data.lastAt.toMillis() : 0;
      const lastTxt = data.lastMsg || "";
      const lastSenderUid = data.lastSenderUid || null;
      rows.push({ uid, lastAt, lastTxt, lastSenderUid });
    });
    rows.sort((a,b)=> (b.lastAt||0) - (a.lastAt||0));

    // Ses: ilk yüklemede baseline al, sonrakilerde fark varsa ve gönderen admin değilse çal
    if (_listReady) {
      for (const r of rows){
        const prev = _lastMap.get(r.uid) || 0;
        if (r.lastAt && r.lastAt > prev) {
          if (r.lastSenderUid && auth?.currentUser?.uid && r.lastSenderUid !== auth.currentUser.uid) {
            playNotify();
          }
          _lastMap.set(r.uid, r.lastAt);
        }
      }
    } else {
      rows.forEach(r=> _lastMap.set(r.uid, r.lastAt||0));
      _listReady = true;
    }

    listEl.innerHTML = "";
    if (rows.length === 0) {
      listEl.innerHTML = `<div class="sup-item"><div class="sup-empty">Henüz destek mesajı yok.</div></div>`;
    } else {
      for (const r of rows){
        const div = document.createElement("div");
        div.className = "sup-item";
        div.dataset.uid = r.uid;
        const when = r.lastAt ? new Date(r.lastAt).toLocaleString("tr-TR") : "";
        const profileHref = `/profile/profile.html?uid=${encodeURIComponent(r.uid)}`;
        div.innerHTML = `
          <div>
            <div class="u">
              <a href="${profileHref}" target="_blank" rel="noopener" data-role="name">${esc(r.uid)}</a>
              <span class="uid">(${esc(r.uid.slice(0,8))}…)</span>
            </div>
            <div class="muted" data-role="last">${esc((r.lastTxt||"").slice(0, 80))}</div>
          </div>
          <div class="muted" style="white-space:nowrap">${esc(when)}</div>
        `;
        // kart tıklama → thread aç; link tıklandıysa profil açılsın
        div.onclick = (ev)=>{
          if (ev.target.closest('a')) return;
          openThread(r.uid);
        };
        listEl.appendChild(div);

        // adı çek ve güncelle
        fetchUserMeta(r.uid).then(meta=>{
          const a = div.querySelector('[data-role="name"]');
          if (a) a.textContent = meta.name || r.uid;
        }).catch(()=>{});
      }
    }

    // Badge
    if (badgeEl) {
      if (rows.length > 0) {
        badgeEl.textContent = String(rows.length);
        badgeEl.style.display = "inline-block";
      } else {
        badgeEl.style.display = "none";
      }
    }

    // Aktif vurgula
    if (_activeUid) {
      document.querySelectorAll("#supList .sup-item").forEach(x=>{
        x.classList.toggle("active", x.dataset.uid === _activeUid);
      });
    }
  }, (err)=>{
    console.warn("support listesi hatası:", err);
    listEl.innerHTML = `<div class="sup-item"><div class="sup-empty" style="color:#b91c1c">Liste alınamadı: ${esc(err?.message||String(err))}</div></div>`;
  });
}

// ---- Thread aç
function openThread(uid){
  _activeUid = uid;
  _selectMode = false;
  _selected.clear();

  const { db, auth } = _ctx;
  const box = document.getElementById("supMsgs");
  if (!box) return;
  box.classList.remove('select-on');
  box.innerHTML = `<div class="sup-empty">Yükleniyor…</div>`;

  document.querySelectorAll("#supList .sup-item").forEach(x=>{
    x.classList.toggle("active", x.dataset.uid === uid);
  });

  if (_unsubMsgs) { try{ _unsubMsgs(); }catch{} _unsubMsgs = null; }

  const qMsgs = query(
    collection(db, "supportThreads", uid, "messages"),
    orderBy("createdAt","asc")
  );

  _threadFirstLoad.set(uid, true);

  _unsubMsgs = onSnapshot(qMsgs, (snap)=>{
    const first = _threadFirstLoad.get(uid) === true;
    const myUid = auth?.currentUser?.uid || null;

    if (!first) {
      // docChanges üzerinden yeni mesajları tespit et → kullanıcıdan geldiyse ses çal
      snap.docChanges().forEach(ch=>{
        if (ch.type !== "added") return;
        const m = ch.doc.data() || {};
        if (m.senderUid && myUid && m.senderUid !== myUid) playNotify();
      });
    }

    const box2 = document.getElementById("supMsgs");
    if (!box2) return;
    box2.innerHTML = "";
    if (snap.empty) {
      box2.innerHTML = `<div class="sup-empty">Bu kullanıcıdan mesaj yok.</div>`;
      updateToolbarButtons();
      _threadFirstLoad.set(uid, false);
      return;
    }
    snap.forEach(d=>{
      const m = d.data() || {};
      const me = m.senderUid && myUid && (m.senderUid === myUid);
      const el = document.createElement("div");
      el.className = "sup-bubble" + (me ? " me" : "");
      const t = (m.createdAt && m.createdAt.toDate) ? m.createdAt.toDate().toLocaleString("tr-TR") : "";
      el.dataset.id = d.id;
      el.innerHTML = `
        <input class="sup-check" type="checkbox" aria-label="seç" />
        <div>${esc(m.text)}</div>
        <div class="sup-time">${esc(t)}</div>
      `;
      el.addEventListener('click', (ev)=>{
        if (!_selectMode) return;
        const cb = el.querySelector('.sup-check');
        if (ev.target !== cb) { cb.checked = !cb.checked; }
        toggleSelected(d.id, cb.checked);
      });
      box2.appendChild(el);
    });
    box2.classList.toggle('select-on', _selectMode);
    updateToolbarButtons();
    box2.scrollTop = box2.scrollHeight;

    _threadFirstLoad.set(uid, false);
  }, (err)=>{
    const box2 = document.getElementById("supMsgs");
    if (box2) box2.innerHTML = `<div class="sup-empty" style="color:#b91c1c">Mesajlar alınamadı: ${esc(err?.message||String(err))}</div>`;
  });

  updateToolbarButtons();
}

// ---- Toolbar kontrol
function updateToolbarButtons(){
  const btnSel   = document.getElementById('btnDeleteSel');
  const btnThr   = document.getElementById('btnDeleteThread');
  const box      = document.getElementById('supMsgs');
  const hasMsgs  = !!box && box.querySelector('.sup-bubble');
  btnSel.disabled = !_selectMode || _selected.size === 0;
  btnThr.disabled = !hasMsgs || !_activeUid;
}

function toggleSelected(id, checked){
  if (checked) _selected.add(id);
  else _selected.delete(id);
  updateToolbarButtons();
}

// ---- Admin yanıt
async function sendReply(){
  const { db, auth } = _ctx;
  const input = document.getElementById("supInput");
  const txt = (input?.value||"").trim();
  if (!txt || !_activeUid) return;

  const me = auth?.currentUser;
  if (!me) return;

  try{
    // 1) Mesajı yaz
    await addDoc(collection(db, "supportThreads", _activeUid, "messages"), {
      text: txt,
      senderUid: me.uid,
      createdAt: serverTimestamp()
    });
  }catch(err){
    console.error("Mesaj eklenemedi:", err);
    alert("Yanıt gönderilemedi: " + (err?.code || err?.message || "hata"));
    return;
  }

  // 2) Parent'ı güncelle (izin yoksa hata gösterme)
  try{
    await setDoc(doc(db, "supportThreads", _activeUid), {
      lastAt: serverTimestamp(),
      lastMsg: txt,
      lastSenderUid: me.uid
    }, { merge: true });
  }catch(err){
    console.warn("Parent güncellenemedi (devam ediliyor):", err);
  }

  input.value = "";
  input.focus();
}

// ---- Seçili mesajları sil
async function deleteSelected(){
  if (!_activeUid || _selected.size === 0) return;
  if (!confirm(`Seçili ${_selected.size} mesaj silinsin mi?`)) return;

  const { db } = _ctx;
  try{
    const jobs = [];
    for (const id of _selected){
      jobs.push(deleteDoc(doc(db, "supportThreads", _activeUid, "messages", id)));
    }
    await Promise.all(jobs);
    _selected.clear();
    updateToolbarButtons();
  }catch(err){
    console.error("Seçili mesajlar silinemedi:", err);
    alert("Seçili mesajlar silinemedi: " + (err?.code || err?.message || "hata"));
  }
}

// ---- Tüm thread’i sil (toplu sil)
async function deleteThread(){
  if (!_activeUid) return;
  if (!confirm("Bu thread içindeki TÜM mesajlar ve thread kaydı silinecek. Emin misiniz?")) return;

  const { db } = _ctx;
  try{
    // mesajları partiler halinde sil
    while(true){
      const snap = await getDocs(query(
        collection(db, "supportThreads", _activeUid, "messages"),
        orderBy("createdAt","asc"),
        limit(100)
      ));
      if (snap.empty) break;
      const jobs = [];
      snap.forEach(d=> jobs.push(deleteDoc(d.ref)));
      await Promise.all(jobs);
      if (snap.size < 100) break;
    }
    // parent doc’u sil
    await deleteDoc(doc(db, "supportThreads", _activeUid));
    _selected.clear();
    _activeUid = null;
    const box = document.getElementById("supMsgs");
    if (box) box.innerHTML = `<div class="sup-empty">Thread silindi. Soldan başka kullanıcı seçin.</div>`;
    updateToolbarButtons();
  }catch(err){
    console.error("Thread silinemedi:", err);
    alert("Thread silinemedi: " + (err?.code || err?.message || "hata"));
  }
}

// ---- Dış arayüzden mount
export async function mount(ctx){
  _ctx = ctx;

  injectCSS();
  renderShell(ctx.el);
  ensureAudio(); // preload

  // Butonlar
  const btnSend = document.getElementById("supSend");
  const input   = document.getElementById("supInput");
  const btnSelMode = document.getElementById("btnSelectMode");
  const btnDelSel  = document.getElementById("btnDeleteSel");
  const btnDelThr  = document.getElementById("btnDeleteThread");

  btnSend?.addEventListener("click", sendReply);
  input?.addEventListener("keydown", (e)=>{
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
  });

  btnSelMode?.addEventListener("click", ()=>{
    _selectMode = !_selectMode;
    const box = document.getElementById("supMsgs");
    box?.classList.toggle('select-on', _selectMode);
    if (!_selectMode) _selected.clear();
    updateToolbarButtons();
  });
  btnDelSel?.addEventListener("click", deleteSelected);
  btnDelThr?.addEventListener("click", deleteThread);

  // Sol listeyi dinle
  subscribeList();

  // Admin "Yenile" (index.html'de başlık araç çubuğunda)
  document.getElementById("supportRefresh")?.addEventListener("click", ()=>{
    subscribeList();
  });
}

export default { mount };
