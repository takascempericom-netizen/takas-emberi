#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true
set +o histexpand 2>/dev/null || true

FILE="index.html"; [ -f "$FILE" ] || FILE="web/index.html"
[ -f "$FILE" ] || { echo "❌ index.html bulunamadı (./ veya ./web)"; exit 1; }

cp "$FILE" "$FILE.bak.$(date +%s)"

# 1) Enjekte edilecek temiz module script (home.html redirect dahil)
cat > /tmp/newmod.chunk <<'HTML'
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import {
    getAuth, setPersistence, browserLocalPersistence, indexedDBLocalPersistence,
    signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
    sendPasswordResetEmail, sendEmailVerification, signOut, onAuthStateChanged
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

  const firebaseConfig = {
    apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
    authDomain: "ureten-eller-v2.firebaseapp.com",
    projectId: "ureten-eller-v2",
    storageBucket: "ureten-eller-v2.firebasestorage.app",
    messagingSenderId: "621494781131",
    appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
  };

  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  try { await setPersistence(auth, indexedDBLocalPersistence); } catch { await setPersistence(auth, browserLocalPersistence); }

  const $ = (s, r=document)=>r.querySelector(s);

  // Google ile giriş → /home.html
  const provider = new GoogleAuthProvider();
  async function googleLogin(){
    await signInWithPopup(auth, provider);
    location.href = "/home.html";
  }
  $("#btnGoogleLogin")?.addEventListener("click", googleLogin);
  $("#btnGoogleSignup")?.addEventListener("click", googleLogin);

  // E-posta ile giriş
  $("#btnEmailLogin")?.addEventListener("click", async ()=>{
    const email = $("#loginEmail")?.value?.trim() || "";
    const pass  = $("#loginPass")?.value || "";
    if(!email || !pass) return;

    const { user } = await signInWithEmailAndPassword(auth, email, pass);
    if (!user.emailVerified) {
      try { await sendEmailVerification(user); } catch {}
      alert("E-postanı doğrulaman gerekiyor. Doğrulama linkini gönderdik. Gelen kutunu/SPAM’ı kontrol et.");
      try { await signOut(auth); } catch {}
      return;
    }
    location.href = "/home.html";
  });

  // Şifremi Unuttum
  $("#btnForgot")?.addEventListener("click", async ()=>{
    let email = $("#loginEmail")?.value?.trim() || prompt("E-posta:") || "";
    if(!email) return;
    await sendPasswordResetEmail(auth, email);
    alert("Sıfırlama e-postası gönderildi: " + email);
  });

  // Çıkış
  $("#btnLogout")?.addEventListener("click", async ()=>{
    try { await signOut(auth); } catch {}
    location.href = "/";
  });

  // Yedek: oturum açık & doğrulanmışsa /home.html
  onAuthStateChanged(auth, (user)=>{
    const verified = !!user && (user.emailVerified || (user?.providerData||[]).some(p=>p.providerId==="google.com"));
    if (verified && !/\/home\.html$/.test(location.pathname)) {
      location.replace("/home.html");
    }
  });
</script>
HTML

# 2) Tüm bozuk/çoklu module script bloklarını kaldır
perl -0777 -pe 's@<script[^>]*type="module"[^>]*>.*?</script>\s*@@gis' -i "$FILE"

# 3) Yeni bloğu </body> kapanışından hemen önce enjekte et (yoksa dosyanın sonuna ekle)
awk 'BEGIN{ins=0} /<\/body>/ && !ins { system("cat /tmp/newmod.chunk"); print; ins=1; next } { print } END{ if(!ins){ system("cat /tmp/newmod.chunk") } }' "$FILE" > "$FILE.tmp" \
  && mv "$FILE.tmp" "$FILE"

# 4) Git commit + push
git add "$FILE"
git commit -m "fix(auth): temiz module script eklendi; login sonrası /home.html yönlendirme"
git push
echo "✅ Bitti. Yedek: $FILE.bak.*"
