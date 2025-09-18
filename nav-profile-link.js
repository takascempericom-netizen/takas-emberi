import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const cfg={ apiKey:"AIzaSyBUUNSYxoWNUsK0C-C04qTUm6fvg", authDomain:"ureten-eller-v2.firebaseapp.com", projectId:"ureten-eller-v2", storageBucket:"ureten-eller-v2.firebasestorage.app", messagingSenderId:"621494781131", appId:"1:621494781131:web:13cc3b061a5e94b7cf874e" };
const app=(()=>{ try{ const a=getApp(); return a; }catch{ return initializeApp(cfg,"navLinkApp"); } })();
const auth=getAuth(app);

function setLink(u){ 
  const a=document.querySelector('a[href*="profile"], a[href*="profil"]');
  if(a && u) a.href=`/profile.html?uid=${encodeURIComponent(u)}`;
}
onAuthStateChanged(auth, u=>setLink(u?.uid||null));
