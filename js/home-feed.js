import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, query, where, onSnapshot,
  addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

var cfg = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.firebasestorage.app",
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

var app  = getApps().length ? getApps()[0] : initializeApp(cfg);
var db   = getFirestore(app);
var auth = getAuth(app);

var feed  = document.getElementById("feed");
var empty = document.getElementById("feed-empty");

function card(d, id){
  var img = d.coverUrl || ("https://picsum.photos/seed/" + id + "/800/600");
  var title = d.title || "İlan";
  var sub = (d.category || "") + (d.city ? " • " + d.city : "");
  return ''
    + '<div class="card" data-card-id="'+id+'">'
    +   '<img class="thumb" src="'+img+'" alt="'+title+'">'
    +   '<div class="meta">'
    +     '<div class="title">'+title+'</div>'
    +     '<div class="sub">'+sub+'</div>'
    +     '<div class="actions">'
    +       '<a class="btn offer" href="#" data-offer-id="'+id+'" data-seller="'+(d.ownerId||'')+'" data-title="'+title+'">Teklif ver</a>'
    +     '</div>'
    +   '</div>'
    + '</div>';
}

// Aktif ilanlar akışı (mobil 1, masaüstü 4 sütun CSS ile)
var q = query(collection(db, "listings"), where("status","==","active"));
onSnapshot(q, function(ss){
  var arr = [];
  ss.forEach(function(doc){ arr.push(Object.assign({ id: doc.id }, doc.data())); });
  arr = arr.filter(function(x){
  var ms = x.expiresAt && (x.expiresAt.toMillis ? x.expiresAt.toMillis() : (x.expiresAt.seconds*1000));
  return !ms || ms > Date.now();
});
arr.sort(function(a,b){
  function ts(o){
    var u=o.updatedAt, c=o.createdAt;
    var su = u ? (u.toMillis ? Math.floor(u.toMillis()/1000) : (u.seconds||0)) : 0;
    var sc = c ? (c.toMillis ? Math.floor(c.toMillis()/1000) : (c.seconds||0)) : 0;
    return su || sc;
  }
  return ts(b) - ts(a);
});

  if(!feed || !empty) return;

  if(arr.length === 0){
    empty.style.display = "block";
    feed.innerHTML = "";
  } else {
    empty.style.display = "none";
    feed.innerHTML = arr.map(function(x){ return card(x, x.id); }).join("");
  }
});

// "Teklif ver" (giriş kontrolü + offers alt koleksiyonuna kayıt)
feed && feed.addEventListener("click", async function(e){
  var t = e.target && e.target.closest && e.target.closest(".offer");
  if(!t) return;
  e.preventDefault();

  var listingId = t.getAttribute("data-offer-id");
  var sellerId  = t.getAttribute("data-seller") || "";
  var title     = t.getAttribute("data-title") || "İlan";

  var u = auth.currentUser;
  if(!u){ location.href = "auth.html?next=home.html"; return; }
  if(u.uid === sellerId){ alert("Kendi ilanınıza teklif veremezsiniz."); return; }

  var text = window.prompt('"' + title + '" için mesajınız (opsiyonel):', "");
  try{
    await addDoc(collection(db, 'listings/' + listingId + '/offers'), {
      listingId: listingId,
      listingTitle: title,
      sellerId: sellerId,
      buyerId: u.uid,
      text: (text || "").slice(0, 1000),
      createdAt: serverTimestamp()
    });
    alert("Teklif gönderildi!");
  }catch(err){
    alert("Teklif gönderilemedi: " + (err && err.message ? err.message : String(err)));
  }
});
