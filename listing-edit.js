import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, getDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};
const app = (getApps().length ? getApp() : initializeApp(cfg));
const auth = getAuth(app);
const db   = getFirestore(app);
const st   = getStorage(app);

const $ = s => document.querySelector(s);
const note = $("#note");
const byId = id => document.getElementById(id);

const id = new URLSearchParams(location.search).get("id");

let data = null;      // mevcut ilan verisi
let photos = [];      // mevcut + yeni
let coverPhoto = null;

function phItem(url){
  const d = document.createElement("div");
  d.className = "ph";
  d.innerHTML = `
    <img src="${url}" alt="photo"/>
    <button class="cv" data-url="${url}" type="button">Kapak Yap</button>
    <button class="rm" data-url="${url}" type="button">Kaldır</button>
  `;
  return d;
}

async function load(){
  if(!id){ note.textContent = "Hatalı istek: id yok."; return; }
  const snap = await getDoc(doc(db,"listings",id));
  if(!snap.exists()){ note.textContent = "İlan bulunamadı."; return; }
  data = snap.data();

  // yetki: sadece sahibi veya admin düzenleyebilir (admin check client'ta zayıf; asıl kontrol rules)
  const user = auth.currentUser;
  if(!user || (data.ownerId !== user.uid && user.email !== "ozkank603@gmail.com")){
    note.textContent = "Bu ilanı düzenleme yetkin yok."; return;
  }

  // form doldur
  byId("title").value = data.title || "";
  byId("description").value = data.description || "";
  byId("category").value = data.category || "";
  byId("price").value = data.price ?? "";
  byId("city").value = data.city || "";
  byId("district").value = data.district || "";

  photos = Array.isArray(data.photos) ? [...data.photos] : [];
  coverPhoto = data.coverPhoto || photos[0] || null;

  // mevcut fotoları listele
  const list = byId("photosList"); list.innerHTML = "";
  photos.forEach(u=> list.appendChild(phItem(u)));

  list.addEventListener("click",(e)=>{
    const url = e.target?.dataset?.url;
    if(!url) return;
    if(e.target.classList.contains("rm")){
      photos = photos.filter(x=>x!==url);
      if(coverPhoto===url) coverPhoto = photos[0]||null;
      e.target.closest(".ph")?.remove();
    }
    if(e.target.classList.contains("cv")){
      coverPhoto = url;
      note.textContent = "Kapak güncellendi (kayıtla birlikte uygulanacak).";
    }
  });

  note.textContent = "Hazır.";
}

async function uploadNewFiles(listingId){
  const inp = byId("photos");
  const files = Array.from(inp.files||[]);
  const urls = [];
  for(const f of files){
    const safe = f.name.replace(/[^a-z0-9_.-]/gi,'_');
    const path = `listings/${listingId}/${Date.now()}_${safe}`;
    const r = ref(st, path);
    await new Promise((res,rej)=>{
      const up = uploadBytesResumable(r, f, { contentType: (f.type && f.type.startsWith("image")) ? f.type : "image/jpeg" });
      up.on("state_changed",()=>{}, rej, res);
    });
    urls.push(await getDownloadURL(r));
  }
  return urls;
}

async function save(){
  try{
    note.textContent = "Kaydediliyor…";
    const newUrls = await uploadNewFiles(id);
    const all = [...photos, ...newUrls];
    const patch = {
      title: byId("title").value.trim(),
      description: byId("description").value.trim(),
      category: byId("category").value.trim() || null,
      price: byId("price").value ? Number(byId("price").value) : null,
      city: byId("city").value.trim() || null,
      district: byId("district").value.trim() || null,
      photos: all,
      coverPhoto: coverPhoto || all[0] || null,
      // MODERATION: her düzenleme tekrar onaya düşsün
      status: "pending",
      state: "pending",
      moderation: "pending",
      approved: false,
      isApproved: false,
      pendingAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await updateDoc(doc(db,"listings",id), patch);
    note.textContent = "Değişiklikler gönderildi. Admin onayına alındı.";
    setTimeout(()=> location.href="/profile.html", 800);
  }catch(e){
    note.textContent = "Hata: " + (e.message||e);
  }
}

byId("btnCancel").onclick = ()=> history.back();

onAuthStateChanged(auth, (u)=>{
  if(!u){ note.textContent = "Giriş gerekli."; return; }
  load().catch(e=> note.textContent = "Hata: " + (e.message||e));
});
