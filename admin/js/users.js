(function(){
  var PROJECT_ID='ureten-eller-v2';
  var RUNQ='https://firestore.googleapis.com/v1/projects/'+PROJECT_ID+'/databases/(default)/documents:runQuery';
  var DOC='https://firestore.googleapis.com/v1/projects/'+PROJECT_ID+'/databases/(default)/documents';
  function q(body){return fetch(RUNQ,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());}
  function del(fullName){return fetch(DOC+'/'+fullName,{method:'DELETE'}).then(r=>r.text());}
  function create(path,fields){return fetch(DOC+'/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields})}).then(r=>r.json());}
  function fStr(s){return {stringValue:String(s||'')};}
  function fBool(b){return {booleanValue:!!b};}

  function load(){
    var qUsers={structuredQuery:{from:[{collectionId:'users'}],orderBy:[{field:{fieldPath:'createdAt'},direction:'DESCENDING'}],limit:100}};
    q(qUsers).then(arr=>{
      var docs=(arr||[]).filter(x=>x.document).map(x=>x.document);
      var tb=document.querySelector('#tbl_users tbody'); if(!tb) return;
      if(!docs.length){ tb.innerHTML='<tr><td colspan="5" class="muted">Kullanıcı yok.</td></tr>'; return; }
      tb.innerHTML=docs.map(d=>{
        var f=d.fields||{}, uid=(d.name||'').split('/').pop(), name=(f.name&&f.name.stringValue)||uid, email=(f.email&&f.email.stringValue)||'-', role=(f.role&&f.role.stringValue)||'-';
        return '<tr>'+
          '<td>'+name+'</td><td>'+email+'</td><td><span class="badge">'+role+'</span></td>'+
          '<td class="row-actions">'+
            '<button class="btn warn" data-ban="'+uid+'">Banla</button>'+
            '<button class="btn reject" data-del="'+d.name+'">Sil</button>'+
          '</td>'+
        '</tr>';
      }).join('');
      tb.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',function(){
        if(!confirm('Bu kullanıcı dokümanı silinsin mi?'))return;
        del(this.dataset.del).then(()=>{ load(); }).catch(()=>alert('Silme hatası'));
      }));
      tb.querySelectorAll('[data-ban]').forEach(b=>b.addEventListener('click',function(){
        var uid=this.dataset.ban; if(!confirm(uid+' banlansın mı?'))return;
        create('bans',{ uid:fStr(uid), active:fBool(true), reason:fStr('admin'), createdAt:{timestampValue:new Date().toISOString()} })
          .then(()=>alert('Banlandı')).catch(()=>alert('Ban hatası'));
      }));
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load); else load();
})();
