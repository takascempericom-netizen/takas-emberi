import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

// Var olan app varsa onu kullan, yoksa ayrı isimle başlat
const app = (() => {
  if (getApps().length) return getApp();
  return initializeApp(cfg, "navLinkApp");
})();

const auth = getAuth(app);

function setLinks(uid){
  if (!uid) return;
  const anchors = Array.from(document.querySelectorAll(
    'a[href*="profile"], a[href*="profil"], a[data-profile-link]'
  ));
  anchors.forEach(a=>{
    try{
      const u = new URL(a.getAttribute("href") || "/profile.html", location.origin);
      // Profil sayfasına yönlendir ve ?uid parametresini ekle/yenile
      u.pathname = "/profile.html";
      u.searchParams.set("uid", uid);
      a.setAttribute("href", u.pathname + u.search);
    }catch(_){}
  });
}

onAuthStateChanged(auth, user => setLinks(user?.uid || null));
