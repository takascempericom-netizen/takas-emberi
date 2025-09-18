import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, updatePassword, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, getDocs, getDoc, doc, query, where, collection, limit, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, getDownloadURL, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app = (()=>{ try{
  const a=getApp(); const o=a.options||{};
  if(o.projectId!=="ureten-eller-v2" || o.storageBucket!=="ureten-eller-v2.firebasestorage.app"){
    return initializeApp(cfg,"profilePageApp");
  } return a;
}catch{ return initializeApp(cfg,"profilePageApp"); } })();

const auth = getAuth(app);
const db   = getFirestore(app);
const st   = getStorage(app);

const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const avatar = $("#profileAvatar");
const nameEl = $("#profileName");
const uidEl  = $("#profileUid");
const listEl = $("#list");
const note   = $("#note");
const stat   = $("#stat");
const gate   = $("#gate");
const btnGoogle = $("#btnGoogle");
const btnLogout = $("#btnLogout");
const btnEdit = $("#btnEdit");
const settings = $("#settings");
const btnRefresh = $("#btnRefresh");
const cntPub = $("#cntPub"), cntPend = $("#cntPend"), cntExp = $("#cntExp");

const inpDisplayName = $("#inpDisplayName");
const inpUsername    = $("#inpUsername");
const inpEmail       = $("#inpEmail");
const inpAvatar      = $("#inpAvatar");
const inpPass        = $("#inpPass");
const btnSaveProfile = $("#btnSaveProfile");
const btnSendReset   = $("#btnSendReset");

const DEBUG = new URLSearchParams(location.search).has("pfdebug");
const log = (...a)=>{ if(DEBUG) console.log("[profile.page]",...a); };

function cardTpl(item){
  const safeTitle = (item.title || "-");
  const price = (item.price != null) ? `${item.price}₺` : "";
  const loc = [item.city, item.district].filter(Boolean).join(" / ");
  return `
    <div class="listing-card" data-doc-id="${item.id}">
      <div class="ph"><img alt="${safeTitle}" loading="lazy" decoding="async"></div>
      <div class="body">
        <h3 class="title">${safeTitle}</h3>
        <div class="muted">${loc || ""}</div>
        <div class="muted">${price}</div>
      </div>
    </div>`;
}

async function resolveImageURL(d){
  const cand = [];
  for(const k of ["coverPhoto","coverUrl","cover","thumbnail","thumb","mainImage","primaryImage","image","imageUrl","photo","photoUrl"]){
    if(d?.[k]) cand.push(d[k]);
  }
  for(const k of ["photos","images","imageUrls","gallery","media","files","attachments"]){
    if(Array.isArray(d?.[k])) cand.push(...d[k]);
  }
  for (let x of cand){
    let u=null;
    if(typeof x==="string") u=x;
    else if(x && typeof x==="object") u=x.url||x.src||x.path||x.storagePath||x.downloadURL||x.downloadUrl||x.fullPath||null;
    if(!u) continue;
    if(/^https?:\/\//i.test(u)) return u;
    if(/^gs:\/\//i.test(u)){
      const pathOnly=u.replace(/^gs:\/\/[^/]+\//i,"");
      try{ return await getDownloadURL(ref(st, pathOnly)); }catch{}
    }
    try{ return await getDownloadURL(ref(st, u)); }catch{}
  }
  return null;
}

function classify(d){
  const now = Date.now();
  const status = (d.status||d.state||"").toString().toLowerCase();
  const approved = d.approved===true || d.isApproved===true || ["approved","active","yayında","yayinda","published"].includes(status);
  const pending  = ["pending","waiting","bekleyen","onay-bekliyor"].includes(status) || (d.approved===false || d.isApproved===false) || d.moderation==="pending";
  const expTs = d.expiresAt?.toMillis ? d.expiresAt.toMillis() : (typeof d.expiresAt==="number"? d.expiresAt : null);
  const expired = (expTs && expTs < now) || ["expired","passive","suresi-dolan"].includes(status);
  if (expired) return "exp";
  if (pending) return "pend";
  if (approved) return "pub";
  return "pub";
}

async function renderListings(uid, activeTab="pub"){
  listEl.innerHTML = "";
  note.style.display = "block";
  note.textContent = "İlanlar yükleniyor…";
  stat.textContent = "—";

  const q = query(collection(db,"listings"), where("ownerId","==",uid), limit(300));
  const snap = await getDocs(q);
  if (snap.empty){
    listEl.innerHTML = "";
    note.textContent = "Bu kullanıcıya ait ilan bulunamadı.";
    cntPub.textContent = "0"; cntPend.textContent="0"; cntExp.textContent="0";
    stat.textContent = "0 ilan";
    return;
  }

  const items = [];
  snap.forEach(docu=>{
    const d = docu.data();
    items.push({ id: docu.id, title: d.title||"", price: d.price??null, city: d.city||"", district: d.district||"", _raw:d });
  });

  // Kümelere ayır
  const buckets = { pub:[], pend:[], exp:[] };
  for(const it of items){ buckets[classify(it._raw)].push(it); }
  cntPub.textContent  = buckets.pub.length;
  cntPend.textContent = buckets.pend.length;
  cntExp.textContent  = buckets.exp.length;

  const show = buckets[activeTab] || [];
  listEl.innerHTML = show.map(cardTpl).join("");

  // resimleri sırayla çöz
  let ok=0, fail=0;
  for (const el of $$(".listing-card")){
    const id = el.getAttribute("data-doc-id");
    const item = show.find(x=>x.id===id);
    const url = await resolveImageURL(item?._raw);
    if(url){
      const img = el.querySelector("img");
      img.src = url; img.srcset=url; img.referrerPolicy="no-referrer";
      ok++;
    } else {
      fail++;
    }
  }
  note.style.display="none";
  stat.textContent = `${show.length} ilan • ${ok} görsel yüklendi${fail?`, ${fail} eksik görsel`:``}`;
  log("loaded", {total:items.length, show:show.length, ok, fail});
}

async function loadUser(uid){
  const s = await getDoc(doc(db,"users",uid));
  const d = s.exists()? s.data(): {};
  const display = d.displayName || d.username || d.email || "Profil";
  const photo   = d.photoURL || d.avatar || "https://i.imgur.com/3SgkGmQ.png";
  avatar.src = photo;
  nameEl.textContent = display;
  uidEl.textContent = uid;

  // Ayar formunu doldur
  inpDisplayName.value = d.displayName || "";
  inpUsername.value    = d.username || "";
  inpEmail.value       = d.email || "";
}

function tabsWire(uid){
  $$(".tab").forEach(t=>{
    t.onclick = ()=> {
      $$(".tab").forEach(x=>x.classList.remove("active"));
      t.classList.add("active");
      renderListings(uid, t.dataset.tab);
    };
  });
}

function showGate(show){ gate.style.display = show? "block":"none"; }
function showSettings(v){ settings.style.display = v? "block":"none"; }

btnEdit.onclick = ()=> showSettings(settings.style.display==="none");
btnRefresh.onclick = ()=> location.reload();

btnGoogle.onclick = async ()=>{
  try{
    await signInWithPopup(auth, new GoogleAuthProvider());
  }catch(e){ alert(e?.message||e); }
};
btnLogout.onclick = async ()=>{ try{ await signOut(auth); location.reload(); }catch(e){ alert(e?.message||e);} };

inpAvatar.onchange = async ()=>{
  const f = inpAvatar.files?.[0]; if(!f) return;
  const user = auth.currentUser; if(!user){ return alert("Giriş gerekli"); }
  const path = `avatars/${user.uid}/avatar_${Date.now()}.jpg`;
  const task = uploadBytesResumable(ref(st, path), f, { contentType: f.type||"image/jpeg" });
  task.on("state_changed", null, e=>alert(e?.message||e), async ()=>{
    const url = await getDownloadURL(ref(st, path));
    await updateProfile(user, { photoURL: url });
    await setDoc(doc(db,"users",user.uid), { photoURL:url, updatedAt:serverTimestamp() }, { merge:true });
    avatar.src = url;
    alert("Profil fotoğrafı güncellendi.");
  });
};

btnSaveProfile.onclick = async ()=>{
  const user = auth.currentUser; if(!user){ return alert("Giriş gerekli"); }
  const data = {
    displayName: inpDisplayName.value.trim() || null,
    username: inpUsername.value.trim() || null,
    email: user.email || inpEmail.value.trim() || null,
    updatedAt: serverTimestamp()
  };
  try{
    if(data.displayName) await updateProfile(user, { displayName:data.displayName });
    await setDoc(doc(db,"users",user.uid), data, { merge:true });
    if(inpPass.value.trim().length >= 6){
      try{
        await updatePassword(user, inpPass.value.trim());
        alert("Şifre güncellendi");
      }catch(e){ alert("Şifre güncellenemedi: " + (e?.message||e)); }
    }
    alert("Profil kaydedildi.");
  }catch(e){ alert(e?.message||e); }
};

btnSendReset.onclick = async ()=>{
  const user = auth.currentUser;
  const email = user?.email || inpEmail.value.trim();
  if(!email) return alert("E-posta bulunamadı.");
  try{
    await sendPasswordResetEmail(auth, email);
    alert("Şifre sıfırlama e-postası gönderildi.");
  }catch(e){ alert(e?.message||e); }
};

function getTargetUid(){
  const usp = new URLSearchParams(location.search);
  const byUid = usp.get("uid") || usp.get("id");
  if(byUid) return byUid;
  const meta = document.querySelector('meta[name="profile-uid"]')?.content ||
               document.querySelector('meta[name="default-uid"]')?.content || null;
  return meta || null;
}

async function start(){
  const queryUid = getTargetUid();
  onAuthStateChanged(auth, async (user)=>{
    const usingUid = queryUid || user?.uid || null;

    // buton görünürlükleri
    btnLogout.style.display = user ? "inline-block" : "none";
    showGate(!usingUid && !user);

    if(!usingUid){
      nameEl.textContent = "Profil";
      uidEl.textContent  = "—";
      avatar.src = "https://i.imgur.com/3SgkGmQ.png";
      listEl.innerHTML=""; note.style.display="block"; note.textContent="Giriş yapın veya URL'ye ?uid ekleyin.";
      stat.textContent="—";
      return;
    }

    await loadUser(usingUid);
    tabsWire(usingUid);
    await renderListings(usingUid,"pub");
  });
}

document.addEventListener("DOMContentLoaded", ()=>start());
