import { getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const app = (getApps().length ? getApp() : null);
const auth = app ? getAuth(app) : null;
const db   = app ? getFirestore(app) : null;

function injectRowActions(root=document){
  document.querySelectorAll(".listing-card").forEach(card=>{
    if(card.querySelector(".row-actions")) return; // zaten var
    const id = card.dataset.docId;
    const owner = card.dataset.ownerId;
    if(!id || !owner) return;
    // butonlar
    const bar = document.createElement("div");
    bar.className = "row-actions";
    bar.style.display="flex";
    bar.style.gap="8px";
    bar.style.padding="10px";
    bar.style.borderTop="1px solid var(--line)";
    bar.innerHTML = `
      <button class="btn-edit" style="appearance:none;border:1px solid var(--line);background:#fff;border-radius:10px;padding:8px 10px;cursor:pointer">Düzenle</button>
      <button class="btn-del"  style="appearance:none;border:0;background:#dc2626;color:#fff;border-radius:10px;padding:8px 10px;cursor:pointer">Sil</button>
    `;
    card.appendChild(bar);
  });
}

function delegateClicks(){
  document.addEventListener("click", async (e)=>{
    const btn = e.target.closest(".btn-edit,.btn-del");
    if(!btn) return;
    const card = e.target.closest(".listing-card");
    const id   = card?.dataset?.docId;
    const owner= card?.dataset?.ownerId;
    if(!id || !owner) return;

    const user = auth?.currentUser;
    if(!user || user.uid !== owner){
      alert("Bu ilan için yetkin yok."); return;
    }

    if(btn.classList.contains("btn-edit")){
      location.href = `/listing-edit.html?id=${encodeURIComponent(id)}`;
      return;
    }
    if(btn.classList.contains("btn-del")){
      if(!confirm("İlan silinsin mi? Bu işlem geri alınamaz.")) return;
      try{
        await deleteDoc(doc(db,"listings",id));
        card.remove();
      }catch(e){
        alert("Silme hatası: " + (e.message||e));
      }
    }
  });
}

function observe(){
  const mo = new MutationObserver(()=> injectRowActions());
  mo.observe(document.body, { subtree:true, childList:true });
}

if(auth){
  onAuthStateChanged(auth, ()=>{ injectRowActions(); });
  injectRowActions();
  delegateClicks();
  observe();
}
