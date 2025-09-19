import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, collection, addDoc, updateDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref as sref, uploadBytesResumable, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth ? getAuth(app) : null;
const db   = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, useFetchStreams: false });
const st   = getStorage(app);

// Debug helper
function D(...args){ try{ console.debug('[listing-new]', ...args); }catch(_){} }
function E(...args){ try{ console.error('[listing-new]', ...args); }catch(_){} }

D('Firebase app options:', { projectId: app.options?.projectId, apiKey: (app.options?.apiKey||'').slice(0,8)+'…', storageBucket: app.options?.storageBucket });

// UI elemanları
const userBox = document.getElementById('userBox');
const login   = document.getElementById('login');
const form    = document.getElementById('form');
const note    = document.getElementById('note');
const btnGoogle = document.getElementById('btnGoogle');
const btnCancel = document.getElementById('btnCancel');
const preview   = document.getElementById('preview');
const inputPhotos = document.getElementById('photos');

D('DOM elements', { userBox: !!userBox, login: !!login, form: !!form, photos: !!inputPhotos });

// Foto önizleme
inputPhotos?.addEventListener('change', () => {
  let files = Array.from(inputPhotos.files || []);
  files = files.filter(f => (f.type || '').startsWith('image/'));
  if (files.length === 0) { alert('En az 1 fotoğraf seçmelisin (sadece görüntü dosyaları).'); return; }
  if (files.length > 5) { alert("En fazla 5 fotoğraf yükleyebilirsin. İlk 5'i alınacak."); files = files.slice(0,5); }
  for (const ff of files) { if (ff.size > 10*1024*1024) { alert('Foto 10MB üstü: ' + ff.name); return; } }
  [...preview.querySelectorAll('.slot')].forEach((slot,i)=>{
    const img = slot.querySelector('img'); if(img) img.remove();
    slot.querySelector('span')?.classList.remove('hidden');
    if(files[i]){
      const url = URL.createObjectURL(files[i]);
      const im = new Image();
      im.src = url;
      slot.appendChild(im);
      slot.querySelector('span')?.classList.add('hidden');
    }
    slot.querySelector('.bar').style.width = '0%';
  });
});

// Auth durumu
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    D('onAuthStateChanged: not signed in');
    try{ if(userBox) userBox.textContent = "Giriş yapmadınız"; }catch(_){}
    login?.classList.remove('hidden');
    form?.classList.add('hidden');
    return;
  }
  D('onAuthStateChanged: user=', { uid: user.uid, email: user.email, name: user.displayName });
  try{ userBox.innerHTML = `👤 ${user.displayName || user.email} • <a href="#" id="lnkOut">Çıkış</a>`; }catch(_){}
  login?.classList.add('hidden');
  form?.classList.remove('hidden');
  document.getElementById('lnkOut')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    D('signOut requested');
    try{ await signOut(auth); D('signOut ok'); }catch(err){ E('signOut error', err); alert('Çıkış hata: '+(err?.message||err)); }
  });
});

// Google ile giriş
btnGoogle?.addEventListener('click', async ()=> {
  try{
    D('signInWithPopup start');
    const res = await signInWithPopup(auth, new GoogleAuthProvider());
    D('signInWithPopup result', res?.user?.uid);
  }catch(e){ E('signInWithPopup error', e); alert("Giriş başarısız: " + (e?.message||e)); }
});

// Vazgeç
btnCancel?.addEventListener('click', ()=> {
  if (confirm("Formu temizlemek istiyor musunuz?")) {
    form.reset();
    note.textContent = "";
    [...preview.querySelectorAll('.bar')].forEach(b=>b.style.width="0%");
    [...preview.querySelectorAll('img')].forEach(im=>im.remove());
    D('form reset');
  }
});

// Form gönder
form?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const user = auth.currentUser;
  D('form submit by user', user ? user.uid : null);
  if(!user){ alert("Önce giriş yapın"); return; }
  try{
    // attempt to refresh token if possible (best-effort)
    try{ if(user.getIdToken) { await user.getIdToken(true); D('idToken refreshed'); } }catch(tkE){ D('idToken refresh failed', tkE?.message||tkE); }

    const title = document.getElementById('title').value.trim();
    const desc  = document.getElementById('desc').value.trim();
    const cat   = document.getElementById('cat').value;
    const city  = document.getElementById('city').value.trim();
    const price = document.getElementById('price').value;

    note.innerHTML = "⏳ İlan kaydediliyor...";
    D('creating listing doc...', { ownerId: user.uid, title, cat, city });

    // 1. Firestore doc oluştur
    let docRef = null;
    try{
      docRef = await addDoc(collection(db,"listings"),{
        ownerId: user.uid,
        // Admin panelleri için geniş uyumluluk alanları (boş bırakıldı)
        pendingAt: serverTimestamp(),
        title, desc, category:cat, city,
        price: price? Number(price): null,
        photos: [],
        coverPhoto: null,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      D('addDoc success, id=', docRef.id);
    }catch(addErr){
      E('addDoc failed', addErr);
      note.innerHTML = "<span class='danger'>❌ Firestore addDoc hata: "+(addErr?.message||addErr)+"</span>";
      alert('Firestore addDoc hata: '+(addErr?.message||addErr));
      return;
    }

    // 2. Fotoğrafları yükle
    let files = Array.from(inputPhotos.files || []);
    files = files.filter(f => (f.type || '').startsWith('image/'));
    if (files.length === 0) { alert('En az 1 fotoğraf seçmelisin (sadece görüntü dosyaları).'); return; }
    if (files.length > 5) { alert("En fazla 5 fotoğraf yükleyebilirsin. İlk 5'i alınacak."); files = files.slice(0,5); }
    for (const ff of files) { if (ff.size > 10*1024*1024) { alert('Foto 10MB üstü: ' + ff.name); return; } }

    const urls=[];
    for(let i=0;i<files.length;i++){
      const f = files[i];
      const path = `listings/${docRef.id}/${Date.now()}_${f.name.replace(/[^a-z0-9_.-]/gi,'_')}`;
      const ref = sref(st, path);
      D('upload start', { file: f.name, path });
      const task = uploadBytesResumable(ref, f);
      const bar=preview.querySelectorAll('.bar')[i];
      try{
        await new Promise((res,rej)=>task.on('state_changed',(s)=>{
          const p=Math.round((s.bytesTransferred/s.totalBytes)*100);
          if(bar) bar.style.width=p+'%';
          D('upload progress', { file: f.name, percent: p });
        },(err)=>{ rej(err); }, ()=>{ res(); }));
      }catch(uErr){
        E('upload error for', f.name, uErr);
        note.innerHTML = "<span class='danger'>❌ Foto yükleme hatası: "+(uErr?.message||uErr)+"</span>";
        alert('Foto yükleme hatası: '+(uErr?.message||uErr));
        return;
      }
      try{
        const url = await getDownloadURL(task.snapshot.ref);
        D('upload success', { file: f.name, url });
        urls.push(url);
      }catch(urlErr){
        E('getDownloadURL error', urlErr);
        note.innerHTML = "<span class='danger'>❌ URL alma hatası: "+(urlErr?.message||urlErr)+"</span>";
        alert('URL alma hatası: '+(urlErr?.message||urlErr));
        return;
      }
    }

    // 3. Firestore doc güncelle
    try{
      await updateDoc(doc(db,"listings",docRef.id),{
        photos:urls, coverPhoto:urls[0]||null, updatedAt:serverTimestamp()
      });
      D('updateDoc success', { id: docRef.id, photos: urls.length });
    }catch(upErr){
      E('updateDoc failed', upErr);
      note.innerHTML = "<span class='danger'>❌ Firestore updateDoc hata: "+(upErr?.message||upErr)+"</span>";
      alert('Firestore updateDoc hata: '+(upErr?.message||upErr));
      return;
    }

    note.innerHTML = "<span class='ok'><b>✅ İlan gönderildi.</b></span> Onay sonrası yayına alınacak.";
    form.reset();
    D('form submit finished for doc', docRef.id);
  }catch(err){
    E('unexpected error on submit', err);
    note.innerHTML = "<span class='danger'>❌ Hata: "+(err?.message||err)+"</span>";
    alert('Beklenmeyen hata: '+(err?.message||err));
  }
});
