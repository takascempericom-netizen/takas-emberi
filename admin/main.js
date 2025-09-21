// takas-emberi/admin/main.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};
if(getApps().length===0) initializeApp(firebaseConfig);
const auth = getAuth();

const $ = (s,r=document)=>r.querySelector(s);
const panelBody = $(#panelBody);
const navBtns = document.querySelectorAll(.nav-btn);

async function loadTab(tab){
  panelBody.innerHTML = `<p style="color:#888">Yükleniyor...</p>`;
  try{
    if(tab==="pending"){
      const mod = await import(/admin/pending.js);
      panelBody.innerHTML="";
      await mod.render(panelBody);
    }else if(tab==="support"){
      const mod = await import(/admin/support.js);
      panelBody.innerHTML="";
      mod.render(panelBody);
    }else if(tab==="users"){
      const mod = await import(/admin/users.js);
      panelBody.innerHTML="";
      mod.render(panelBody);
    }else if(tab==="broadcast"){
      const mod = await import(/admin/broadcast.js);
      panelBody.innerHTML="";
      mod.render(panelBody);
    }else{
      panelBody.innerHTML = `<p style="color:#9aa3bd">Sekme hazırlanıyor...</p>`;
    }
  }catch(e){
    panelBody.innerHTML = `<p style="color:red">Hata: ${e?.message||e}</p>`;
  }
}

navBtns.forEach(btn=>{
  btn.addEventListener(click, ()=>{
    navBtns.forEach(b=>b.classList.remove(active));
    btn.classList.add(active);
    loadTab(btn.dataset.tab);
  });
});

$(#btnLogout)?.addEventListener(click, async ()=>{
  try{ await signOut(auth); }catch{}
  location.href="/admin/login.html";
});

// İlk açılışta "pending"
loadTab(pending);
