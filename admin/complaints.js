import { getFirestore, collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const db = window.__fb?.db || getFirestore();

function tpl(){
  return {
    title: "Şikayetler",
    html: `
      <table class="table" id="cmpTbl">
        <thead><tr><th>Tarih</th><th>Gönderen</th><th>Hedef</th><th>Neden</th><th>Durum</th><th>Aksiyon</th></tr></thead>
        <tbody></tbody>
      </table>`,
    mount: setup
  }
}

function setup(){
  const tb = document.querySelector("#cmpTbl tbody");
  const qy = query(collection(db,"complaints"), orderBy("createdAt","desc"));
  onSnapshot(qy, (snap)=>{
    tb.innerHTML = "";
    if(snap.empty){ tb.innerHTML = `<tr><td colspan="6" class="muted">Kayıt yok.</td></tr>`; return; }
    snap.forEach(d=>{
      const v = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.createdAt?.toDate? v.createdAt.toDate().toLocaleString('tr-TR'):""}</td>
        <td>${v.fromUid||""}</td>
        <td>${v.targetUid||""}</td>
        <td>${(v.reason||"").slice(0,120)}</td>
        <td>${v.status||"open"}</td>
        <td class="row">
          <button class="btn" data-act="done" data-id="${d.id}">Kapat</button>
          <button class="btn danger" data-act="del" data-id="${d.id}">Sil</button>
        </td>`;
      tb.appendChild(tr);
    });
  });

  tb.onclick = async (ev)=>{
    const b = ev.target.closest('button[data-act]'); if(!b) return;
    const id = b.dataset.id;
    if(b.dataset.act==='done') await updateDoc(doc(db,"complaints",id), { status:"closed" });
    if(b.dataset.act==='del')  await deleteDoc(doc(db,"complaints",id));
  };
}

window.AdminComplaints = tpl;
