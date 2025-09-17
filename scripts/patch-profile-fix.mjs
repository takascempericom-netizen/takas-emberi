import fs from 'fs';
const P='profile-fix.js';
let s=fs.readFileSync(P,'utf8');
const want='initializeApp(cfg,"profileFix")';
if(!s.includes(want)){
  s=s.replace(
    /const app = getApps\(\)\.length \? getApp\(\) : initializeApp\(cfg\);/,
`const app = (()=>{ try{ const a=getApp(); const o=a.options||{};
  if(o.projectId!=="ureten-eller-v2" || o.storageBucket!=="ureten-eller-v2.firebasestorage.app"){
    return initializeApp(cfg,"profileFix");
  }
  return a;
}catch{
  return initializeApp(cfg,"profileFix");
}})();`
  );
  fs.writeFileSync(P,s);
  console.log('patched profile-fix.js');
} else {
  console.log('already ok');
}
