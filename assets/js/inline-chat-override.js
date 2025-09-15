(function(){
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){
    var btn = document.getElementById('openChat');
    var win = document.getElementById('chatWin');
    var closeBtn = document.getElementById('chatClose');
    var sendBtn = document.getElementById('chatSend');
    var input = document.getElementById('chatInput');
    var body = document.getElementById('chatBody');

    if(!btn || !win || !closeBtn || !sendBtn || !input || !body){
      console.warn('[chat-override] Gerekli elemanlar bulunamadı');
      return;
    }

    var greeted = false;
    var userCount = 0;
    var snd; try{ snd = new Audio('/assets/sounds/notify.wav'); }catch(e){ snd = null; }
    function ding(){ try{ if(snd){ snd.currentTime=0; snd.play().catch(function(){});} }catch(e){} }

    function bubble(text, who){
      var div = document.createElement('div');
      div.className = 'msg' + (who==='me' ? ' me' : '');
      div.textContent = text;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
      ding();
    }

    function openChat(){
      win.style.display = 'flex';
      if(!greeted){
        greeted = true;
        bubble('Merhaba! Canlı Destek’e hoş geldiniz. Konuyu açıklayıcı yazarsanız size yardımcı olmaya çalışacağım. 🙌', 'sys');
      }
    }

    function handleSend(){
      var v = (input.value || '').trim();
      if(!v) return;
      bubble(v, 'me');
      input.value = '';
      userCount += 1;

      if(userCount === 1){
        bubble('Teşekkürler, mesajınızı aldım. Konuyu birkaç cümleyle detaylandırırsanız daha hızlı yardımcı olabilirim. ✍️', 'sys');
      } else if(userCount === 2){
        bubble('Müşteri temsilcimize aktarılıyorsunuz. En kısa sürede dönüş yapılacak. Lütfen mesaj balonunu kapatmayın. ⏳', 'sys');
      }
    }

    function resetChatUI(){
      // pencereyi kapat, içerikleri sıfırla
      win.style.display = 'none';
      body.innerHTML = '<div class="msg">Merhaba, Takas Çemberi canlı desteğe hoş geldiniz 👋</div>';
      greeted = false;
      userCount = 0;
    }

    btn.onclick = function(){ ding(); openChat(); };
    closeBtn.onclick = function(){ resetChatUI(); };
    sendBtn.onclick = function(){ handleSend(); };
    input.addEventListener('keydown', function(e){ if(e.key === 'Enter') handleSend(); });

    console.log('[chat-override] hazır');
  });
})();
