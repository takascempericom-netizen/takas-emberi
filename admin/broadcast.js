// takas-emberi/admin/broadcast.js
import { getFirestore, collection, addDoc, serverTimestamp } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// Firebase init (tekrar import gerekirse)
const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export function render(el){
  el.innerHTML = `
    <h2>Bildiri Paneli</h2>
    <div style="display:flex;flex-direction:column;gap:12px;max-width:500px">
      <input id="bTitle" placeholder="Başlık" style="padding:10px;border-radius:8px;border:1px solid #444;background:#0b0f1b;color:#fff"/>
      <textarea id="bMsg" rows="6" placeholder="Mesaj içeriği" style="padding:10px;border-radius:8px;border:1px solid #444;background:#0b0f1b;color:#fff"></textarea>
      <button id="bSend" style="padding:12px;border-radius:8px;background:#10b981;color:#fff;cursor:pointer">Gönder</button>
    </div>
    <div id="bToast" style="margin-top:14px;color:#0f0"></div>
  `;

  const btn = el.querySelector("#bSend");
  btn.onclick = async ()=>{
    const title = el.querySelector("#bTitle").value.trim();
    const msg   = el.querySelector("#bMsg").value.trim();
    if(!title || !msg){ alert("Başlık ve mesaj gerekli."); return; }
    try{
      await addDoc(collection(db,"broadcasts"),{
        title, msg,
        createdAt: serverTimestamp(),
        by: auth.currentUser?.email || "admin"
      });
      el.querySelector("#bToast").textContent = "✅ Bildiri gönderildi";
      el.querySelector("#bTitle").value="";
      el.querySelector("#bMsg").value="";
    }catch(e){
      el.querySelector("#bToast").textContent = "❌ Hata: "+e.message;
    }
  };
}
