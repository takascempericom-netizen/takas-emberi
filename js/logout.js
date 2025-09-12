import { auth } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
function bind(){
  document.querySelectorAll('[data-logout], .logout').forEach(el=>{
    el.addEventListener('click', async (e)=>{
      e.preventDefault();
      try{ await signOut(auth); location.href='index.html'; }
      catch(err){ alert('Çıkış hatası: '+err.message); }
    });
  });
}
document.readyState==='loading' ? document.addEventListener('DOMContentLoaded',bind) : bind();
