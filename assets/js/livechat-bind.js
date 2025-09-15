(() => {
  function bind() {
    const chatBtn   = document.getElementById("openChat");
    const chatWin   = document.getElementById("chatWin");
    const chatClose = document.getElementById("chatClose");
    const chatSend  = document.getElementById("chatSend");
    const chatInput = document.getElementById("chatInput");
    const chatBody  = document.getElementById("chatBody");
    if (!chatBtn || !chatWin || !chatClose || !chatSend || !chatInput || !chatBody) return false;

    const showChat = () => { chatWin.style.display = "flex"; };
    const handleSend = () => {
      const e = new Event("click", { bubbles:true });
      // Mevcut livechat.js zaten bu ID’lere listener koyduysa tetiklenecek
      chatSend.dispatchEvent(e);
    };
    const handleClose = () => { chatClose.click(); };

    // Ses için ilk etkileşimde dene (hata yutulur)
    chatBtn.addEventListener("click", () => {
      try { new Audio("/assets/sounds/notify.wav").play().catch(()=>{}); } catch {}
      showChat();
    });
    chatSend.addEventListener("click", handleSend);
    chatInput.addEventListener("keydown", (ev) => { if (ev.key === "Enter") handleSend(); });
    chatClose.addEventListener("click", handleClose);

    console.log("[chat-bind] OK");
    return true;
  }

  // DOMContentLoaded + tekrar dene (gecikmeli render için)
  document.addEventListener("DOMContentLoaded", () => {
    if (bind()) return;
    const t = setInterval(() => { if (bind()) clearInterval(t); }, 300);
    setTimeout(() => clearInterval(t), 6000);
  });
})();
