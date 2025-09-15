document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("openChat");
  if (!b) { console.warn("[chat-ping] openChat butonu yok"); return; }
  console.log("[chat-ping] buton bulundu");
  b.addEventListener("click", () => { console.log("[chat-ping] tıklandı"); try{ alert("CHAT PING ✅"); }catch{} });
});
