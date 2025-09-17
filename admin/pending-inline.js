import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};
const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

function h(html){ const d=document.createElement("div"); d.innerHTML=html; return d.firstElementChild; }

async function fetchAllPending(){
  const coll = collection(db,"listings");
  const variants = [
    query(coll, where('status','in',['pending','waiting','bekleyen','onay-bekliyor'])),
    query(coll, where('state','in',['pending','waiting','bekleyen','onay-bekliyor'])),
    query(coll, where('moderation','in',['pending','waiting','bekleyen','onay-bekliyor']))
  ];
  const seen=new Set(), items=[];
  for(const qy of variants){
    try{
      const snap = await getDocs(qy);
      snap.forEach(d=>{ if(!seen.has(d.id)){ seen.add(d.id); items.push({ id:d.id, ...d.data() }); } });
    }catch(_){} // bazı sorgular boş dönebilir; sorun değil
  }
  return items;
}

async function approve(id){
  await updateDoc(doc(db,"listings",id),{
    status:"active", state:"approved", moderation:"approved",
    approved:true, isApproved:true, approvedAt:serverTimestamp(), updatedAt:serverTimestamp()
  });
}
async function reject(id){
  await updateDoc(doc(db,"listings",id),{
    status:"rejected", state:"rejected", moderation:"rejected",
    approved:false, isApproved:false, rejectedAt:serverTimestamp(), updatedAt:serverTimestamp()
  });
}

function ensureMount(){
  let box = document.getElementById("pending-inline-box");
  if(box) return box;
  box = h(`
    <section id="pending-inline-box" style="margin:16px auto;max-width:1100px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h2 style="margin:0;font-size:18px">🕒 Onay Bekleyenler (otomatik)</h2>
        <button id="pi-refresh" style="padding:8px 12px;border:1px solid #e6e8ee;border-radius:10px;background:#fff;cursor:pointer">Yenile</button>
      </div>
      <div id="pi-list" style="display:grid;gap:10px"></div>
      <div id="pi-note" style="color:#6b7280;margin-top:6px"></div>
    </section>
  `);
  document.body.appendChild(box);
  return box;
}

async function render(){
  const box = ensureMount();
  const list = box.querySelector("#pi-list");
  const note = box.querySelector("#pi-note");
  list.innerHTML = "Yükleniyor…";
  try{
    const items = await fetchAllPending();
    if(items.length===0){ list.innerHTML = "<div style='color:#6b7280'>Bekleyen ilan bulunamadı.</div>"; return; }
    list.innerHTML = "";
    for(const d of items){
      const row = h(`
        <div style="background:#fff;border:1px solid #e6e8ee;border-radius:12px;padding:10px;display:grid;grid-template-columns:1fr 160px 180px 220px;gap:10px;align-items:center">
          <div>
            <div style="font-weight:700">${(d.title||'-')}</div>
            <div style="color:#6b7280;font-size:12px">${d.city||'-'} • ${(d.category||'-')}</div>
          </div>
          <div style="font-size:12px;color:#6b7280">
            status: ${d.status||'-'}<br/>
            state: ${d.state||'-'}<br/>
            moderation: ${d.moderation||'-'}
          </div>
          <div>
            <a href="/admin/listing.html?id=${encodeURIComponent(d.id)}" style="text-decoration:none;font-weight:700">Detay →</a>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
            <button data-approve="${d.id}" style="background:#16a34a;color:#fff;border:0;border-radius:10px;padding:8px 12px;cursor:pointer">Yayına Al</button>
            <button data-reject="${d.id}" style="background:#dc2626;color:#fff;border:0;border-radius:10px;padding:8px 12px;cursor:pointer">Reddet</button>
          </div>
        </div>
      `);
      list.appendChild(row);
    }
    list.addEventListener("click", async (e)=>{
      const a = e.target.closest("[data-approve]");
      const r = e.target.closest("[data-reject]");
      try{
        if(a){ await approve(a.dataset.approve); e.target.closest("div[style]").remove(); }
        if(r){ await reject(r.dataset.reject); e.target.closest("div[style]").remove(); }
      }catch(err){ note.textContent = "Hata: " + (err?.message||err); }
    }, { once:true });
    box.querySelector("#pi-refresh").onclick = render;
  }catch(err){
    list.innerHTML = "";
    note.textContent = "Hata: " + (err?.message||err);
  }
}

onAuthStateChanged(auth, async (u)=>{
  if(!u){
    try{ await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch{ ensureMount().querySelector("#pi-note").textContent="Giriş gerekiyor."; return; }
  }
  await auth.currentUser.getIdToken(true);
  render();
});
