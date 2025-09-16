/* Firestore SDK ile patchListing override */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* Mevcut projeyi kullan (home.html ile aynı cfg) */
const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};
const app = getApps().length ? getApps()[0] : initializeApp(cfg);
getAuth(app);
const db = getFirestore(app);

/* REST sürümünü görünmez şekilde ez: mevcut click handler"lar window.patchListing çağırıyor */
window.patchListing = async function(id, fields){
  try{
    const ref = doc(db, "listings", id);
    const data = {};
    for (const k of Object.keys(fields||{})) {
      const v = fields[k];
      if (k === "expiresAt") {
        const iso = v && v.timestampValue ? v.timestampValue : (typeof v === "string" ? v : null);
        data[k] = iso ? Timestamp.fromDate(new Date(iso)) : Timestamp.fromDate(new Date());
      } else if (v && typeof v === "object" && "stringValue" in v) {
        data[k] = v.stringValue;
      } else {
        data[k] = v;
      }
    }
    await updateDoc(ref, data);
    return { ok: true };
  }catch(e){
    console.warn("[patchListing SDK] hata:", e);
    throw e;
  }
};
