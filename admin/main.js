// Basit router + ortak kontroller
import "./debug-error.js";
import "./support.js";
import "./messages.js";
import "./pending.js";
import "./complaints.js";
import "./broadcast.js";
import "./settings.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import "/assets/js/firebase-init.js";
const { auth } = window.__fb;

const routes = {
  support:  window.AdminSupport,
  messages: window.AdminMessages,
  pending:  window.AdminPending,
  complaints: window.AdminComplaints,
  broadcast: window.AdminBroadcast,
  settings: window.AdminSettings,
  debug: () => ({ title:"Hata Günlükleri", html:`<div id="debugBox"></div>`, mount:()=>window.AdminDebug && window.AdminDebug() })
};

function setActive(route){
  document.querySelectorAll('.nav a').forEach(a=>{
    a.classList.toggle('active', a.dataset.route===route);
  });
}

async function ensureAdmin(u){
  const res = u ? await u.getIdTokenResult(true) : null;
  const role = res?.claims?.role;
  const admin = !!(res?.claims?.admin || role==='admin' || role==='moderator' || role==='support');
  return admin;
}

function render(route){
  const r = routes[route] || routes.support;
  const view = document.getElementById("view");
  const { title, html, mount } = r();
  view.innerHTML = `<h3 style="margin:0 0 10px">${title}</h3>${html}`;
  setActive(route);
  mount && mount();
}

window.addEventListener("hashchange", ()=> {
  const route = location.hash.replace(/^#\//,'') || "support";
  render(route);
});

document.getElementById("btnGotoSite").onclick = ()=> location.href="/";
document.getElementById("btnLogout").onclick = async ()=>{ try{ await signOut(auth);}finally{ location.href="/admin/login.html"; } };

onAuthStateChanged(auth, async (u)=>{
  const who = document.getElementById("who");
  if(!u){ location.href="/admin/login.html"; return; }
  const ok = await ensureAdmin(u);
  who.textContent = ok ? `• ${u.email}` : "• yetki yok";
  if(!ok){ location.href="/admin/login.html"; return; }
  render((location.hash.replace(/^#\//,'')||"support"));
});
