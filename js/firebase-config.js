// js/firebase-config.js
// Firebase v10 CDN kullanımı

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUUNSYxoWNUsK0C-C04qTUm6KM5756fvg",
  authDomain: "ureten-eller-v2.firebaseapp.com",
  projectId: "ureten-eller-v2",
  storageBucket: "ureten-eller-v2.appspot.com", // ✅ düzeltilmiş
  messagingSenderId: "621494781131",
  appId: "1:621494781131:web:13cc3b061a5e94b7cf874e"
};

export const app = initializeApp(firebaseConfig);
