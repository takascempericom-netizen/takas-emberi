import fs from 'fs';
const P='profile.html';
let s=fs.readFileSync(P,'utf8');
const v=Date.now().toString();
if(s.includes('/profile-fix.js')){
  // varsa eski ?v=... parametresini temizle, sonra yeni ekle
  s=s.replace(/\/profile-fix\.js\?v=\d+/g, '/profile-fix.js');
  s=s.replace(/(src=)(["'])\/profile-fix\.js(\2)/, `$1$2/profile-fix.js?v=${v}$3`);
  fs.writeFileSync(P,s);
  console.log('cache-bust version', v);
} else {
  console.log('profile-fix tag bulunamadı');
}
