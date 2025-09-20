// takas-emberi/admin/main.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// --- Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const ADMIN_EMAIL = "ozkank603@gmail.com";

const $ = (s,r=document)=>r.querySelector(s);
const panelBody = '#panelBody' ? document.querySelector('#panelBody') : null;
const navBtns = document.querySelectorAll('.nav-btn');

// Auth kontrol
onAuthStateChanged(auth, (user)=>{
  if(!user || user.email !== ADMIN_EMAIL){
    window.location.replace('/admin/login.html');
  } else {
    loadTab("pending");
  }
});

// Logout
$(#btnLogout).addEventListener(click, async ()=>{
  try { await signOut(auth); } catch {}
  location.href="/admin/login.html";
});

// Sekme geçişleri
navBtns.forEach(btn=>{
  btn.addEventListener(click, ()=>{
    navBtns.forEach(b=>b.classList.remove(active));
    btn.classList.add(active);
    loadTab(btn.dataset.tab);
  });
});

// Dinamik içerik yükleme
async function loadTab(tab){
  panelBody.innerHTML = `<p style="color:#888">Yükleniyor...</p>`;
  try {
    if(tab==="pending"){
      const mod = await import(/admin/pending.js);
      if(mod.render) { panelBody.innerHTML=""; mod.render(panelBody); }
    }
    if(tab==="support"){
      const mod = await import(/admin/support.js);
      if(mod.render) { panelBody.innerHTML=""; mod.render(panelBody); }
    }
    if(tab==="users"){
      const mod = await import(/admin/users.js);
      if(mod.render) { panelBody.innerHTML=""; mod.render(panelBody); }
    }
    if(tab==="broadcast"){
      const mod = await import(/admin/broadcast.js);
      if(mod.render) { panelBody.innerHTML=""; mod.render(panelBody); }
    }
  } catch(e){
    panelBody.innerHTML = `<p style="color:red">Hata: ${e.message}</p>`;
  }
}
