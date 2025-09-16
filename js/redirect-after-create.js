import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app  = getApps().length ? getApps()[0] : initializeApp(cfg);
const db   = getFirestore(app);
const auth = getAuth(app);

// Aynı oturumda tek sefer yönlendirme için
const markRedirected = (id)=>{ try{ sessionStorage.setItem("redir."+id,"1"); }catch(_){} };
const wasRedirected  = (id)=>{ try{ return sessionStorage.getItem("redir."+id)==="1"; }catch(_){ return false; } };

onAuthStateChanged(auth, (u)=>{
  if(!u) return;

  // ownerId=ben ve status=pending olanları canlı dinle
  const q = query(collection(db,"listings"),
                  where("ownerId","==",u.uid),
                  where("status","==","pending"));

  let baseline = Date.now(); // sayfa açıldığı an (ms)

  onSnapshot(q, (ss)=>{
    ss.docChanges().forEach((ch)=>{
      if(ch.type!=="added" && ch.type!=="modified") return;
      const id = ch.doc.id;
      const d  = ch.doc.data();
      const ca = d.createdAt && (d.createdAt.toMillis ? d.createdAt.toMillis() : d.createdAt.seconds*1000);
      if(!ca) return;

      // Sayfa açıldıktan sonra eklenen/güncellenen ve daha önce yönlendirilmemiş bir "pending" ilan görürsek
      const isRecent = ca >= (baseline - 15*1000); // 15 sn tolerans
      if(isRecent && !wasRedirected(id)){
        markRedirected(id);
        try{
          if (window.isSoundEnabled ? window.isSoundEnabled() : true) {
            new Audio("/assets/sounds/notify.wav").play().catch(()=>{});
          }
        }catch(_){}
        alert("İlan alındı. Onay bekleyenler sekmesine gidiliyor...");
        location.href = "profile.html#pending";
      }
    });
  }, (e)=>console.warn("[redirect-after-create]", e));
});
