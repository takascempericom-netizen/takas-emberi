import { auth } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';

function bindAllLogoutButtons(){
  // data-logout veya .logout sınıfı olan tüm butonlar
  document.querySelectorAll('a[data-logout], a.logout').forEach(a=>{
    a.onclick = async (e)=>{
      e.preventDefault();
      try{ await signOut(auth); location.href='index.html'; }
      catch(err){ alert('Çıkış hatası: '+err.message); }
      return false;
    };
  });
  // Metni "Çıkış" olan linkleri de işaretle (ekstra güvenlik)
  document.querySelectorAll('a').forEach(a=>{
    if((a.textContent||'').trim().includes('Çıkış')) a.setAttribute('data-logout','1');
  });
}

document.readyState==='loading'
  ? document.addEventListener('DOMContentLoaded',bindAllLogoutButtons)
  : bindAllLogoutButtons();
