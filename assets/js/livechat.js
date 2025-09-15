import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp,
  collection, addDoc, query, orderBy, onSnapshot, where, getDocs, deleteDoc, limit
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { auth, db } from "/js/firebase-init.js";

const chatBtn   = document.getElementById('openChat');
const chatWin   = document.getElementById('chatWin');
const chatClose = document.getElementById('chatClose');
const chatSend  = document.getElementById('chatSend');
const chatInput = document.getElementById('chatInput');
const chatBody  = document.getElementById('chatBody');

const DING_URL = "/assets/sounds/notify.wav";
let ding; try { ding = new Audio(DING_URL); } catch(e) { ding = null; }
function playDing(){ if(!ding) return; ding.currentTime=0; ding.play().catch(()=>{}); }

function el(tag, cls, txt){ const n=document.createElement(tag); if(cls) n.className=cls; if(txt) n.textContent=txt; return n; }
function pushBubble(text, who="sys"){
  const d = el('div', `msg ${who}`, text);
  d.style.cssText = "margin:6px 0;padding:8px 10px;border:1px solid var(--ring,#e5e7eb);border-radius:10px;background:#f8f9fb";
  if (who==="me") d.style.background="#eef6ff";
  if (who==="adm") d.style.background="#f7f7ff";
  chatBody.appendChild(d); chatBody.scrollTop=chatBody.scrollHeight; playDing();
}

async function getOrCreateThread(uid){
  const tRef = doc(db,"chats",uid);
  const s = await getDoc(tRef);
  if(!s.exists()){
    await setDoc(tRef,{ ownerId:uid, createdAt:serverTimestamp(), lastMessageAt:serverTimestamp(), lastMessageBy:"system" });
  }
  return tRef;
}
async function addMsg(tRef, sender, text){
  const mRef = await addDoc(collection(tRef,"messages"),{ sender, text, createdAt:serverTimestamp() });
  await setDoc(tRef,{ lastMessageAt:serverTimestamp(), lastMessageBy:sender },{ merge:true });
  return mRef;
}
async function wipeThreadAndMessages(uid){
  const tRef = doc(db,"chats",uid);
  const mCol = collection(tRef,"messages");
  while(true){
    const snap = await getDocs(query(mCol, orderBy("createdAt"), limit(100)));
    if(snap.empty) break;
    await Promise.all(snap.docs.map(d=>deleteDoc(d.ref)));
  }
  await deleteDoc(tRef).catch(()=>{});
}

let greetedOnce=false, userMsgCount=0, currentUser=null, unsubAdmin=null;
onAuthStateChanged(auth,(u)=>{ currentUser=u||null; });

function listenAdmin(tRef){
  if (unsubAdmin) { try{unsubAdmin();}catch(e){}; unsubAdmin=null; }
  unsubAdmin = onSnapshot(
    query(collection(tRef,"messages"), where("sender","==","admin"), orderBy("createdAt")),
    (snap)=> snap.docChanges().forEach(ch=>{ if(ch.type==="added"){ const {text}=ch.doc.data(); pushBubble(text||"—","adm"); } })
  );
}

function showChat(){
  if(!chatWin) return;
  chatWin.style.display="flex";
  if(!greetedOnce){
    greetedOnce=true;
    pushBubble("Merhaba! Canlı Destek’e hoş geldiniz. Konuyu açıklayıcı yazarsanız size yardımcı olmaya çalışacağım. 🙌","sys");
  }
}

async function handleSend(){
  const v=(chatInput?.value||"").trim();
  if(!v) return;
  if(!currentUser){ window.location.href="auth.html?next=home.html"; return; }

  pushBubble(v,"me"); chatInput.value="";
  const tRef=await getOrCreateThread(currentUser.uid);
  await addMsg(tRef,"user",v);

  userMsgCount += 1;
  if(userMsgCount===1){
    pushBubble("Teşekkürler, mesajınızı aldım. Konuyu birkaç cümleyle detaylandırırsanız daha hızlı yardımcı olabilirim. ✍️","sys");
    await addMsg(tRef,"system","Otomatik: Daha hızlı yardımcı olabilmemiz için konuyu birkaç cümleyle detaylandırınız.");
  } else if(userMsgCount===2){
    pushBubble("Müşteri temsilcimize aktarılıyorsunuz. En kısa sürede dönüş yapılacak. Lütfen mesaj balonunu kapatmayın. ⏳","sys");
    await addMsg(tRef,"system","Otomatik: Müşteri temsilcisine aktarıldınız. Lütfen bekleyiniz.");
  }

  listenAdmin(tRef);
}

async function handleClose(){
  if(chatWin) chatWin.style.display="none";
  if(chatBody) chatBody.innerHTML="";
  greetedOnce=false; userMsgCount=0;
  if(currentUser){ try{ await wipeThreadAndMessages(currentUser.uid); }catch(e){} }
}

chatBtn?.addEventListener("click", ()=>{ playDing(); showChat(); });
chatClose?.addEventListener("click", handleClose);
chatSend?.addEventListener("click", handleSend);
chatInput?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") handleSend(); });
