import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

const el = (id) => document.getElementById(id);
const status = el("status");
const verifyBox = el("verifyBox");

function setStatus(msg, isError=false){
  status.textContent = msg || "";
  status.style.color = isError ? "#ffb4b4" : "#b8c1e3";
}

async function doEmailSignUp(){
  const email = el("email").value.trim();
  const pass  = el("password").value;
  if(!email || pass.length < 6){ return setStatus("E-posta ve en az 6 haneli şifre gir.", true); }
  try{
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    await sendEmailVerification(user);
    setStatus("Hesap oluşturuldu. Doğrulama e-postası gönderildi. Mail kutunu kontrol et.");
    verifyBox.classList.remove("hidden");
  }catch(err){ setStatus(humanizeError(err), true); }
}

async function doEmailSignIn(){
  const email = el("email").value.trim();
  const pass  = el("password").value;
  if(!email || !pass){ return setStatus("E-posta ve şifre gerekli.", true); }
  try{
    const { user } = await signInWithEmailAndPassword(auth, email, pass);
    if(!user.emailVerified){
      await signOut(auth);
      verifyBox.classList.remove("hidden");
      return setStatus("E-posta doğrulanmadı. Lütfen mailindeki linke tıkla, sonra tekrar giriş yap.", true);
    }
    setStatus("Giriş başarılı. Ana sayfaya yönlendiriliyor…");
    location.href = "/";
  }catch(err){ setStatus(humanizeError(err), true); }
}

async function doGoogleSignIn(){
  try{
    const provider = new GoogleAuthProvider();
    const { user } = await signInWithPopup(auth, provider);
    // Google hesapları emailVerified:true gelir.
    setStatus("Giriş başarılı. Ana sayfaya yönlendiriliyor…");
    location.href = "/";
  }catch(err){ setStatus(humanizeError(err), true); }
}

async function doForgot(){
  const email = el("email").value.trim();
  if(!email){ return setStatus("Şifre sıfırlamak için e-posta gir.", true); }
  try{
    await sendPasswordResetEmail(auth, email);
    setStatus("Sıfırlama e-postası gönderildi. Mail kutunu kontrol et.");
  }catch(err){ setStatus(humanizeError(err), true); }
}

async function doResend(){
  try{
    const user = auth.currentUser;
    if(!user){ return setStatus("Önce e-posta ve şifre ile giriş yap veya kayıt ol.", true); }
    await sendEmailVerification(user);
    setStatus("Doğrulama e-postası tekrar gönderildi.");
  }catch(err){ setStatus(humanizeError(err), true); }
}

// Kullanıcı durumu (opsiyonel bilgilendirme)
onAuthStateChanged(auth, (user)=>{
  if(user && user.emailVerified){
    // İstersen burada UI'da “giriş yaptın” gösterebilirsin.
  }
});

function humanizeError(err){
  const code = (err && err.code) || "";
  if(code.includes("invalid-credential")) return "E-posta veya şifre hatalı.";
  if(code.includes("email-already-in-use")) return "Bu e-posta ile hesap zaten var.";
  if(code.includes("weak-password")) return "Şifre en az 6 karakter olmalı.";
  if(code.includes("too-many-requests")) return "Çok fazla deneme. Biraz sonra tekrar dene.";
  return "Hata: " + (err?.message || code);
}

// Events
document.getElementById("btnSignUp").addEventListener("click", doEmailSignUp);
document.getElementById("btnSignIn").addEventListener("click", doEmailSignIn);
document.getElementById("btnGoogle").addEventListener("click", doGoogleSignIn);
document.getElementById("btnForgot").addEventListener("click", doForgot);
document.getElementById("btnResend").addEventListener("click", doResend);
