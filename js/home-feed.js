import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app = getApps().length ? getApps()[0] : initializeApp(cfg);
const db  = getFirestore(app);

const feed  = document.getElementById("feed");
const empty = document.getElementById("feed-empty");

function card(d, id){
  const img = d.coverUrl || ("https://picsum.photos/seed/"+id+"/800/600");
  const title = d.title || "İlan";
  const sub = `${d.category || ""}${d.city ? " • " + d.city : ""}`;
  return `
    <a class="card" href="#" aria-label="${title}">
      <img class="thumb" src="${img}" alt="${title}">
      <div class="meta">
        <div class="title">${title}</div>
        <div class="sub">${sub}</div>
      </div>
    </a>`;
}

const q = query(collection(db, "listings"), where("status","==","active"));
onSnapshot(q, (ss)=>{
  const arr = [];
  ss.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
  // en yeni üstte görünsün
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
