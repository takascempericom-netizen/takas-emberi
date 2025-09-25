// /admin/broadcast.js — Admin → Bildiri Gönder / Listele / Sil
import {
  collection, addDoc, serverTimestamp,
  query, orderBy, onSnapshot, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function mount({ auth, db, el }){
  if(!el) return;

  el.innerHTML = `
    <div style="display:grid;gap:12px;grid-template-columns:1.1fr 1fr;align-items:start">
      <div class="card" style="border:none">
        <div class="head"><h3 class="title" style="margin:0">Bildiri Gönder</h3></div>
        <div class="body" style="display:grid;gap:8px">
          <input id="bcTitle" placeholder="Başlık" style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px">
          <textarea id="bcBody" placeholder="Açıklama" rows="6" style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px"></textarea>
          <div style="display:flex;gap:8px">
            <button id="bcSend" class="btn-ghost" type="button">Gönder</button>
            <span id="bcHint" class="muted"></span>
          </div>
        </div>
      </div>

      <div class="card" style="border:none">
        <div class="head"><h3 class="title" style="margin:0">Gönderilenler</h3></div>
        <div class="body">
          <div id="bcList" style="display:grid;gap:8px"></div>
        </div>
      </div>
    </div>
  `;

  const $ = (s)=> el.querySelector(s);
  const titleEl = $("#bcTitle");
  const bodyEl  = $("#bcBody");
  const sendBtn = $("#bcSend");
  const hintEl  = $("#bcHint");
  const listEl  = $("#bcList");

  sendBtn.addEventListener("click", onSend);

  // Listeyi canlı takip et
  onSnapshot(query(collection(db,"broadcasts"), orderBy("createdAt","desc")), (snap)=>{
    if(snap.empty){
      listEl.innerHTML = `<div class="muted">Kayıt yok.</div>`;
      return;
    }
    listEl.innerHTML = "";
    snap.forEach(d=>{
      const v = d.data() || {};
      const t = (v.title||"").toString();
      const b = (v.body||"").toString();
      const when = v.createdAt?.toDate ? v.createdAt.toDate() : null;
      const dateText = when ? when.toLocaleString() : "-";
      const row = document.createElement("div");
      row.className = "card";
      row.style.border = "1px solid #e5e7eb";
      row.style.borderRadius = "12px";
      row.innerHTML = `
        <div class="body" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
          <div>
            <div style="font-weight:600">${esc(t)}</div>
            <div class="muted" style="margin-top:4px;white-space:pre-wrap">${esc(b)}</div>
            <div class="muted" style="margin-top:6px;font-size:12px">Gönderici: admin • ${esc(dateText)}</div>
          </div>
          <div>
            <button class="btn-ghost" data-del="${d.id}" style="border-color:#ef4444;color:#b91c1c">Sil</button>
          </div>
        </div>`;
      listEl.appendChild(row);
    });
  });

  listEl.addEventListener("click", async (ev)=>{
    const id = ev.target?.getAttribute?.("data-del");
    if(!id) return;
    if(!confirm("Bu bildiriyi silmek istiyor musunuz?")) return;
    try{
      ev.target.disabled = true;
      await deleteDoc(doc(db,"broadcasts", id));
    }catch(e){
      alert("Silinemedi: " + (e?.message||e));
    }finally{
      ev.target.disabled = false;
    }
  });

  async function onSend(){
    const title = titleEl.value.trim();
    const body  = bodyEl.value.trim();
    if(!title || !body){ hint("Başlık ve açıklama zorunlu."); return; }
    try{
      sendBtn.disabled = true;
      await addDoc(collection(db,"broadcasts"), {
        title, body,
        sender: "admin",
        createdBy: auth?.currentUser?.uid || null,
        createdAt: serverTimestamp()
      });
      titleEl.value = ""; bodyEl.value = "";
      hint("Gönderildi.", 1600);
    }catch(e){
      alert("Gönderilemedi: " + (e?.message||e));
    }finally{
      sendBtn.disabled = false;
    }
  }

  function hint(msg, ms=2000){
    hintEl.textContent = msg;
    if(ms) setTimeout(()=> hintEl.textContent = "", ms);
  }

  function esc(s){ return String(s??"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }
}
