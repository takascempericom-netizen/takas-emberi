// /admin/users.js — Kullanıcı Listesi (arama, rol filtresi, sayfalama, rol/ban güncelleme)

import {
  collection, query, where, orderBy, limit, startAfter, getDocs,
  updateDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/** Basit yardımcılar */
const esc = (s)=> String(s ?? "").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m]));
const fmtDate = (ts)=>{
  try{
    if(!ts) return "-";
    // Firestore Timestamp veya ISO/string desteği
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if(isNaN(d)) return "-";
    const pad = n=> String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }catch{ return "-"; }
};

/** Ana giriş noktası — index.html mountModule('users') burayı çağırır */
export async function mountUsers({ auth, db, el }){
  if(!el){ return; }

  // State
  let lastDoc = null;
  let currentQuery = { text:"", role:"all", pageSize: 20 };
  let loading = false;

  // UI
  el.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
      <input id="u-q" type="search" placeholder="Ad/E-posta ara…" style="flex:1;min-width:220px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px" />
      <select id="u-role" style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px">
        <option value="all">Tüm roller</option>
        <option value="admin">admin</option>
        <option value="moderator">moderator</option>
        <option value="support">support</option>
        <option value="user">user</option>
        <option value="banned">sadece banlı</option>
      </select>
      <select id="u-size" title="Sayfa boyutu" style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px">
        <option value="10">10</option>
        <option value="20" selected>20</option>
        <option value="50">50</option>
      </select>
      <button id="u-refresh" class="btn-ghost" type="button">Yenile</button>
      <button id="u-next" class="btn-ghost" type="button">Sonraki &rsaquo;</button>
    </div>

    <div class="card" style="border:none">
      <div class="body" style="padding:0">
        <div style="overflow:auto">
          <table id="u-table" style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f8fafc;border-bottom:1px solid #e5e7eb">
                <th style="text-align:left;padding:10px 12px;white-space:nowrap">Kullanıcı</th>
                <th style="text-align:left;padding:10px 12px">E-posta</th>
                <th style="text-align:left;padding:10px 12px;white-space:nowrap">Rol</th>
                <th style="text-align:left;padding:10px 12px;white-space:nowrap">Durum</th>
                <th style="text-align:left;padding:10px 12px;white-space:nowrap">Üyelik</th>
                <th style="text-align:left;padding:10px 12px;white-space:nowrap">Son Giriş</th>
                <th style="text-align:left;padding:10px 12px">İşlem</th>
              </tr>
            </thead>
            <tbody id="u-tbody">
              <tr><td colspan="7" style="padding:16px;color:#64748b">Liste yükleniyor…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const $ = (s)=> el.querySelector(s);
  const qInput   = $("#u-q");
  const roleSel  = $("#u-role");
  const sizeSel  = $("#u-size");
  const btnRef   = $("#u-refresh");
  const btnNext  = $("#u-next");
  const tbody    = $("#u-tbody");

  // Etkileşimler
  qInput.addEventListener("input", debounce(()=> reload(true), 450));
  roleSel.addEventListener("change", ()=> reload(true));
  sizeSel.addEventListener("change", ()=> { currentQuery.pageSize = Number(sizeSel.value)||20; reload(true); });
  btnRef.addEventListener("click", ()=> reload(true));
  btnNext.addEventListener("click", ()=> reload(false));

  // İlk yükleme
  await reload(true);

  /** ----------------- İç Fonksiyonlar ----------------- */

  function debounce(fn, ms){
    let t=null; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
  }

  async function reload(reset){
    if(loading) return;
    loading = true;
    try{
      if(reset){
        lastDoc = null;
        tbody.innerHTML = `<tr><td colspan="7" style="padding:16px;color:#64748b">Yükleniyor…</td></tr>`;
      }
      currentQuery.text = qInput.value.trim().toLowerCase();
      currentQuery.role = roleSel.value;

      // Sorgu kur
      const col = collection(db, "users");
      let q = null;

      // Not: Tam metin arama yok; basit istemci tarafı filtre ile çözüyoruz.
      // Sunucu tarafı filtre: role / banned
      const whereParts = [];
      if(currentQuery.role === "banned"){
        whereParts.push(where("banned","==",true));
      }else if(currentQuery.role !== "all"){
        whereParts.push(where("role","==",currentQuery.role));
      }

      // Varsayılan sıralama: createdAt desc, yoksa fallback: displayName
      // createdAt yoksa orderBy hatası olmasın diye try/catch ile iki deneme yapacağız
      const pageLim = limit(currentQuery.pageSize || 20);

      // İlk deneme: createdAt ile
      try{
        q = query(col, ...whereParts, orderBy("createdAt", "desc"), pageLim);
        if(lastDoc) q = query(col, ...whereParts, orderBy("createdAt","desc"), startAfter(lastDoc), pageLim);
      }catch{
        // Fallback: displayName
        q = query(col, ...whereParts, orderBy("displayName"), pageLim);
        if(lastDoc) q = query(col, ...whereParts, orderBy("displayName"), startAfter(lastDoc), pageLim);
      }

      const snap = await getDocs(q);
      const rows = [];
      let cnt = 0;
      snap.forEach(d=>{
        cnt++;
        const x = d.data() || {};
        const uid   = d.id;
        const name  = x.displayName || x.name || "(adsız)";
        const email = x.email || "-";
        const photo = x.photoURL || x.avatar || "";
        const role  = (x.role || "user").toString();
        const banned= !!x.banned;
        const createdAt = x.createdAt || x.created_at || x._created || null;
        const lastLogin = x.lastLoginAt || x.lastLogin || x._lastLogin || x.lastSignInTime || null;

        // Basit istemci araması (ad veya e-posta)
        const needle = currentQuery.text;
        const hay = `${name} ${email}`.toLowerCase();
        if(needle && !hay.includes(needle)) return; // eşleşmiyorsa pas

        rows.push(`
          <tr style="border-top:1px solid #e5e7eb">
            <td style="padding:10px 12px;display:flex;gap:10px;align-items:center;min-width:220px">
              <img src="${esc(photo||"/assets/img/seffaf.png")}" alt="" style="width:32px;height:32px;border-radius:999px;border:1px solid #e5e7eb;object-fit:cover;background:#fff">
              <div>
                <div style="font-weight:600">${esc(name)}</div>
                <div style="font-size:12px;color:#64748b">UID: ${esc(uid)}</div>
              </div>
            </td>
            <td style="padding:10px 12px">${esc(email)}</td>
            <td style="padding:10px 12px">
              <span class="role-pill" style="display:inline-block;padding:3px 8px;border:1px solid #cbd5e1;border-radius:999px;background:#f8fafc">${esc(role)}</span>
            </td>
            <td style="padding:10px 12px">
              ${banned ? `<span style="color:#b91c1c;font-weight:600">BANLI</span>` : `<span style="color:#16a34a">Aktif</span>`}
            </td>
            <td style="padding:10px 12px">${esc(fmtDate(createdAt))}</td>
            <td style="padding:10px 12px">${esc(fmtDate(lastLogin))}</td>
            <td style="padding:10px 12px;white-space:nowrap">
              <a href="/profile.html?uid=${encodeURIComponent(uid)}" target="_blank" style="margin-right:8px;text-decoration:none;border:1px solid #e5e7eb;border-radius:10px;padding:6px 8px">Profili Gör</a>
              <button data-act="role" data-uid="${esc(uid)}" data-role="${esc(role)}" style="margin-right:6px;border:1px solid #e5e7eb;border-radius:10px;padding:6px 8px;background:#fff;cursor:pointer">Rol Değiştir</button>
              <button data-act="ban" data-uid="${esc(uid)}" data-banned="${banned ? "1":"0"}" style="border:1px solid ${banned?"#ef4444":"#e5e7eb"};border-radius:10px;padding:6px 8px;background:${banned?"#fee2e2":"#fff"};cursor:pointer">${banned?"Banı Kaldır":"Banla"}</button>
            </td>
          </tr>
        `);
      });

      // Sayfalama için lastDoc
      lastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;

      if(rows.length===0){
        tbody.innerHTML = `<tr><td colspan="7" style="padding:16px;color:#64748b">Kayıt bulunamadı.</td></tr>`;
      }else{
        tbody.innerHTML = rows.join("");
      }

      // İşlem butonları (delegation)
      tbody.addEventListener("click", onActionClick);
    } catch(e){
      console.error("Kullanıcı listesi hata:", e);
      tbody.innerHTML = `<tr><td colspan="7" style="padding:16px;color:#b91c1c">Hata: ${esc(e?.message||e)}</td></tr>`;
    } finally{
      loading = false;
    }
  }

  async function onActionClick(ev){
    const btn = ev.target.closest("button[data-act]");
    if(!btn) return;
    const uid = btn.getAttribute("data-uid");
    const act = btn.getAttribute("data-act");

    // Kendi hesabına tehlikeli işlem koruması
    const me = auth?.currentUser?.uid;
    if(uid && me && uid===me && (act==="ban" || act==="role")){
      const ok = confirm("Kendi hesabınız üzerinde işlem yapıyorsunuz. Devam edilsin mi?");
      if(!ok) return;
    }

    if(act==="role"){
      const current = btn.getAttribute("data-role") || "user";
      const next = prompt("Yeni rolü girin (admin / moderator / support / user):", current);
      if(!next) return;
      const role = (next||"").toString().trim().toLowerCase();
      if(!["admin","moderator","support","user"].includes(role)){
        alert("Geçersiz rol.");
        return;
      }
      try{
        btn.disabled = true;
        await updateDoc(doc(db,"users", uid), { role, roleUpdatedAt: serverTimestamp() });
        btn.setAttribute("data-role", role);
        // Görsel etiketi de güncelle
        const pill = btn.closest("tr")?.querySelector(".role-pill");
        if(pill) pill.textContent = role;
        alert("Rol güncellendi.");
      }catch(e){
        console.error(e); alert("Rol güncellenemedi: " + (e?.message||e));
      }finally{ btn.disabled = false; }
    }

    if(act==="ban"){
      const banned = btn.getAttribute("data-banned")==="1";
      const conf = confirm(banned ? "Ban kaldırılsın mı?" : "Kullanıcı banlansın mı?");
      if(!conf) return;
      try{
        btn.disabled = true;
        await updateDoc(doc(db,"users", uid), banned ? { banned:false, unbannedAt: serverTimestamp() } : { banned:true, bannedAt: serverTimestamp() });
        // UI güncelle
        const cell = btn.closest("tr")?.children?.[3];
        if(cell) cell.innerHTML = banned
          ? `<span style="color:#16a34a">Aktif</span>`
          : `<span style="color:#b91c1c;font-weight:600">BANLI</span>`;
        btn.textContent = banned ? "Banla" : "Banı Kaldır";
        btn.setAttribute("data-banned", banned ? "0" : "1");
        btn.style.background = banned ? "#fff" : "#fee2e2";
        btn.style.borderColor = banned ? "#e5e7eb" : "#ef4444";
      }catch(e){
        console.error(e); alert("İşlem başarısız: " + (e?.message||e));
      }finally{ btn.disabled = false; }
    }
  }
}

// Geriye dönük uyumluluk: index.html olası fallback için
export function mount(ctx){ return mountUsers(ctx); }
