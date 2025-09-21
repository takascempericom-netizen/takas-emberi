// takas-emberi/admin/main.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase (duplicate-app koruması)
const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};
if (getApps().length === 0) initializeApp(firebaseConfig);
const auth = getAuth();

const ADMIN_EMAIL = "ozkank603@gmail.com";
const $ = (s,r=document)=>r.querySelector(s);

const panelBody = $("#panelBody");
const navBtns = document.querySelectorAll(".nav-btn");
const logoutBtn = $("#btnLogout");
const notifyEl = $("#notifySound");

function setActive(tab){
  navBtns.forEach(b=>{
    if(b.dataset.tab === tab) b.classList.add("active");
    else b.classList.remove("active");
  });
}

async function loadTab(tab){
  if(!panelBody) return;
  panelBody.innerHTML = `<p style="color:#888">Yükleniyor...</p>`;
  try{
    if(tab === "pending"){
      const mod = await import("/admin/pending.js");
      if (mod.render) panelBody.innerHTML = "", mod.render(panelBody, notifyEl);
      else panelBody.innerHTML = "<h2>Onay Bekleyen</h2><p>Modül yüklenemedi.</p>";
    } else if(tab === "support"){
      const mod = await import("/admin/support.js");
      if (mod.render) panelBody.innerHTML = "", mod.render(panelBody, notifyEl);
      else panelBody.innerHTML = "<h2>Canlı Destek</h2><p>Panel yakında.</p>";
    } else if(tab === "users"){
      const mod = await import("/admin/users.js");
      if (mod.render) panelBody.innerHTML = "", mod.render(panelBody);
      else panelBody.innerHTML = "<h2>Kullanıcılar</h2><p>Panel yakında.</p>";
    } else if(tab === "broadcast"){
      const mod = await import("/admin/broadcast.js");
      if (mod.render) panelBody.innerHTML = "", mod.render(panelBody);
      else panelBody.innerHTML = "<h2>Bildiri</h2><p>Panel yakında.</p>";
    } else if(tab === "complaints"){
      panelBody.innerHTML = "<h2>Şikayetler</h2><p>Panel yakında.</p>";
    } else if(tab === "settings"){
      panelBody.innerHTML = "<h2>Ayarlar</h2><p>Panel yakında.</p>";
    } else if(tab === "messages"){
      panelBody.innerHTML = "<h2>Mesajlar</h2><p>Panel yakında.</p>";
    } else {
      panelBody.innerHTML = "<p>Geçersiz sekme.</p>";
    }
  }catch(e){
    panelBody.innerHTML = `<p style="color:red">Hata: ${e?.message||e}</p>`;
  }
}

// Sekme tıklamaları
navBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const tab = btn.dataset.tab;
    setActive(tab);
    loadTab(tab);
  });
});

// Logout
logoutBtn?.addEventListener("click", async ()=>{
  try{ await signOut(auth); }catch{}
  location.href="/admin/login.html";
});

// Auth gate
onAuthStateChanged(auth, (user)=>{
  if(!user || user.email !== ADMIN_EMAIL){
    location.href="/admin/login.html";
    return;
  }
  // Varsayılan: Canlı Destek
  setActive("support");
  loadTab("support");
});
