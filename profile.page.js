import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, updatePassword, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, getDocs, getDoc, doc, query, where, collection, limit, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, getDownloadURL, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

// SADECE DEFAULT APP — named app YOK
const app = (getApps().length ? getApp() : initializeApp(cfg));
const auth = getAuth(app);
const db   = getFirestore(app);
const st   = getStorage(app);

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

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

function getTargetUid(){
  const p = new URLSearchParams(location.search);
  const uid = p.get("uid") || p.get("id");
  if (uid) return uid;
  const meta = document.querySelector('meta[name="profile-uid"]')?.content
            || document.querySelector('meta[name="default-uid"]')?.content
            || null;
  return meta || null;
}

function classify(d){
  const now = Date.now();
  const status = (d?.status || d?.state || "").toString().toLowerCase();
  const approved = d?.approved===true || d?.isApproved===true || ["approved","active","yayında","yayinda","published"].includes(status);
  const pending  = ["pending","waiting","bekleyen","onay-bekliyor"].includes(status) || d?.moderation==="pending" || (d?.approved===false || d?.isApproved===false);
  const expTs = d?.expiresAt?.toMillis ? d.expiresAt.toMillis() : (typeof d?.expiresAt==="number" ? d.expiresAt : null);
  const expired = (expTs && expTs < now) || ["expired","passive","suresi-dolan"].includes(status);
  if (expired) return "exp";
  if (pending) return "pend";
  if (approved) return "pub";
  return "pub";
}

function cardTpl(it){
  const t = it.title || "-";
  const price = it.price != null ? `${it.price}₺` : "";
  const loc = [it.city, it.district].filter(Boolean).join(" / ");
  return `
    <div class="listing-card" data-doc-id="${it.id}">
      <div class="ph"><img alt="${t}" loading="lazy" decoding="async"></div>
      <div class="body">
        <h3 class="title">${t}</h3>
        <div class="muted">${loc}</div>
        <div class="muted">${price}</div>
      </div>
    </div>`;
}

async function resolveImageURL(d){
  const list = [];
  for (const k of ["coverPhoto","coverUrl","cover","thumbnail","thumb","mainImage","primaryImage","image","imageUrl","photo","photoUrl"]) {
    if (d?.[k]) list.push(d[k]);
  }
  for (const k of ["photos","images","imageUrls","gallery","media","files","attachments"]) {
    if (Array.isArray(d?.[k])) list.push(...d[k]);
  }
  for (let x of list){
    let u=null;
    if (typeof x === "string") u = x;
    else if (x && typeof x === "object") u = x.url || x.src || x.path || x.storagePath || x.fullPath || x.downloadURL || x.downloadUrl || null;
    if (!u) continue;
    if (/^https?:\/\//i.test(u)) return u;
    if (/^gs:\/\//i.test(u)) {
      const pathOnly = u.replace(/^gs:\/\/[^/]+\//i,"");
      try { return await getDownloadURL(ref(st, pathOnly)); } catch {}
    }
    try { return await getDownloadURL(ref(st, u)); } catch {}
  }
  return null;
}

async function renderListings(uid, activeTab="pub"){
  try{
    listEl.innerHTML = "";
    note.style.display = "block";
    note.textContent = "İlanlar yükleniyor…";
    stat.textContent = "—";

    const q = query(collection(db,"listings"), where("ownerId","==",uid), limit(300));
    const snap = await getDocs(q);

    if (snap.empty){
      cntPub.textContent="0"; cntPend.textContent="0"; cntExp.textContent="0";
      listEl.innerHTML = "";
      note.textContent = "Bu kullanıcıya ait ilan bulunamadı.";
      stat.textContent = "0 ilan";
      return;
    }

    const all = [];
    snap.forEach(docu=>{
      const d=docu.data();
      all.push({ id:docu.id, title:d.title||"", price:d.price??null, city:d.city||"", district:d.district||"", _raw:d });
    });

    const buckets = { pub:[], pend:[], exp:[] };
    for (const it of all) buckets[classify(it._raw)].push(it);
    cntPub.textContent  = buckets.pub.length;
    cntPend.textContent = buckets.pend.length;
    cntExp.textContent  = buckets.exp.length;

    const show = buckets[activeTab] || [];
    listEl.innerHTML = show.map(cardTpl).join("");

    let ok=0, fail=0;
    for (const el of $$(".listing-card")){
      const id = el.getAttribute("data-doc-id");
      const it = show.find(x=>x.id===id);
      const url = await resolveImageURL(it?._raw);
      const img = el.querySelector("img");
      if (url){ img.src=url; img.srcset=url; img.referrerPolicy="no-referrer"; ok++; }
      else { img.src="https://i.imgur.com/3SgkGmQ.png"; fail++; }
    }
    note.style.display="none";
    stat.textContent = `${show.length} ilan • ${ok} görsel yüklendi${fail?`, ${fail} eksik görsel`:``}`;
    log("loaded",{all:all.length,show:show.length,ok,fail});
  }catch(e){
    console.error("[profile.page] renderListings", e);
    note.style.display="block";
    note.textContent = "Hata: " + (e?.message || e);
  }
}

async function loadUser(uid){
  const s = await getDoc(doc(db,"users",uid));
  const d = s.exists()? s.data(): {};
  const display = d.name || d.displayName || d.username || ((typeof auth!=="undefined" && auth.currentUser && auth.currentUser.displayName) ? auth.currentUser.displayName : "") || d.email || ((typeof auth!=="undefined" && auth.currentUser && auth.currentUser.email) ? auth.currentUser.email : "") || "Profil";
  const photo   = d.photoURL || d.avatar || "https://i.imgur.com/3SgkGmQ.png";
  avatar.src = photo; nameEl.textContent = display; uidEl.textContent = uid;
  (function(){ var uEl=(typeof document!="undefined"?document.getElementById("profileUsername"):null); try{
    var uname = (typeof d!="undefined" && d && (d.username || d.name)) || (typeof display!="undefined"?display:"");
    if(uEl && !uEl.textContent){ uEl.textContent = uname; }
  }catch(e){} })();
  inpDisplayName.value = d.displayName || "";
  inpUsername.value    = d.username || "";
  inpEmail.value       = d.email || "";
}

function tabsWire(uid){
  $$(".tab").forEach(t=>{
    t.setAttribute("role","button");
    t.style.cursor="pointer";
    t.onclick = ()=>{
      $$(".tab").forEach(x=>x.classList.remove("active"));
      t.classList.add("active");
      renderListings(uid, t.dataset.tab || "pub");
    };
  });
}

function showGate(v){ gate.style.display = v? "block":"none"; }
function showSettings(v){ settings.style.display = v? "block":"none"; }

btnEdit.onclick = ()=> showSettings(settings.style.display==="none");
btnRefresh.onclick = ()=> location.reload();

btnGoogle?.addEventListener("click", async ()=>{
  try{ await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch(e){ alert(e?.message||e); }
});
btnLogout?.addEventListener("click", async ()=>{
  try{ await signOut(auth); location.reload(); }
  catch(e){ alert(e?.message||e); }
});

inpAvatar?.addEventListener("change", async ()=>{
  const f = inpAvatar.files?.[0]; if(!f) return;
  const user = auth.currentUser; if(!user) return alert("Giriş gerekli");
  const path = `avatars/${user.uid}/avatar_${Date.now()}.jpg`;
  const task = uploadBytesResumable(ref(st, path), f, { contentType: f.type || "image/jpeg" });
  task.on("state_changed", null, e=>alert(e?.message||e), async ()=>{
    const url = await getDownloadURL(ref(st, path));
    await updateProfile(user, { photoURL:url });
    await setDoc(doc(db,"users",user.uid), { photoURL:url, updatedAt:serverTimestamp() }, { merge:true });
    avatar.src = url;
    alert("Profil fotoğrafı güncellendi.");
  });
});

btnSaveProfile?.addEventListener("click", async ()=>{
  const user = auth.currentUser; if(!user) return alert("Giriş gerekli");
  const data = {
    displayName: (inpDisplayName.value||"").trim() || null,
    username: (inpUsername.value||"").trim() || null,
    email: user.email || (inpEmail.value||"").trim() || null,
    updatedAt: serverTimestamp()
  };
  try{
    if(data.displayName) await updateProfile(user, { displayName:data.displayName });
    await setDoc(doc(db,"users",user.uid), data, { merge:true });
    if((inpPass.value||"").trim().length >= 6){
      try{ await updatePassword(user, inpPass.value.trim()); alert("Şifre güncellendi"); }
      catch(e){ alert("Şifre güncellenemedi: " + (e?.message||e)); }
    }
    alert("Profil kaydedildi.");
  }catch(e){ alert(e?.message||e); }
});

btnSendReset?.addEventListener("click", async ()=>{
  const user = auth.currentUser;
  const email = user?.email || (inpEmail.value||"").trim();
  if(!email) return alert("E-posta bulunamadı.");
  try{ await sendPasswordResetEmail(auth, email); alert("Şifre sıfırlama e-postası gönderildi."); }
  catch(e){ alert(e?.message||e); }
});

function start(){
  onAuthStateChanged(auth, async (user)=>{
    const usingUid = getTargetUid() || user?.uid || null;

    // Gate sadece UID yoksa görünür
    showGate(!usingUid);
    btnLogout.style.display = user ? "inline-block" : "none";

    if(!usingUid){
      nameEl.textContent="Profil"; uidEl.textContent="—";
      avatar.src="https://i.imgur.com/3SgkGmQ.png";
      note.style.display="block"; note.textContent="Giriş yapın veya URL'ye ?uid ekleyin.";
      listEl.innerHTML=""; stat.textContent="—";
      return;
    }

    await loadUser(usingUid);
    $$(".tab").forEach(x=>x.classList.remove("active"));
    const fst=$('.tab[data-tab="pub"]'); if(fst) fst.classList.add("active");
    tabsWire(usingUid);
    await renderListings(usingUid,"pub");
  });
}
document.addEventListener("DOMContentLoaded", start);

// ==== Profil Paneli Bağlama + Renk Döngüsü ====
import { updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { setDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

(function wireProfilePanel(){
  const panel = document.getElementById("profilePanel");
  if(!panel) return;

  // Renk döngüsü (5 renk)
  const COLORS = ["#b9e6ff","#c8f7c5","#ffeaa3","#ffc7d6","#d9c7ff"];
  let ci = 0;
  setInterval(()=>{ document.documentElement.style.setProperty("--panel-accent", COLORS[ci=(ci+1)%COLORS.length]); }, 2500);

  const el = sel => document.getElementById(sel);
  const note = el("profNote");
  const avatarPreview = el("prof_avatarPreview");
  const fPhoto = el("prof_photo");
  const fName  = el("prof_displayName");
  const fUser  = el("prof_username");
  const fMail  = el("prof_email");
  const btnSave = el("btnSaveProfile");
  const btnReset= el("btnSendReset");

  // Mevcut auth durumuna göre doldur
  import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js").then(async ({ getAuth })=>{
    const auth = getAuth();
    const st   = getStorage();

    auth.onAuthStateChanged(async (user)=>{
      if(!user){ note.textContent="Giriş yapmamışsın."; return; }

      // users/{uid} oku
      const uref = doc((await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')).getFirestore(), "users", user.uid);
      let udoc;
      try{ const s=await getDoc(uref); udoc = s.exists()? s.data(): {}; }catch{}

      // formu doldur
      fName.value = udoc.displayName || user.displayName || "";
      fUser.value = udoc.username    || "";
      fMail.value = user.email || "";

      const photoURL = udoc.photoURL || user.photoURL || "";
      avatarPreview.src = photoURL || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='100%' height='100%' fill='%23111'/><text x='50%' y='54%' font-size='22' fill='%23aaa' text-anchor='middle' font-family='Inter,Arial'>Avatar</text></svg>";

      // Şifre sıfırlama
      btnReset.onclick = async ()=>{
        try{
          await sendPasswordResetEmail(auth, user.email);
          note.textContent = "Sıfırlama e-postası gönderildi.";
        }catch(e){ note.textContent = "Şifre sıfırlama hata: "+e.message; }
      };

      // Foto yükleme
      fPhoto.onchange = async ()=>{
        const file = fPhoto.files?.[0]; if(!file) return;
        note.textContent = "Yükleniyor…";
        try{
          const key = `users/${user.uid}/avatar-${Date.now()}-${file.name.replace(/[^a-z0-9_.-]/gi,'_')}`;
          const r   = ref(st, key);
          const up  = uploadBytesResumable(r, file, { contentType:file.type||"image/jpeg" });
          await new Promise((res,rej)=>{ up.on("state_changed",()=>{},rej,res); });
          const url = await getDownloadURL(r);
          avatarPreview.src = url;
          await updateProfile(user, { photoURL:url });
          await setDoc(uref, { photoURL:url, updatedAt:serverTimestamp() }, { merge:true });
          note.textContent = "Profil fotoğrafı güncellendi.";
        }catch(e){
          note.textContent = "Foto yükleme hata: " + (e.message||e);
        }
      };

      // Profil kaydet
      btnSave.onclick = async ()=>{
        note.textContent = "Kaydediliyor…";
        try{
          const patch = {
            displayName: fName.value.trim(),
            username:    fUser.value.trim(),
            email:       user.email,
            updatedAt:   serverTimestamp()
          };
          if(patch.displayName && patch.displayName !== (user.displayName||"")){
            await updateProfile(user, { displayName: patch.displayName });
          }
          await setDoc(uref, patch, { merge:true });
          note.textContent = "Kaydedildi.";
        }catch(e){
          note.textContent = "Kaydetme hata: " + (e.message||e);
        }
      };
    });
  });
})();
