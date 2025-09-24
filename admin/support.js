import { getFirestore, collection, doc, setDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
const db = window.__fb?.db || getFirestore();
const auth = window.__fb?.auth || getAuth();

function tpl(){
  return {
    title: "Canlı Destek",
    html: `
      <div class="cols">
        <div>
          <div class="list" id="supList"></div>
        </div>
        <div>
          <div class="msgs" id="supMsgs"><div class="muted">Soldan bir kullanıcı seçin.</div></div>
          <div class="send">
            <input id="supInput" placeholder="Yanıt yaz…" autocomplete="off"/>
            <button class="btn primary" id="supSend">Gönder</button>
          </div>
        </div>
      </div>
    `,
    mount: setup
  };
}

let unsubList = null, unsubMsgs = null, activeUid = null;

async function setup(){
  // sol liste: son mesaj zamanına göre kullanıcı thread’leri
  const listEl = document.getElementById("supList");
  listEl.innerHTML = `<div class="item"><div class="muted">Yükleniyor…</div></div>`;

  if(unsubList) unsubList();
  const tRef = collection(db, "supportThreads");
  // her thread dokümanının içinde sonMesajAt tutulmuyorsa, messages alt koleksiyona bakacağız
  const qs = await getDocs(tRef);
  // id listesi
  const uids = qs.docs.map(d=>d.id);

  // Basit: en son 1 mesajı çekip sırala
  const rows = [];
  for(const uid of uids){
    const mRef = collection(db, "supportThreads", uid, "messages");
    const s = await getDocs(query(mRef, orderBy("createdAt","desc"), limit(1)));
    const last = s.docs[0]?.data();
    rows.push({uid, lastAt: last?.createdAt?.toMillis?.() || 0, lastTxt: last?.text || ""});
  }
  rows.sort((a,b)=> b.lastAt - a.lastAt);

  listEl.innerHTML = "";
  if(rows.length===0){ listEl.innerHTML = `<div class="item"><div class="muted">Henüz destek mesajı yok.</div></div>`; }

  rows.forEach(r=>{
    const div = document.createElement("div");
    div.className = "item";
    div.dataset.uid = r.uid;
    div.innerHTML = `<div><strong>${r.uid}</strong><div class="muted">${r.lastTxt.slice(0,60)}</div></div><div class="muted">${r.lastAt? new Date(r.lastAt).toLocaleString('tr-TR'):""}</div>`;
    div.onclick = ()=> openThread(r.uid);
    listEl.appendChild(div);
  });

  document.getElementById("supSend").onclick = sendReply;
}

function openThread(uid){
  activeUid = uid;
  document.querySelectorAll("#supList .item").forEach(x=> x.classList.toggle("active", x.dataset.uid===uid));
  const box = document.getElementById("supMsgs");
  box.innerHTML = `<div class="muted">Yükleniyor…</div>`;
  if(unsubMsgs) unsubMsgs();

  const mRef = collection(db, "supportThreads", uid, "messages");
  unsubMsgs = onSnapshot(query(mRef, orderBy("createdAt","asc")), (snap)=>{
    box.innerHTML = "";
    snap.forEach(d=>{
      const m = d.data();
      const me = m.senderUid === auth.currentUser?.uid;
      const el = document.createElement("div");
      el.className = "bubble" + (me? " me":"");
      el.innerHTML = `<div>${(m.text||"").replace(/[<>&]/g, s=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[s]))}</div>
                      <div class="muted" style="margin-top:4px;font-size:11px">${m.createdAt?.toDate? m.createdAt.toDate().toLocaleString('tr-TR'): ""}</div>`;
      box.appendChild(el);
    });
    box.scrollTop = box.scrollHeight;
  });
}

async function sendReply(){
  const input = document.getElementById("supInput");
  const text = (input.value||"").trim();
  if(!text || !activeUid) return;

  const me = auth.currentUser;
  const ref = doc(collection(db, "supportThreads", activeUid, "messages"));
  await setDoc(ref, {
    text,
    senderUid: me.uid,
    createdAt: serverTimestamp()
  });
  input.value = "";
}

window.AdminSupport = tpl;
