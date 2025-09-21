/* profile/profile.js (UI-only, temiz JS) */
// Avatar fallback (inline onerror kaldırıldı)
var __av=document.getElementById("avatar"); if(__av){ __av.addEventListener("error", function(){ __av.src="https://placehold.co/200x200?text=Avatar"; }, {once:true}); }
console.log("profile.js loaded");

/* Tema değiştirici */
document.querySelectorAll(".swatch").forEach(function(el){
  el.addEventListener("click", function(){
    document.body.className = "theme-" + el.dataset.theme;
  });
});

/* Yıldız UI (varsayılan 0 puan) */
function renderStars(container, value){
  if (!container) return;
  var v = Math.round(Number(value || 0));
  container.innerHTML = "";
  for (var i = 1; i <= 5; i++){
    var s = document.createElement("svg");
    s.setAttribute("viewBox","0 0 24 24");
    s.className = "star";
    s.style.color = (i <= v) ? "gold" : "#4b5375";
    s.innerHTML = "<path fill=\"currentColor\" d=\"M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z\"/>";
    container.appendChild(s);
  }
}
renderStars(document.getElementById("rating"), 0);

/* Sekmeler */
var tabs = document.getElementById("tabs");
var panes = {
  live:    document.getElementById("tab-live"),
  pending: document.getElementById("tab-pending"),
  expired: document.getElementById("tab-expired")
};
if (tabs){
  tabs.addEventListener("click", function(e){
    var t = e.target.closest(".tab"); if(!t) return;
    Array.prototype.forEach.call(tabs.children, function(x){ x.classList.remove("active"); });
    t.classList.add("active");
    Object.keys(panes).forEach(function(k){ if(panes[k]) panes[k].style.display = "none"; });
    var pane = document.getElementById("tab-" + t.dataset.tab);
    if (pane) pane.style.display = "grid";
  });
}

/* Form güncelle (şimdilik isim üstte görünsün) */
var btnSave = document.getElementById("btnSave");
if (btnSave){
  btnSave.addEventListener("click", function(){
    var full = (document.getElementById("firstName").value + " " + document.getElementById("lastName").value).trim();
    var nameUnder = document.getElementById("nameUnder");
    if (nameUnder) nameUnder.textContent = full || "—";
    alert("Profil güncellendi (yerel)"); // Backend bağlanınca kaldır
  });
}
