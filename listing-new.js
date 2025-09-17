import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, doc, serverTimestamp
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
const auth = getAuth(app);
const db   = getFirestore(app);
const st   = getStorage(app);

// UI elemanları
const userBox = document.getElementById('userBox');
const login   = document.getElementById('login');
const form    = document.getElementById('form');
const note    = document.getElementById('note');
const btnGoogle = document.getElementById('btnGoogle');
const btnCancel = document.getElementById('btnCancel');
const preview   = document.getElementById('preview');
const inputPhotos = document.getElementById('photos');

// Foto önizleme
inputPhotos?.addEventListener('change', () => {
  const files = Array.from(inputPhotos.files || []).slice(0,5);
  [...preview.querySelectorAll('.slot')].forEach((slot,i)=>{
    const img = slot.querySelector('img');
    if(img) img.remove();
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
    userBox.textContent = "Giriş yapmadınız";
    login.classList.remove('hidden');
    form.classList.add('hidden');
    return;
  }
  userBox.innerHTML = `👤 ${user.displayName || user.email} • <a href="#" id="lnkOut">Çıkış</a>`;
  login.classList.add('hidden');
  form.classList.remove('hidden');
  document.getElementById('lnkOut').addEventListener('click', async (e)=>{
    e.preventDefault();
    await signOut(auth);
  });
});

// Google ile giriş
btnGoogle?.addEventListener('click', async ()=>{
  try{
    await signInWithPopup(auth, new GoogleAuthProvider());
  }catch(e){ alert("Giriş başarısız: " + (e?.message||e)); }
});

// Vazgeç
btnCancel?.addEventListener('click', ()=> {
  if (confirm("Formu temizlemek istiyor musunuz?")) {
    form.reset();
    note.textContent = "";
    [...preview.querySelectorAll('.bar')].forEach(b=>b.style.width="0%");
    [...preview.querySelectorAll('img')].forEach(im=>im.remove());
  }
});

// Form gönder
form?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const user = auth.currentUser;
  if(!user){ alert("Önce giriş yapın"); return; }

  const title = document.getElementById('title').value.trim();
  const desc  = document.getElementById('desc').value.trim();
  const cat   = document.getElementById('cat').value;
  const city  = document.getElementById('city').value.trim();
  const price = document.getElementById('price').value;

  try{
    note.innerHTML = "⏳ İlan kaydediliyor...";
    // 1. Firestore doc oluştur
    const docRef = await addDoc(collection(db,"listings"),{
      ownerId: user.uid,
      title, desc, category:cat, city,
      price: price? Number(price): null,
      photos: [],
      coverPhoto: null,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 2. Fotoğrafları yükle
    const files = Array.from(inputPhotos.files || []).slice(0,5);
    const urls=[];
    for(let i=0;i<files.length;i++){
      const f = files[i];
      const path = `listings/${docRef.id}/${Date.now()}_${f.name}`;
      const ref = sref(st, path);
      const task = uploadBytesResumable(ref, f);

      const bar=preview.querySelectorAll('.bar')[i];
      await new Promise((res,rej)=>task.on('state_changed',(s)=>{
        const p=Math.round((s.bytesTransferred/s.totalBytes)*100);
        if(bar) bar.style.width=p+'%';
      },rej,res));
      urls.push(await getDownloadURL(task.snapshot.ref));
    }

    // 3. Firestore doc güncelle
    await updateDoc(doc(db,"listings",docRef.id),{
      photos:urls, coverPhoto:urls[0]||null, updatedAt:serverTimestamp()
    });

    note.innerHTML = "<span class='ok'><b>✅ İlan gönderildi.</b></span> Onay sonrası yayına alınacak.";
    form.reset();
  }catch(err){
    console.error(err);
    note.innerHTML = "<span class='danger'>❌ Hata: "+(err?.message||err)+"</span>";
  }
});
