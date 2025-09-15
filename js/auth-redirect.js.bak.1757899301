import { auth } from './firebase-config.js';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
const next = new URLSearchParams(location.search).get('next') || 'home.html';
onAuthStateChanged(auth,u=>{if(u)location.href=next});
document.getElementById('signupForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await createUserWithEmailAndPassword(auth,e.target.email.value,e.target.password.value);location.href=next}catch(err){alert(err.message)}});
document.getElementById('loginForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await signInWithEmailAndPassword(auth,e.target.email.value,e.target.password.value);location.href=next}catch(err){alert(err.message)}});
