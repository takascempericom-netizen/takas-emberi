console.log("profile.js loaded");

// Tema değiştirici
for(const el of document.querySelectorAll(".swatch")){
  el.addEventListener("click", ()=>{ document.body.className = "theme-" + el.dataset.theme; });
}

// Yıldız UI (başlangıçta boş; backend puanı geldiğinde güncelle)
function renderStars(container, value=0){
  container.innerHTML = "";
  for(let i=1;i<=5;i++){
    const s = document.createElement("svg");
    s.setAttribute("viewBox","0 0 24 24");
    s.className = "star";
    s.style.color = (i<=Math.round(value)) ? "gold" : "#4b5375";
    s.innerHTML = "<path fill=\\"currentColor\\" d=\\"M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z\\"/>";
    container.appendChild(s);
  }
}
renderStars(document.getElementById("rating"), 0);

// Sekmeler
const tabs = document.getElementById("tabs");
const panes = {
  live: document.getElementById("tab-live"),
  pending: document.getElementById("tab-pending"),
  expired: document.getElementById("tab-expired"),
};
tabs.addEventListener("click",(e)=>{
  const t = e.target.closest(".tab"); if(!t) return;
  [...tabs.children].forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  Object.values(panes).forEach(p=>p.style.display="none");
  document.getElementById("tab-" + t.dataset.tab).style.display="grid";
});

// Form güncelle (şimdilik yalnızca isim alanını üstte göster)
document.getElementById("btnSave")?.addEventListener("click", ()=>{
  const full = (document.getElementById("firstName").value + " " + document.getElementById("lastName").value).trim();
  document.getElementById("nameUnder").textContent = full || "—";
});
