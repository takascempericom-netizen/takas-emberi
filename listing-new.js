/*
  listing-new.js
  - Handles auth-check, form submit, create listing doc, upload photos, update doc.
  - Designed to work with listing-new.html (ids: listingForm, photos, note, overlay, overlayOk).
  - Uses Firebase Web SDK v10 modules.
*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, collection, addDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref as sref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, useFetchStreams: false });
const st = getStorage(app);

// small logger
function D(...a){ try{ console.debug('[listing-new]', ...a); }catch(_){} }
function E(...a){ try{ console.error('[listing-new]', ...a); }catch(_){} }

// DOM
const form = document.getElementById('listingForm');
const photosInput = document.getElementById('photos');
const note = document.getElementById('note');
const overlay = document.getElementById('overlay');
const overlayOk = document.getElementById('overlayOk');
const submitBtn = document.getElementById('btnSubmit');
const catEl = document.getElementById('cat');
const subEl = document.getElementById('subcat');

// small UX helpers
function showNote(txt){ if(note) note.textContent = txt; D('note:', txt); }
function showOverlay(){ overlay?.classList.add('show'); overlay?.setAttribute('aria-hidden','false'); }
function hideOverlay(){ overlay?.classList.remove('show'); overlay?.setAttribute('aria-hidden','true'); }

// require logged in user — if not, try Google popup (best-effort)
async function ensureSignedIn(){
  if(auth.currentUser) return auth.currentUser;
  try{
    D('No user, trying signInWithPopup');
    const res = await signInWithPopup(auth, new GoogleAuthProvider());
    D('Signed in', res?.user?.uid);
    return res.user;
  }catch(err){
    E('signIn failed', err);
    throw new Error('Giriş gerekli. Lütfen giriş yapıp tekrar deneyin.');
  }
}

// simple file validations
function validateFiles(files){
  const arr = Array.from(files || []).filter(f => (f.type||'').startsWith('image/'));
  if(arr.length === 0) throw new Error('En az 1 fotoğraf seçmelisiniz.');
  if(arr.length > 5) return arr.slice(0,5);
  return arr;
}

// create listing doc and upload photos, update doc with URLs
async function createListingAndUpload({ user, title, desc, category, subcategory, city, meta }) {
  showNote('⏳ İlan kaydediliyor (Firestore)...');
  // create doc
  const base = {
    ownerId: user.uid,
    title: title || '',
    desc: desc || '',
    category: category || '',
    subcategory: subcategory || '',
    city: city || '',
    photos: [],
    coverPhoto: null,
    status: "pending",
    pendingAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  // include meta fields (flat under meta.*)
  for(const k in meta) {
    if(!Object.prototype.hasOwnProperty.call(base, k)) base[k] = meta[k];
  }

  let docRef;
  try{
    docRef = await addDoc(collection(db, "listings"), base);
    D('addDoc success', docRef.id);
  }catch(err){
    E('addDoc failed', err);
    throw new Error('Firestore addDoc hatası: ' + (err?.message||err));
  }

  // upload files
  const files = validateFiles(photosInput.files);
  showNote('⏳ Fotoğraflar yükleniyor (0/' + files.length + ')...');
  const urls = [];
  for(let i=0;i<files.length;i++){
    const f = files[i];
    const safeName = f.name.replace(/[^a-z0-9_.-]/gi,'_');
    const path = `listings/${docRef.id}/${Date.now()}_${safeName}`;
    const ref = sref(st, path);
    D('upload start', path);
    const task = uploadBytesResumable(ref, f);
    await new Promise((res, rej) => {
      task.on('state_changed', (s) => {
        try{
          const p = Math.round( (s.bytesTransferred / (s.totalBytes||1)) * 100 );
          showNote(`⏳ Fotoğraflar yükleniyor (${i+1}/${files.length}) — ${p}%`);
          D('upload progress', {file:f.name, percent:p});
        }catch(_){}
      }, (err) => { E('upload error', err); rej(err); }, () => { res(); });
    });
    try{
      const url = await getDownloadURL(task.snapshot.ref);
      urls.push(url);
      D('uploaded url', url);
    }catch(err){
      E('getDownloadURL failed', err);
      // continue but surface error
      throw new Error('Fotoğraf URL alma hatası: '+(err?.message||err));
    }
  }

  // update doc with photos & coverPhoto
  try{
    await updateDoc(doc(db, "listings", docRef.id), {
      photos: urls,
      coverPhoto: urls[0] || null,
      updatedAt: serverTimestamp()
    });
    D('updateDoc success', docRef.id);
  }catch(err){
    E('updateDoc failed', err);
    throw new Error('Firestore updateDoc hatası: '+(err?.message||err));
  }

  return docRef.id;
}

// form submit handler
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn?.setAttribute('disabled','true');
  try{
    const user = await ensureSignedIn();
    // collect values
    const title = (document.getElementById('title')?.value || '').trim();
    const desc = (document.getElementById('desc')?.value || '').trim();
    const category = (catEl?.value || '').trim();
    const subcategory = (subEl?.value || '').trim();
    const city = (document.getElementById('city')?.value || '').trim();

    // collect meta fields
    const meta = {};
    Array.from(document.querySelectorAll('#metaFields [name]')).forEach(inp=>{
      const name = inp.name.replace(/^meta\./,'');
      meta[name] = inp.value;
    });

    if(!category){ alert('Lütfen ana kategori seçin'); catEl.focus(); submitBtn?.removeAttribute('disabled'); return; }
    if(!subcategory){ alert('Lütfen alt kategori seçin'); subEl.focus(); submitBtn?.removeAttribute('disabled'); return; }

    // main action
    showNote('⏳ İlan oluşturuluyor, lütfen bekleyin...');
    const id = await createListingAndUpload({ user, title, desc, category, subcategory, city, meta });
    showNote('✅ İlan oluşturuldu (id: ' + id + '). Moderatöre gönderildi.');

    // show overlay confirmation (HTML also shows overlay)
    showOverlay();
  }catch(err){
    E('submit error', err);
    alert(err?.message || String(err));
    showNote('❌ Hata: ' + (err?.message || String(err)));
  }finally{
    submitBtn?.removeAttribute('disabled');
  }
});

// overlay ok: close and navigate to profile pending
overlayOk?.addEventListener('click', () => {
  hideOverlay();
  try{ location.href = '/profile.html#pending'; }catch(_){}
});

// simple auth state logging (optional)
onAuthStateChanged(auth, (u) => {
  D('auth state changed:', !!u ? u.uid : null);
});

// quick helper: if user isn't signed when form loads, don't force popup — leave it to submit flow
D('listing-new.js loaded');
