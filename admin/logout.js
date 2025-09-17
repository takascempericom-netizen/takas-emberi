import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

function mountLogoutBar(user){
  if(document.getElementById("admin-logout-bar")) return;
  const bar = document.createElement("div");
  bar.id = "admin-logout-bar";
  bar.style.cssText = "position:fixed;top:10px;right:10px;z-index:9999;display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e6e8ee;border-radius:999px;box-shadow:0 4px 14px rgba(10,20,40,.06);padding:6px 10px;font:600 13px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial";
  const who = document.createElement("span");
  who.textContent = user?.email || user?.displayName || "Girişli";
  who.style.color = "#6b7280";
  const btn = document.createElement("button");
  btn.textContent = "Çıkış";
  btn.style.cssText = "border:0;background:#dc2626;color:#fff;padding:6px 10px;border-radius:999px;cursor:pointer;font-weight:800";
  btn.onclick = async ()=>{ try{ await signOut(auth); location.reload(); }catch(e){ alert("Çıkış hatası: "+(e?.message||e)); } };
  bar.appendChild(who);
  bar.appendChild(btn);
  document.body.appendChild(bar);
}

onAuthStateChanged(auth, (u)=>{
  if(u) mountLogoutBar(u);
});
