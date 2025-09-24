import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const db = window.__fb?.db || getFirestore();

function tpl(){
  return {
    title: "Ayarlar",
    html: `
      <div class="grid" style="max-width:520px">
        <label>Canlı Destek Durumu</label>
        <select id="supState">
          <option value="online">Online</option>
          <option value="busy">Meşgul</option>
          <option value="offline">Offline</option>
        </select>
        <button class="btn primary" id="save">Kaydet</button>
        <div id="msg" class="muted"></div>
      </div>`,
    mount: setup
  }
}

async function setup(){
  const ref = doc(db,"settings","support");
  const s = await getDoc(ref);
  if(s.exists()) document.getElementById('supState').value = s.data().state || "online";
  document.getElementById('save').onclick = async ()=>{
    await setDoc(ref, { state: document.getElementById('supState').value }, { merge:true });
    document.getElementById('msg').textContent = "Kaydedildi.";
  };
}

window.AdminSettings = tpl;
