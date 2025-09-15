/* Broadcast & Ticker (REST) */
(function(){
  var PROJECT_ID='ureten-eller-v2';
  var RUNQ='https://firestore.googleapis.com/v1/projects/'+PROJECT_ID+'/databases/(default)/documents:runQuery';
  var DOC='https://firestore.googleapis.com/v1/projects/'+PROJECT_ID+'/databases/(default)/documents';

  function runQuery(body){return fetch(RUNQ,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());}
  function createDoc(path, fields){return fetch(DOC+'/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:fields})}).then(r=>r.json());}
  function patchDoc(fullName, fields){return fetch(DOC+'/'+fullName+'?updateMask.fieldPaths=active&updateMask.fieldPaths=message&updateMask.fieldPaths=icon&updateMask.fieldPaths=expiresAt',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:fields})}).then(r=>r.json());}
  function fStr(s){return {stringValue:String(s||'')};}
  function fBool(b){return {booleanValue:!!b};}
  function fTime(iso){return {timestampValue:iso};}

  // ----- TICKER: aktif duyurulardan en güncelini akıt
  function mountTicker(){
    var bar=document.getElementById('ticker-text');
    if(!bar) return;
    var q={structuredQuery:{from:[{collectionId:'announcements'}],
      where:{fieldFilter:{field:{fieldPath:'active'},op:'EQUAL',value:{booleanValue:true}}},
      orderBy:[{field:{fieldPath:'createdAt'},direction:'DESCENDING'}],limit:1}};
    runQuery(q).then(arr=>{
      var d=(arr||[]).find(x=>x.document);
      if(!d){ bar.textContent=''; return; }
      var f=d.document.fields||{};
      var msg=(f.message&&f.message.stringValue)||'';
      var icon=(f.icon&&f.icon.stringValue)||'';
      bar.textContent=' '+msg;
      var ic=document.getElementById('ticker-icon'); if(ic) ic.textContent=icon||'🛎️';
    }).catch(()=>{});
  }

  // ----- BELL: aktif bildirim sayısını /public/notifications üzerinden göster
  function mountBell(){
    var dot=document.getElementById('bell-dot');
    if(!dot) return;
    var q={structuredQuery:{from:[{collectionId:'public'}],
      where:{fieldFilter:{field:{fieldPath:'type'},op:'EQUAL',value:{stringValue:'notification'}}},
      limit:50}};
    runQuery(q).then(arr=>{
      var docs=(arr||[]).filter(x=>x.document).map(x=>x.document);
      var active=docs.filter(d=>{
        var f=d.fields||{}; return f.active && f.active.booleanValue===true;
      });
      dot.textContent=String(active.length||0);
      dot.style.display=(active.length>0?'inline-block':'none');
    }).catch(()=>{});
  }

  // ----- Form: yeni duyuru + bildirim oluştur
  function bindForm(){
    var form=document.getElementById('broadcast-form');
    if(!form) return;
    form.addEventListener('submit',function(e){
      e.preventDefault();
      var icon=form.icon.value||'🛎️';
      var message=form.message.value||'';
      var expires=form.expires.value?new Date(form.expires.value).toISOString():'';
      Promise.all([
        createDoc('announcements',{ icon:fStr(icon), message:fStr(message), active:fBool(true), createdAt:fTime(new Date().toISOString()), expiresAt: (expires?fTime(expires):undefined)}),
        createDoc('public',{ type:fStr('notification'), icon:fStr(icon), message:fStr(message), active:fBool(true), createdAt:fTime(new Date().toISOString()) })
      ]).then(()=>{ alert('Yayımlandı'); form.reset(); mountTicker(); mountBell(); })
       .catch(err=>{ alert('Hata: '+(err&&err.error&&err.error.message||'unknown')); });
    });
  }

  function init(){ mountTicker(); mountBell(); bindForm(); }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
