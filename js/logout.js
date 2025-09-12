import { auth } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
document.getElementById('btnLogout')?.addEventListener('click', async (e)=>{
  e.preventDefault();
  try{ await signOut(auth); location.href='index.html'; }
  catch(err){ alert('Çıkış hatası: '+err.message); }
});
