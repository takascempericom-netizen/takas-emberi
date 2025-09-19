// admin/admin-approve.js
// Admin panelinizde <script type="module" src="/admin/admin-approve.js"></script> olarak ekleyin.
// Onay butonunda: <button onclick="approve('LISTING_ID')">Onayla</button>

import { app } from "../js/firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.24.0/firebase-firestore.js";

const auth = getAuth(app);
const db   = getFirestore(app);

// Basit admin kontrolü: users/{uid}.role === 'admin'
let IS_ADMIN = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) return; // Gerekirse: location.href="/auth.html";
  try {
    const uref = doc(db, "users", user.uid);
    const usnap = await getDoc(uref);
    const role = usnap.exists() ? (usnap.data().role || "user") : "user";
    IS_ADMIN = (role === "admin");
    if (!IS_ADMIN) {
      console.warn("Admin yetkisi yok.");
    }
  } catch (e) {
    console.warn("Admin kontrolü okunamadı:", e);
  }
});

// Küresel fonksiyon: admin onayı → published
window.approve = async function approve(listingId) {
  if (!listingId) return alert("Geçersiz ilan ID");
  if (!IS_ADMIN)  return alert("Admin yetkisi gerekli.");

  if (!confirm("Bu ilanı yayına almak istiyor musunuz?")) return;

  try {
    const lref = doc(db, "listings", listingId);
    await updateDoc(lref, {
      status: "published",
      publishedAt: serverTimestamp()
    });
    alert("İlan yayına alındı.");
    // İsteğe bağlı yenile:
    // location.reload();
  } catch (err) {
    console.error("Onay hatası:", err);
    alert("Onay hatası: " + (err?.message || err));
  }
};

// (Opsiyonel) Reddetme fonksiyonu
window.rejectListing = async function rejectListing(listingId) {
  if (!listingId) return alert("Geçersiz ilan ID");
  if (!IS_ADMIN)  return alert("Admin yetkisi gerekli.");

  if (!confirm("Bu ilanı reddetmek istiyor musunuz?")) return;

  try {
    const lref = doc(db, "listings", listingId);
    await updateDoc(lref, {
      status: "rejected",
      rejectedAt: serverTimestamp()
    });
    alert("İlan reddedildi.");
    // location.reload();
  } catch (err) {
    console.error("Reddetme hatası:", err);
    alert("Reddetme hatası: " + (err?.message || err));
  }
};
