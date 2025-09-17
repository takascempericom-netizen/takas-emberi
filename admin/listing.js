import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const who = document.getElementById('who');
const note = document.getElementById('note');
const meta = document.getElementById('meta');
const photos = document.getElementById('photos');

const params = new URLSearchParams(location.search);
const id = params.get('id');

function tag(txt){ return `<span class="tag">${txt}</span>`; }

async function render(user){
  if(!id){ note.innerHTML = '<span class="err">ID parametresi yok (?id=...)</span>'; return; }

  const ref = doc(db, "listings", id);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    note.innerHTML = '<span class="err">İlan bulunamadı.</span>';
    return;
  }
  const d = snap.data();

  // Sahip bilgisi (varsayılan alan isimleri)
  let ownerLine = d.ownerId || '-';
  try{
    const uref = doc(db, "users", d.ownerId);
    const usnap = await getDoc(uref);
    if(usnap.exists()){
      const ud = usnap.data();
      ownerLine = `${ud.displayName || ud.username || '-'} <span class="muted">(${d.ownerId})</span>`;
    }
  }catch{}

  const statusLine = [
    tag(`status: ${d.status||'-'}`),
    d.state ? tag(`state: ${d.state}`) : '',
    d.moderation ? tag(`moderation: ${d.moderation}`) : '',
    (d.approved!==undefined) ? tag(`approved: ${d.approved}`) : '',
    (d.isApproved!==undefined) ? tag(`isApproved: ${d.isApproved}`) : ''
  ].join(' ');

  meta.innerHTML = `
    <div>
      <h3 style="margin:0 0 6px">${d.title || '-'}</h3>
      <div class="muted">${d.category||'-'} • ${d.city||'-'}</div>
      <div class="kv">
        <div><b>Doc ID</b></div><div>${id}</div>
        <div><b>Sahibi</b></div><div>${ownerLine}</div>
        <div><b>Durum</b></div><div>${statusLine}</div>
        <div><b>Fiyat/Değer</b></div><div>${d.price ?? '-'}</div>
        <div><b>Oluşturma</b></div><div>${d.createdAt?.toDate?.() || '-'}</div>
        <div><b>Güncelleme</b></div><div>${d.updatedAt?.toDate?.() || '-'}</div>
      </div>
    </div>
    <div>
      <label><b>Açıklama</b></label>
      <div style="white-space:pre-wrap;border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff;min-height:120px">${(d.desc||'').replace(/[<>&]/g,s=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}</div>
    </div>
  `;

  photos.innerHTML = (d.photos||[]).map(u=>`<div class="ph"><a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="photo"/></a></div>`).join('') || '<div class="muted">Fotoğraf yok</div>';

  // Butonlar
  const btnApprove = document.getElementById('btnApprove');
  const btnReject  = document.getElementById('btnReject');
  const btnExpire  = document.getElementById('btnExpire');
  const btnDelete  = document.getElementById('btnDelete');
  const rejReason  = document.getElementById('rejReason');

  btnApprove.onclick = async ()=>{
    try{
      await updateDoc(ref, {
        status: "active",
        state: "approved",
        moderation: "approved",
        approved: true,
        isApproved: true,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      note.innerHTML = '<span class="ok">✅ Yayına alındı.</span>';
      await render(user);
    }catch(e){ note.innerHTML = '<span class="err">Hata: '+(e?.message||e)+'</span>'; }
  };

  btnReject.onclick = async ()=>{
    try{
      await updateDoc(ref, {
        status: "rejected",
        state: "rejected",
        moderation: "rejected",
        approved: false,
        isApproved: false,
        rejectedAt: serverTimestamp(),
        rejectionReason: rejReason.value || null,
        updatedAt: serverTimestamp()
      });
      note.innerHTML = '<span class="ok">❎ Reddedildi.</span>';
      await render(user);
    }catch(e){ note.innerHTML = '<span class="err">Hata: '+(e?.message||e)+'</span>'; }
  };

  btnExpire.onclick = async ()=>{
    try{
      await updateDoc(ref, {
        status: "expired",
        state: "expired",
        updatedAt: serverTimestamp(),
        expiresAt: serverTimestamp()
      });
      note.innerHTML = '<span class="ok">⏱ Süresi doldu olarak işaretlendi.</span>';
      await render(user);
    }catch(e){ note.innerHTML = '<span class="err">Hata: '+(e?.message||e)+'</span>'; }
  };

  btnDelete.onclick = async ()=>{
    if(!confirm("Kalıcı olarak silinsin mi? Bu işlem geri alınamaz.")) return;
    try{
      // Güvenlik kuralları silmeye izin veriyorsa (isAdmin() true) başarılı olur.
      // Silmeyi istersen ayrı admin arayüzünden yap; burada sadece Firestore doc silme var.
      await updateDoc(ref, { status: "deleted", updatedAt: serverTimestamp() });
      note.innerHTML = '<span class="ok">🗑 Silindi (status=deleted).</span>';
    }catch(e){ note.innerHTML = '<span class="err">Hata: '+(e?.message||e)+'</span>'; }
  };
}

onAuthStateChanged(auth, async (u) => {
  if(!u){
    who.textContent = "Giriş yapmadınız";
    try{
      await signInWithPopup(auth, new GoogleAuthProvider());
    }catch(e){
      note.innerHTML = '<span class="err">Giriş gerekiyor.</span>';
      return;
    }
  }
  const user = auth.currentUser;
  who.innerHTML = `👤 ${user.displayName || user.email} • <a href="#" id="lnkOut">Çıkış</a>`;
  document.getElementById('lnkOut').onclick = async (e)=>{ e.preventDefault(); await signOut(auth); location.reload(); };
  await user.getIdToken(true);
  render(user);
});
