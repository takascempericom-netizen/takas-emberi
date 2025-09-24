import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const db = window.__fb?.db || getFirestore();

function tpl(){
  return {
    title: "Bildiri (Broadcast)",
    html: `
      <div class="grid" style="grid-template-columns:1fr 1fr">
        <div class="panel">
          <div class="row"><input id="bcTitle" placeholder="Başlık" style="width:100%"></div>
          <div class="row" style="margin-top:8px"><textarea id="bcBody" placeholder="İçerik" rows="8" style="width:100%"></textarea></div>
          <div class="row" style="margin-top:8px"><button class="btn primary" id="bcSend">Gönder</button></div>
        </div>
        <div class="panel">
          <div class="list" id="bcList"></div>
        </div>
      </div>`,
    mount: setup
  }
}

function setup(){
  const list = document.getElementById("bcList");
  document.getElementById("bcSend").onclick = async ()=>{
    const title = document.getElementById("bcTitle").value.trim();
    const body  = document.getElementById("bcBody").value.trim();
    if(!title || !body) return;
    await addDoc(collection(db,"broadcasts"), { title, body, createdAt: serverTimestamp() });
    document.getElementById("bcTitle").value = "";
    document.getElementById("bcBody").value = "";
  };

  onSnapshot(query(collection(db,"broadcasts"), orderBy("createdAt","desc")), (snap)=>{
    list.innerHTML = "";
    if(snap.empty){ list.innerHTML = `<div class="item"><div class="muted">Kayıt yok.</div></div>`; return; }
    snap.forEach(d=>{
      const v = d.data();
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `<div><strong>${v.title}</strong><div class="muted">${(v.body||"").slice(0,100)}</div></div>
                       <div class="row"><button class="btn danger" data-id="${d.id}">Sil</button></div>`;
      list.appendChild(row);
    });
  });

  list.onclick = async (ev)=>{
    const id = ev.target?.dataset?.id;
    if(!id) return;
    await deleteDoc(doc(db,"broadcasts",id));
  };
}

window.AdminBroadcast = tpl;
