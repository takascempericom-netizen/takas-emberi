// js/listing-new.js
// Kullanıcı ilan formu: #listingForm, #title, #desc, #images (multiple file input)

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-auth.js";
import { getStorage, ref as sref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-storage.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-firestore.js";
import { app } from "./firebase-config.js";  // kendi config dosyan

const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

const form = document.getElementById('listingForm');
const imagesInput = document.getElementById('images');

onAuthStateChanged(auth, (user) => {
  if (!user) {
    console.warn('Giriş yapılmamış, auth sayfasına yönlendirin.');
  }
});

async function uploadImageFile(file, uid) {
  const safeName = Date.now() + "_" + file.name.replace(/\s+/g, "_");
  const path = \`listings/\${uid}/\${safeName}\`;
  const r = sref(storage, path);
  const task = uploadBytesResumable(r, file);
  return new Promise((resolve, reject) => {
    task.on('state_changed', ()=>{}, reject, async () => {
      try {
        const url = await getDownloadURL(r);
        resolve(url);
      } catch (e) {
        reject(e);
      }
    });
  });
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return alert('Lütfen giriş yapın.');

    const title = (document.getElementById('title')?.value || '').trim();
    const desc  = (document.getElementById('desc')?.value || '').trim();
    const files = imagesInput?.files || [];

    if (!title) return alert('Başlık gerekli.');

    // 1) Resimleri yükle
    const urls = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const url = await uploadImageFile(files[i], user.uid);
        urls.push(url);
      }
    } catch (err) {
      console.error('Storage yükleme hatası:', err);
      return alert('Resim yüklenemedi: ' + (err?.message || err));
    }

    // 2) Firestore'a ilan ekle (pending)
    try {
      const expires = new Date();
      expires.setMonth(expires.getMonth() + 1);

      await addDoc(collection(db, 'listings'), {
        ownerId: user.uid,
        title,
        description: desc,
        images: urls,
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: expires,
        views: 0
      });

      alert('İlan kaydedildi. Admin onayı sonrası yayına girecek.');
      // yönlendirme istersen:
      // location.href = "/profile.html";
    } catch (err) {
      console.error('Firestore ekleme hatası:', err);
      alert('İlan kaydı başarısız: ' + (err?.message || err));
    }
  });
}
