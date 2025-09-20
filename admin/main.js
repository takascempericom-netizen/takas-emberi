// takas-emberi/admin/main.js
// Sekme geçişleri ve ilgili modülleri bağlar

const tabs = document.querySelectorAll("#adminNav .tab");
const sections = {
  pending: document.getElementById("view-pending"),
  support: document.getElementById("view-support"),
  users: document.getElementById("view-users"),
  broadcast: document.getElementById("view-broadcast"),
};

tabs.forEach(tab=>{
  tab.addEventListener("click", ()=>{
    tabs.forEach(t=>t.classList.remove("active"));
    tab.classList.add("active");
    Object.values(sections).forEach(s=>s.classList.remove("active"));
    sections[tab.dataset.tab]?.classList.add("active");
  });
});

// Pending modülü
import("./pending.js");
// Support modülü
import("./support.js").catch(()=>{});
// Users modülü
import("./users.js").catch(()=>{});
// Broadcast modülü
import("./broadcast.js").catch(()=>{});
