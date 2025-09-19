import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword, signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, collection, collectionGroup, getDocs, getDoc, query, where, orderBy, limit,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

const app = initializeApp(cfg);
const auth = getAuth(app);
const db   = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, useFetchStreams: false });

const who = document.getElementById('who');
const note = document.getElementById('note');
const title = document.getElementById('title');

const views = {
  onay: document.getElementById('v-onay'),
  mesaj: document.getElementById('v-mesaj'),
  bildiri: document.getElementById('v-bildiri'),
  akan: document.getElementById('v-akan'),
  kull: document.getElementById('v-kull'),
  sik: document.getElementById('v-sik'),
  ayar: document.getElementById('v-ayar'),
};
const titles = {
  onay: "İlan Onay",
  mesaj: "Mesajlar",
  bildiri: "Bildiri",
  akan: "Akan Yazı",
  kull: "Kullanıcılar",
  sik: "Şikayetler",
  ayar: "Ayarlar"
};

// --- helpers
function fmtDate(ts){
  try{
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('tr-TR') : '—';
  }catch{ return '—'; }
}
function h(html){ const d=document.createElement('div'); d.innerHTML=html.trim(); return d.firstElementChild; }
function show(view){
  for(const k in views) views[k].classList.add('hide');
  views[view].classList.remove('hide');
  title.textContent = titles[view];
  note.textContent = '';
  // lazy render
  if(view==='onay') renderOnay();
  if(view==='mesaj') renderMesaj();
  if(view==='bildiri') renderBildiri();
  if(view==='akan') renderAkan();
  if(view==='kull') renderUsers();
  if(view==='sik') renderSikayet();
  if(view==='ayar') renderAyarlar();
}
document.querySelectorAll('.nav button').forEach(b=>{
  b.onclick=()=>{ document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); show(b.dataset.view); };
});
document.getElementById('btnLogout').onclick = async ()=>{ await signOut(auth); location.reload(); };

// --- admin check
let IS_ADMIN = false;
async function isAdminUser(uid){
  try{
    const uref = doc(db,'users',uid);
    const snap = await getDocs(query(collection(db,'users'), where('uid','==',uid), limit(1))).then(s=>s);
    // prefer direct doc
    try{
      const d = await (await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")).getDoc(uref);
      if(d.exists() && (d.data().role==='admin')) return true;
    }catch{}
    for(const x of snap.docs){ if((x.data().role||'')==='admin') return true; }
    return false;
  }catch{ return false; }
}

// --- render: İlan Onay
async function renderOnay(){
  const box = document.getElementById('onay-list');
  box.innerHTML = 'Yükleniyor…';
  const coll = collection(db,'listings');
  const variants = [
    query(coll, where('status','in',['pending','waiting','bekleyen','onay-bekliyor']), orderBy('createdAt','desc'), limit(50)),
    query(coll, where('state','in',['pending','waiting','bekleyen','onay-bekliyor']), orderBy('createdAt','desc'), limit(50)),
    query(coll, where('moderation','in',['pending','waiting','bekleyen','onay-bekliyor']), orderBy('createdAt','desc'), limit(50)),
  ];
  const seen = new Set(); const items=[];
  for(const qy of variants){
    try{ const snap = await getDocs(qy); snap.forEach(d=>{ if(!seen.has(d.id)){ seen.add(d.id); items.push({id:d.id, ...d.data()}); } }); }catch(e){}
  }
  if(items.length===0){ box.innerHTML = '<div class="muted">Bekleyen ilan yok.</div>'; return; }
  box.innerHTML = '';
  for(const d of items){
    const row = h(`<div class="item">
      <div>
        <div style="font-weight:800">${d.title || '-'}</div>
        <div class="muted">${d.city||'-'} • ${d.category||'-'} • <span class="muted">${fmtDate(d.createdAt)}</span></div>
        <div class="tags">
          <span class="tag">status: ${d.status||'-'}</span>
          ${d.state?`<span class="tag">state: ${d.state}</span>`:''}
          ${d.moderation?`<span class="tag">moderation: ${d.moderation}</span>`:''}
        </div>
      </div>
      <div class="muted">${(d.price ?? '—')} ₺</div>
      <div><a class="btn btn-ghost" href="/admin/index.html#id=${encodeURIComponent(d.id)}" data-open="${d.id}">Detay</a></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ok" data-approve="${d.id}">Yayına Al</button>
        <button class="btn btn-bad" data-reject="${d.id}">Reddet</button>
      </div>
    </div>`);
    box.appendChild(row);
  }
  box.onclick = async (e)=>{
    const a = e.target.closest('[data-approve]'); const r = e.target.closest('[data-reject]');
    if(a){
      if(!IS_ADMIN){ note.textContent='Admin yetkisi gerekli.'; return; }
      try{
        await updateDoc(doc(db,'listings',a.dataset.approve), { status: 'active', state: 'approved', moderation: 'approved', approved: true, isApproved: true, approvedAt: serverTimestamp(), updatedAt: serverTimestamp() });
        a.closest('.item').remove();
      }catch(err){ note.textContent = 'Hata: '+(err?.message||err); }
    }
    if(r){
      if(!IS_ADMIN){ note.textContent='Admin yetkisi gerekli.'; return; }
      try{
        await updateDoc(doc(db,'listings',r.dataset.reject), { status: 'rejected', state: 'rejected', moderation: 'rejected', approved: false, isApproved: false, rejectedAt: serverTimestamp(), updatedAt: serverTimestamp() });
        r.closest('.item').remove();
      }catch(err){ note.textContent = 'Hata: '+(err?.message||err); }
    }
  };
}

// --- render: Mesajlar (public feed)
async function renderMesaj(){
  const info = document.getElementById('msg-info');
  const list = document.getElementById('msg-list');
  const btn = document.getElementById('msg-send');
  const t = document.getElementById('msg-title');
  const b = document.getElementById('msg-body');

  btn.onclick = async ()=>{
    if(!IS_ADMIN){ info.textContent='Admin yetkisi gerekli.'; return; }
    if(!t.value.trim() || !b.value.trim()){ info.textContent='Başlık ve mesaj zorunlu.'; return; }
    try{
      await addDoc(collection(db,'public'), {
        title: t.value.trim(), body: b.value.trim(),
        type:'broadcast', createdAt: serverTimestamp()
      });
      t.value=''; b.value=''; info.textContent='✅ Mesaj yayınlandı.';
      load();
    }catch(err){ info.textContent='Hata: '+(err?.message||err); }
  };

  async function load(){
    list.innerHTML='Yükleniyor…';
    try{
      const snap = await getDocs(query(collection(db,'public'), orderBy('createdAt','desc'), limit(30)));
      list.innerHTML='';
      snap.forEach(d=>{
        const v = d.data();
        const el = h(`<div class="item" style="grid-template-columns:1fr 140px 140px 120px">
          <div><div style="font-weight:800">${v.title||'-'}</div><div class="muted">${v.body||''}</div></div>
          <div class="muted">${v.type||'-'}</div>
          <div class="muted">${fmtDate(v.createdAt)}</div>
          <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-bad" data-del="${d.id}">Sil</button></div>
        </div>`);
        list.appendChild(el);
      });
      list.onclick = async (e)=>{
        const del = e.target.closest('[data-del]');
        if(del){
          if(!IS_ADMIN){ info.textContent='Admin yetkisi gerekli.'; return; }
          try{ await deleteDoc(doc(db,'public',del.dataset.del)); del.closest('.item').remove(); }
          catch(err){ info.textContent='Hata: '+(err?.message||err); }
        }
      };
    }catch(err){ list.innerHTML='Hata: '+(err?.message||err); }
  }
  load();
}

// --- render: Bildiri (yine "public", type='notice')
async function renderBildiri(){
  const info = document.getElementById('bil-info');
  const list = document.getElementById('bil-list');
  const t = document.getElementById('bil-title');
  const b = document.getElementById('bil-body');
  const add = document.getElementById('bil-add');

  add.onclick = async ()=>{
    if(!IS_ADMIN){ info.textContent='Admin yetkisi gerekli.'; return; }
    if(!t.value.trim()||!b.value.trim()){ info.textContent='Başlık ve içerik zorunlu.'; return; }
    try{
      await addDoc(collection(db,'public'),{
        title:t.value.trim(), body:b.value.trim(), type:'notice', createdAt:serverTimestamp()
      });
      t.value=''; b.value=''; info.textContent='✅ Eklendi.'; load();
    }catch(err){ info.textContent='Hata: '+(err?.message||err); }
  };

  async function load(){
    list.innerHTML='Yükleniyor…';
    try{
      const snap = await getDocs(query(collection(db,'public'), where('type','==','notice'), orderBy('createdAt','desc'), limit(50)));
      list.innerHTML='';
      snap.forEach(d=>{
        const v=d.data();
        const el=h(`<div class="item" style="grid-template-columns:1fr 160px 160px 120px">
          <div><div style="font-weight:800">${v.title||'-'}</div><div class="muted">${v.body||''}</div></div>
          <div class="muted">notice</div>
          <div class="muted">${fmtDate(v.createdAt)}</div>
          <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-bad" data-del="${d.id}">Sil</button></div>
        </div>`);
        list.appendChild(el);
      });
      list.onclick = async (e)=>{
        const del = e.target.closest('[data-del]');
        if(del){
          try{ await deleteDoc(doc(db,'public',del.dataset.del)); del.closest('.item').remove(); }
          catch(err){ info.textContent='Hata: '+(err?.message||err); }
        }
      };
    }catch(err){ list.innerHTML='Hata: '+(err?.message||err); }
  }
  load();
}

// --- render: Akan Yazı (announcements)
async function renderAkan(){
  const info = document.getElementById('akan-info');
  const list = document.getElementById('akan-list');
  const txt = document.getElementById('akan-text');
  const add = document.getElementById('akan-add');

  add.onclick = async ()=>{
    if(!IS_ADMIN){ info.textContent='Admin yetkisi gerekli.'; return; }
    if(!txt.value.trim()){ info.textContent='Metin boş olamaz.'; return; }
    try{
      await addDoc(collection(db,'announcements'),{
        text: txt.value.trim(), active:true, createdAt: serverTimestamp()
      });
      txt.value=''; info.textContent='✅ Eklendi.'; load();
    }catch(err){ info.textContent='Hata: '+(err?.message||err); }
  };

  async function load(){
    list.innerHTML='Yükleniyor…';
    try{
      const snap = await getDocs(query(collection(db,'announcements'), orderBy('createdAt','desc'), limit(50)));
      list.innerHTML='';
      snap.forEach(d=>{
        const v=d.data();
        const el=h(`<div class="item" style="grid-template-columns:1fr 120px 160px 160px">
          <div>${v.text||'-'}</div>
          <div class="muted">${v.active?'aktif':'pasif'}</div>
          <div class="muted">${fmtDate(v.createdAt)}</div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-ok" data-toggle="" data-active=""></button>
            <button class="btn btn-bad" data-del="${d.id}">Sil</button>
          </div>
        </div>`);
        list.appendChild(el);
      });
      list.onclick = async (e)=>{
        const t=e.target.closest('[data-toggle]'); const del=e.target.closest('[data-del]');
        if(t){
          try{
            // read active state not fetched again; optimistic toggle:
            await updateDoc(doc(db,'announcements',t.dataset.toggle), { active:true, updatedAt:serverTimestamp() });
            // not reading state; just reload
            load();
          }catch(err){ info.textContent='Hata: '+(err?.message||err); }
        }
        if(del){
          try{ await deleteDoc(doc(db,'announcements',del.dataset.del)); del.closest('.item').remove(); }
          catch(err){ info.textContent='Hata: '+(err?.message||err); }
        }
      };
    }catch(err){ list.innerHTML='Hata: '+(err?.message||err); }
  }
  load();
}

// --- render: Users
let _usersCache = [];
async function renderUsers(){
  const tbody = document.querySelector('#user-table tbody');
  const q = document.getElementById('user-q');
  const refresh = document.getElementById('user-refresh');

  async function load(){
    tbody.innerHTML = '<tr><td colspan="5" class="muted">Yükleniyor…</td></tr>';
    try{
      const snap = await getDocs(query(collection(db,'users'), orderBy('createdAt','desc'), limit(200)));
      _usersCache = snap.docs.map(d=>d.data());
      render(_usersCache);
    }catch(err){
      tbody.innerHTML = `<tr><td colspan="5">Hata: ${err?.message||err}</td></tr>`;
    }
  }
  function render(list){
    const s = (q.value||'').trim().toLowerCase();
    const arr = list.filter(u=>{
      const t = (u.displayName||'')+' '+(u.username||'')+' '+(u.email||'')+' '+(u.uid||'');
      return t.toLowerCase().includes(s);
    });
    tbody.innerHTML = arr.map(u=>`
      <tr>
        <td>${u.displayName||'-'}</td>
        <td>${u.username||'-'}</td>
        <td>${u.email||'-'}</td>
        <td><code>${u.uid||'-'}</code></td>
        <td>${u.role||'-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="muted">Kayıt bulunamadı.</td></tr>';
  }

  q.oninput = ()=>render(_usersCache);
  refresh.onclick = load;
  if(_usersCache.length===0) load(); else render(_usersCache);
}

// --- render: Şikayetler
async function renderSikayet(){
  const list = document.getElementById('sik-list');
  const nt = document.getElementById('sik-note');
  list.innerHTML='Yükleniyor…'; nt.textContent='';
  try{
    // collection group: support/*/messages
    const snap = await getDocs(query(collectionGroup(db,'messages'), where('type','in',['complaint','report']), orderBy('createdAt','desc'), limit(50)));
    list.innerHTML='';
    snap.forEach(d=>{
      const v=d.data();
      const el=h(`<div class="item" style="grid-template-columns:1fr 180px 220px 120px">
        <div><div style="font-weight:800">${v.title||'(şikayet)'}</div><div class="muted">${v.body||''}</div></div>
        <div class="muted">${v.fromUid||'-'} → ${v.toUid||'-'}</div>
        <div class="muted">${fmtDate(v.createdAt)}</div>
        <div class="muted">${v.status||'—'}</div>
      </div>`);
      list.appendChild(el);
    });
    if(!list.children.length) list.innerHTML='<div class="muted">Şikayet bulunamadı.</div>';
  }catch(err){
    list.innerHTML='';
    nt.textContent = 'Not: Şikayetler için collectionGroup indexi gerekebilir veya veri yok. Hata: '+(err?.message||err);
  }
}

// --- render: Ayarlar
function renderAyarlar(){
  const pwOld = document.getElementById('pw-old');
  const pwNew = document.getElementById('pw-new');
  const btn = document.getElementById('pw-change');
  const info = document.getElementById('pw-note');
  const acc = document.getElementById('acc-info');

  const u = auth.currentUser;
  acc.innerHTML = `
    <div><b>E-posta:</b> ${u?.email||'-'}</div>
    <div><b>UID:</b> <code>${u?.uid||'-'}</code></div>
  `;

  btn.onclick = async ()=>{
    info.textContent=''; if(!IS_ADMIN){ info.textContent='Admin yetkisi gerekli.'; return; }
    if(!pwOld.value || !pwNew.value){ info.textContent='Alanlar zorunlu.'; return; }
    try{
      const cred = EmailAuthProvider.credential(u.email, pwOld.value);
      await reauthenticateWithCredential(u, cred);
      await updatePassword(u, pwNew.value);
      info.textContent='✅ Şifre güncellendi.';
      pwOld.value=''; pwNew.value='';
    }catch(err){ info.textContent = 'Hata: '+(err?.message||err); }
  };
}

// --- auth & boot
onAuthStateChanged(auth, async (u)=>{
  if(!u){
    // Email/Şifre ile giriş talep et (admin hesabı)
    who.textContent = 'Giriş gerekiyor (e-posta/şifre).';
    // doğrudan formlandırma yerine basit prompt
    const email = prompt('Admin e-posta:','ozkank603@gmail.com');
    const pass = prompt('Şifre:','');
    if(email && pass){
      try{ await signInWithEmailAndPassword(auth, email, pass); return; }catch(e){ alert('Giriş hatası: '+(e?.message||e)); }
    }
    return;
  }
  IS_ADMIN = await isAdminUser(u.uid);
  who.innerHTML = `${u.email||u.displayName} • ${IS_ADMIN ? '<span class="ok">admin</span>' : '<span class="err">admin değil</span>'} • <code>${u.uid}</code>`;
  show('onay');
});
