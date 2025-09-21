// takas-emberi/ilan/ilanver.js — FINAL (ownerId + pending, fotoğraflar ana dokümana)

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection, addDoc, serverTimestamp,
  query, where, getDocs,
  doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

// Init
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
// Bucket'ı net belirt (CORS ile uyumlu)
const storage = getStorage(app, "gs://ureten-eller-v2.firebasestorage.app");

// UI
const form        = document.getElementById("listingForm");
const photosInput = document.getElementById("photos");

const banned = ["piç","orospu","sik","amk","şerefsiz","b.k","pezevenk","dolandırıcı","terror"];

let currentUser = null;
onAuthStateChanged(auth, (user)=>{
  if (user) {
    currentUser = user;
  } else {
    alert("Lütfen giriş yapın. İlan verebilmek için oturum açmanız gerekiyor.");
    window.location.href = "/auth.html";
  }
});

// ---- Helpers ----
const safeName = (name)=> (name || "").replace(/[^a-zA-Z0-9._-]/g, "_");

// Fotoğraf yükleme
async function uploadPhotos(uid, ilanId, files) {
  const urls = [];
  for (let i = 0; i < (files?.length || 0); i++) {
    const file = files[i];
    const storageRef = ref(storage, `listings/${uid}/${ilanId}/${Date.now()}_${safeName(file.name)}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    urls.push(url);
  }
  return urls;
}

// Kullanıcının ilan sayısı
async function checkUserListings(uid) {
  const q = query(collection(db, "listings"), where("ownerId", "==", uid));
  const snap = await getDocs(q);
  return snap.size;
}

// ---- Form submit ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const title     = document.getElementById("title").value.trim();
  const desc      = document.getElementById("desc").value.trim();
  const city      = document.getElementById("city").value;
  const district  = document.getElementById("district").value.trim();
  const cat       = document.getElementById("cat").value;
  const cond      = document.getElementById("cond").value;
  const subcatFields = (document.getElementById("subcatFields")?.innerText || "").trim();

  // Küfür filtresi
  const text = (title + " " + desc).toLowerCase();
  if (banned.some(w => text.includes(w))) {
    alert("Toplum kurallarına aykırı kelime tespit edildi. Lütfen düzeltin.");
    return;
  }

  // İlan sayısı kontrol (ilk ilan ücretsiz, sonrası ücretli örneği)
  const ilanCount    = await checkUserListings(currentUser.uid);
  const needsPayment = ilanCount >= 1;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  try {
    // 1) İlanı oluştur (kurallara uygun: ownerId + status='pending')
    const payload = {
      ownerId: currentUser.uid,
      status: "pending",                 // ilk kayıt her zaman pending
      title,
      description: desc,                 // desc -> description
      city,
      district,
      cat,
      cond,
      subcat: subcatFields,
      needsPayment,
      createdAt: serverTimestamp(),
      expiresAt
    };

    const docRef = await addDoc(collection(db, "listings"), payload);

    // 2) Fotoğrafları yükle (varsa) ve ana dokümana yaz
    const files = photosInput?.files || [];
    if (files.length) {
      const urls = await uploadPhotos(currentUser.uid, docRef.id, files);
      await updateDoc(doc(db, "listings", docRef.id), {
        photos: urls,
        updatedAt: serverTimestamp()
      });
    }

    alert("İlanınız admin onayına gönderildi.");
    form.reset();
    const preview = document.getElementById("preview");
    if (preview) preview.innerHTML = "";

  } catch (err) {
    console.error(err);
    alert("İlan gönderilirken hata oluştu: " + (err?.message || String(err)));
  }
});
