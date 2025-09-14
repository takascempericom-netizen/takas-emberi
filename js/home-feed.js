import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, query, where, onSnapshot,
  addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app  = getApps().length ? getApps()[0] : initializeApp(cfg);
const db   = getFirestore(app);
const auth = getAuth(app);

const feed  = document.getElementById("feed");
const empty = document.getElementById("feed-empty");

function card(d, id){
  const img = d.coverUrl || ("https://picsum.photos/seed/"+id+"/800/600");
  const title = d.title || "İlan";
  const sub = `${d.category || ""}${d.city ? " • " + d.city : ""}`;
  return `
    <div class="card" data-card-id="\${id}">
      <img class="thumb" src="\${img}" alt="\${title}">
      <div class="meta">
        <div class="title">\${title}</div>
        <div class="sub">\${sub}</div>
        <div class="actions">
          <a class="btn offer" href="#" data-offer-id="\${id}" data-seller="\${d.ownerId}" data-title="\${title}">Teklif ver</a>
        </div>
      </div>
    </div>`;
}

const q = query(collection(db, "listings"), where("status","==","active"));
onSnapshot(q, (ss)=>{
  const arr = [];
  ss.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
  arr.sort((a,b)=>((b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)));

  if(!feed || !empty) return;

  if(arr.length === 0){
    empty.style.display = "block";
    feed.innerHTML = "";
  } else {
    empty.style.display = "none";
    feed.innerHTML = arr.map(x=>card(x,x.id)).join("");
  }
});

// Teklif ver
feed?.addEventListener("click", async (e)=>{
  const t = e.target.closest(".offer");
  if(!t) return;
  e.preventDefault();

  const listingId = t.getAttribute("data-offer-id");
  const sellerId  = t.getAttribute("data-seller");
  const title     = t.getAttribute("data-title") || "İlan";

  const u = auth.currentUser;
  if(!u){ location.href = "auth.html?next=home.html"; return; }
  if(u.uid === sellerId){ alert("Kendi ilanınıza teklif veremezsiniz."); return; }

  const text = prompt(`“\${title}” için mesajınız (opsiyonel):`, "");
  try{
    await addDoc(collection(db, \`listings/\${listingId}/offers\`), {
      listingId, listingTitle: title,
      sellerId, buyerId: u.uid,
      text: (text||"").slice(0, 1000),
      createdAt: serverTimestamp()
    });
    alert("Teklif gönderildi!");
  }catch(err){
    alert("Teklif gönderilemedi: " + (err?.message || err));
  }
});
