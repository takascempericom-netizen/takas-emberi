(function(){
  var PROJECT_ID='ureten-eller-v2';
  var DOC='https://firestore.googleapis.com/v1/projects/'+PROJECT_ID+'/databases/(default)/documents';
  var RUNQ=DOC.replace('/documents','')+'/documents:runQuery';

  function fStr(s){return {stringValue:String(s||'')};}
  function create(path,fields){return fetch(DOC+'/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields})}).then(r=>r.json());}
  function runQuery(body){return fetch(RUNQ,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());}

  function draw(list){var box=document.getElementById('log'); box.innerHTML=list.map(m=>{
    var f=m.fields||{}, from=(f.senderId&&f.senderId.stringValue)||'-', text=(f.text&&f.text.stringValue)||'';
    var me=(from==='admin'); return '<div style="margin:6px 0;text-align:'+(me?'right':'left')+'">'+
      '<span class="badge">'+from+'</span> '+text+'</div>';
  }).join('');}

  function load(uid){
    if(!uid) return;
    var q={structuredQuery:{from:[{collectionId:'support/'+uid+'/messages'}],
      orderBy:[{field:{fieldPath:'createdAt'},direction:'DESCENDING'}],limit:50}};
    runQuery(q).then(arr=>{
      var docs=(arr||[]).filter(x=>x.document).map(x=>x.document);
      draw(docs.reverse());
    });
  }

  document.getElementById('send').addEventListener('click',function(){
    var uid=document.getElementById('uid').value.trim();
    var text=document.getElementById('msg').value.trim();
    if(!uid || !text){ alert('uid ve mesaj zorunlu'); return; }
    create('support/'+uid+'/messages',{ senderId:fStr('admin'), text:fStr(text), createdAt:{timestampValue:new Date().toISOString()} })
      .then(()=>{ document.getElementById('msg').value=''; load(uid); })
      .catch(()=>alert('Gönderilemedi'));
  });

  // otomatik yenileme
  setInterval(function(){
    var uid=document.getElementById('uid').value.trim();
    if(uid) load(uid);
  }, 3000);
})();
