// Basit global hata yakalayıcı (görünür kıl)
window.addEventListener("error", (e)=>{
  const box = document.getElementById("debugBox");
  if(box){
    const pre = document.createElement("pre");
    pre.textContent = String(e.error?.stack || e.message || e);
    box.appendChild(pre);
  }else{
    console.error("AdminError:", e.error || e.message || e);
  }
});
window.addEventListener("unhandledrejection", (e)=>{
  const box = document.getElementById("debugBox");
  if(box){
    const pre = document.createElement("pre");
    pre.textContent = "PromiseRejection: " + String(e.reason?.stack || e.reason || "");
    box.appendChild(pre);
  }else{
    console.error("AdminRejection:", e.reason);
  }
});
