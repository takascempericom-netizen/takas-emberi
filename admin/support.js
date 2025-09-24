// /admin/support.js — Canlı Destek (admin) • tam güncel ES module
// Özellikler:
// - Sol listede tüm destek thread’leri (supportThreads/{uid}/messages) en yeni mesaja göre
// - Sağda canlı akış (onSnapshot) ve admin tarafından yanıt gönderme
// - "Yenile" butonu destekli (index.html'de #supportRefresh)
// Not: Parent doc (supportThreads/{uid}) olmayabilir; bu yüzden liste için collectionGroup('messages') kullanıyoruz
// ve sadece '.../supportThreads/{uid}/messages/{mid}' yollarını filtreliyoruz.

import {
  collection,
  collectionGroup,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Modül içi durum
let _ctx = null;
let _unsubList = null;
let _unsubMsgs = null;
let _activeUid = null;

/** Basit HTML kaçış (UI güvenliği) */
const esc = (s) => (s||"").replace(/[<>&]/g, (c)=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));

/** Tek seferlik stil enjekte et */
function injectCSS(){
  if (document.getElementById("admin-support-css")) return;
  const css = `
  /* ————— admin/support.js ————— */
  .sup-wrap{display:block}
  .sup-cols{display:grid;grid-template-columns:320px 1fr;gap:12px}
  @media (max-width: 920px){ .sup-cols{grid-template-columns:1fr} }

  .sup-left{background:#fff;border:1px solid var(--brd);border-radius:12px;overflow:hidden}
  .sup-right{background:#fff;border:1px solid var(--brd);border-radius:12px;display:flex;flex-direction:column;min-height:420px}

  .sup-list{max-height:66vh;overflow:auto}
  .sup-item{display:flex;align-items:flex-start;gap:10px;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--brd);cursor:pointer}
  .sup-item:hover{background:#fafafa}
  .sup-item.active{background:#f1f5f9}
  .sup-item .u{font-weight:700;color:#0f172a}
  .sup-item .muted{color:var(--muted);font-size:12px}

  .sup-msgs{flex:1;overflow:auto;padding:12px}
  .sup-bubble{max-width:68%;padding:10px 12px;border-radius:12px;border:1px solid var(--brd);background:#f8fafc;margin:6px 0}
  .sup-bubble.me{margin-left:auto;background:#111827;color:#fff;border-color:#0b1220}
  .sup-time{margin-top:4px;font-size:11px;color:var(--muted)}
  .sup-empty{color:var(--muted)}

  .sup-send{display:flex;gap:8px;border-top:1px solid var(--brd);padding:10px}
  .sup-send input{flex:1;min-width:0;border:1px solid var(--brd);border-radius:10px;padding:10px 12px;font:inherit}
  .sup-send .btn{background:var(--pri);color:var(--pri-ink);border:1px solid var(--pri);border-radius:10px;padding:10px 14px;cursor:pointer}
  `;
  const tag = document.createElement("style");
  tag.id = "admin-support-css";
  tag.textContent = css;
  document.head.appendChild(tag);
}

/** Sol liste + sağ alan kabuğunu render et */
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

/** Listeyi canlı dinle (collectionGroup), sadece supportThreads yollarını al */
function subscribeList(){
  const { db, badgeEl } = _ctx;
  const listEl = document.getElementById("supList");
  if (!listEl) return;

  if (_unsubList) { try{ _unsubList(); }catch{} _unsubList = null; }

  const cg = query(
    collectionGroup(db, "messages"),
    orderBy("createdAt","desc"),
    limit(400)
  );

  _unsubList = onSnapshot(cg, (snap)=>{
    // supportThreads dışındaki 'messages' alt koleksiyonlarını filtrele
    const byUid = new Map(); // uid -> {lastAt, lastTxt}
    snap.forEach(docSnap=>{
      const p = docSnap.ref.path; // ".../supportThreads/{uid}/messages/{mid}" veya başka yollar
      const idx = p.indexOf("/supportThreads/");
      if (idx === -1) return;
      // Path'i parçala ve supportThreads sonrasındaki segmenti uid olarak al
      const parts = p.split("/");
      const stI = parts.indexOf("supportThreads");
      if (stI === -1 || stI+1 >= parts.length) return;
      const uid = parts[stI+1];
      const d = docSnap.data() || {};
      const at = d.createdAt && d.createdAt.toMillis ? d.createdAt.toMillis() : 0;
      if (!byUid.has(uid)) {
        byUid.set(uid, { lastAt: at, lastTxt: d.text || "" });
      }
    });

    // Diziye çevir ve sırala
    const rows = Array.from(byUid, ([uid, v]) => ({ uid, ...v }))
      .sort((a,b)=> (b.lastAt||0) - (a.lastAt||0));

    // Render
    listEl.innerHTML = "";
    if (rows.length === 0) {
      listEl.innerHTML = `<div class="sup-item"><div class="sup-empty">Henüz destek mesajı yok.</div></div>`;
    } else {
      rows.forEach(r=>{
        const div = document.createElement("div");
        div.className = "sup-item";
        div.dataset.uid = r.uid;
        const when = r.lastAt ? new Date(r.lastAt).toLocaleString("tr-TR") : "";
        div.innerHTML = `
          <div>
            <div class="u">${esc(r.uid)}</div>
            <div class="muted">${esc((r.lastTxt||"").slice(0, 80))}</div>
          </div>
          <div class="muted" style="white-space:nowrap">${esc(when)}</div>
        `;
        div.onclick = ()=> openThread(r.uid);
        listEl.appendChild(div);
      });
    }

    // Badge: thread sayısı
    if (badgeEl) {
      if (rows.length > 0) {
        badgeEl.textContent = String(rows.length);
        badgeEl.style.display = "inline-block";
      } else {
        badgeEl.style.display = "none";
      }
    }

    // Aktif seçimi vurgula
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

/** Bir thread’i aç ve canlı izle */
function openThread(uid){
  _activeUid = uid;
  const { db, auth } = _ctx;
  const box = document.getElementById("supMsgs");
  if (!box) return;
  box.innerHTML = `<div class="sup-empty">Yükleniyor…</div>`;

  // Solda highlight
  document.querySelectorAll("#supList .sup-item").forEach(x=>{
    x.classList.toggle("active", x.dataset.uid === uid);
  });

  if (_unsubMsgs) { try{ _unsubMsgs(); }catch{} _unsubMsgs = null; }

  const q = query(
    collection(db, "supportThreads", uid, "messages"),
    orderBy("createdAt","asc")
  );

  _unsubMsgs = onSnapshot(q, (snap)=>{
    box.innerHTML = "";
    if (snap.empty) {
      box.innerHTML = `<div class="sup-empty">Bu kullanıcıdan mesaj yok.</div>`;
      return;
    }
    snap.forEach(d=>{
      const m = d.data() || {};
      const me = m.senderUid && auth?.currentUser?.uid && (m.senderUid === auth.currentUser.uid);
      const el = document.createElement("div");
      el.className = "sup-bubble" + (me ? " me" : "");
      const t = (m.createdAt && m.createdAt.toDate) ? m.createdAt.toDate().toLocaleString("tr-TR") : "";
      el.innerHTML = `<div>${esc(m.text)}</div><div class="sup-time">${esc(t)}</div>`;
      box.appendChild(el);
    });
    box.scrollTop = box.scrollHeight;
  }, (err)=>{
    box.innerHTML = `<div class="sup-empty" style="color:#b91c1c">Mesajlar alınamadı: ${esc(err?.message||String(err))}</div>`;
  });
}

/** Admin yanıt gönder */
async function sendReply(){
  const { db, auth } = _ctx;
  const input = document.getElementById("supInput");
  const txt = (input?.value||"").trim();
  if (!txt || !_activeUid) return;

  const me = auth?.currentUser;
  if (!me) return;

  try{
    await addDoc(collection(db, "supportThreads", _activeUid, "messages"), {
      text: txt,
      senderUid: me.uid,
      createdAt: serverTimestamp()
    });
    input.value = "";
    input.focus();
  }catch(err){
    console.error("Yanıt gönderilemedi:", err);
    alert("Yanıt gönderilemedi: " + (err?.code || err?.message || "hata"));
  }
}

/** Dış arayüzden çağrılan mount */
export async function mount(ctx){
  // ctx: { auth, db, el, badgeEl }
  _ctx = ctx;

  injectCSS();
  renderShell(ctx.el);

  // Buton ve Enter göndermek
  const btn = document.getElementById("supSend");
  const input = document.getElementById("supInput");
  btn?.addEventListener("click", sendReply);
  input?.addEventListener("keydown", (e)=>{
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  });

  // Sol listeyi canlı dinle
  subscribeList();

  // Admin "Yenile" (opsiyonel): sadece listeyi yeniden abone etmeye zorlar
  const btnRefresh = document.getElementById("supportRefresh");
  btnRefresh?.addEventListener("click", ()=>{
    subscribeList();
  });
}

// (İsteğe bağlı) default export, bazı ortamlarda kolaylık olur
export default { mount };
