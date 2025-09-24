import { getFirestore, collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
const db = window.__fb?.db || getFirestore();
const auth = window.__fb?.auth || getAuth();

function tpl(){
  return {
    title: "Mesajlar (Kullanıcı DM)",
    html: `
      <div class="cols">
        <div>
          <div class="list" id="chatList"></div>
        </div>
        <div>
          <div class="msgs" id="chatMsgs"><div class="muted">Soldan sohbet seçin.</div></div>
          <div class="send">
            <input id="chatInput" placeholder="Yanıt yaz…" autocomplete="off"/>
            <button class="btn primary" id="chatSend">Gönder</button>
          </div>
        </div>
      </div>`,
    mount: setup
  }
}

let activeChat = null, unsubChats=null, unsubMsgs=null;

function setup(){
  const list = document.getElementById('chatList');
  list.innerHTML = `<div class="item"><div class="muted">Yükleniyor…</div></div>`;

  // tüm chat’leri zamana göre listele
  const cRef = collection(db, "chats");
  if(unsubChats) unsubChats();
  unsubChats = onSnapshot(query(cRef, orderBy("lastMsgAt","desc")), (snap)=>{
    list.innerHTML = "";
    if(snap.empty){ list.innerHTML = `<div class="item"><div class="muted">Sohbet yok.</div></div>`; return; }
    snap.forEach(d=>{
      const v = d.data();
      const row = document.createElement('div');
      row.className = "item";
      row.dataset.id = d.id;
      row.innerHTML = `<div><strong>${d.id}</strong><div class="muted">${(v.lastMsg||'').slice(0,60)}</div></div>
                       <div class="muted">${v.lastMsgAt?.toDate? v.lastMsgAt.toDate().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}):''}</div>`;
      row.onclick = ()=> openChat(d.id);
      list.appendChild(row);
    });
  });

  document.getElementById("chatSend").onclick = send;
}

function openChat(chatId){
  activeChat = chatId;
  document.querySelectorAll('#chatList .item').forEach(x=> x.classList.toggle('active', x.dataset.id===chatId));
  const box = document.getElementById('chatMsgs');
  box.innerHTML = `<div class="muted">Yükleniyor…</div>`;
  if(unsubMsgs) unsubMsgs();

  const mRef = collection(db, "chats", chatId, "messages");
  unsubMsgs = onSnapshot(query(mRef, orderBy("createdAt","asc")), (snap)=>{
    box.innerHTML="";
    snap.forEach(d=>{
      const m = d.data();
      const me = m.senderUid === auth.currentUser?.uid;
      const el = document.createElement('div');
      el.className = "bubble"+(me?" me":"");
      el.innerHTML = `<div>${(m.text||"").replace(/[<>&]/g, s=>({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[s]))}</div>
                      <div class="muted" style="margin-top:4px;font-size:11px">${m.createdAt?.toDate? m.createdAt.toDate().toLocaleString('tr-TR'):""}</div>`;
      box.appendChild(el);
    });
    box.scrollTop = box.scrollHeight;
  });
}

async function send(){
  const input = document.getElementById('chatInput');
  if(!activeChat) return;
  const text = (input.value||"").trim(); if(!text) return;
  const me = auth.currentUser;
  await setDoc(doc(collection(db, "chats", activeChat, "messages")), {
    text, senderUid: me.uid, createdAt: serverTimestamp()
  });
  await setDoc(doc(db, "chats", activeChat), { lastMsg: text, lastMsgAt: serverTimestamp() }, { merge:true });
  input.value = "";
}

window.AdminMessages = tpl;
