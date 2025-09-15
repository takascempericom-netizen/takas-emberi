(function(){
  var PROJECT_ID = 'ureten-eller-v2';
  var BASE = 'https://firestore.googleapis.com/v1/projects/'+PROJECT_ID+'/databases/(default)/documents:runQuery';
  function q(body){ return fetch(BASE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    .then(r=>r.json()).then(a=>a.filter(x=>x.document).map(x=>x.document)); }
  function v(f){ if(!f) return ''; if('stringValue'in f) return f.stringValue; if('integerValue'in f) return f.integerValue;
    if('doubleValue'in f) return f.doubleValue; if('booleanValue'in f) return f.booleanValue; if('timestampValue'in f) return f.timestampValue; return ''; }
  function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
  function rowPending(d){var f=d.fields||{}, id=d.name.split('/').pop();
    return '<tr><td>'+esc(v(f.title)||'(başlıksız)')+'</td><td>'+esc(v(f.ownerName)||v(f.ownerId)||'-')+
           '</td><td><a href="/admin/listing.html?id='+id+'" target="_blank">Aç</a></td>'+
           '<td class="row-actions"><button class="btn approve" data-id="'+id+'">Yayına Al</button>'+
           '<button class="btn reject" data-id="'+id+'">Reddet</button></td></tr>'; }
  function rowActive(d){var f=d.fields||{}, id=d.name.split('/').pop();
    return '<tr><td>'+esc(v(f.title)||'(başlıksız)')+'</td><td>'+esc(v(f.ownerName)||v(f.ownerId)||'-')+
           '</td><td>'+esc(String(v(f.price)||'-'))+'</td>'+
           '<td><button class="btn reject" data-id="'+id+'">Arşivle</button></td></tr>'; }
  function rowExpired(d){var f=d.fields||{};
    return '<tr><td>'+esc(v(f.title)||'(başlıksız)')+'</td><td>'+esc(v(f.ownerName)||v(f.ownerId)||'-')+
           '</td><td>'+esc(String(v(f.expiresAt)||'-').replace('T',' ').replace('Z',''))+'</td>'+
           '<td><button class="btn">İncele</button></td></tr>'; }
  function fill(tid,docs,row){var tb=document.querySelector('#'+tid+' tbody'); if(!tb) return;
    if(!docs||!docs.length){tb.innerHTML='<tr><td colspan="4" class="muted">Kayıt bulunamadı.</td></tr>'; return;}
    tb.innerHTML=docs.map(row).join('');}
  function setTxt(id,val){var el=document.getElementById(id); if(el) el.textContent=String(val);}
  function run(){
    var nowIso=new Date().toISOString();
    var qPending={structuredQuery:{from:[{collectionId:'listings'}],
      where:{fieldFilter:{field:{fieldPath:'status'},op:'EQUAL',value:{stringValue:'pending'}}},
      orderBy:[{field:{fieldPath:'createdAt'},direction:'DESCENDING'}],limit:100}};
    var qActive={structuredQuery:{from:[{collectionId:'listings'}],
      where:{fieldFilter:{field:{fieldPath:'status'},op:'EQUAL',value:{stringValue:'active'}}},
      orderBy:[{field:{fieldPath:'createdAt'},direction:'DESCENDING'}],limit:100}};
    var qExpired={structuredQuery:{from:[{collectionId:'listings'}],
      where:{compositeFilter:{op:'AND',filters:[
        {fieldFilter:{field:{fieldPath:'status'},op:'EQUAL',value:{stringValue:'active'}}},
        {fieldFilter:{field:{fieldPath:'expiresAt'},op:'LESS_THAN',value:{timestampValue:nowIso}}}
      ]}},orderBy:[{field:{fieldPath:'expiresAt'},direction:'DESCENDING'}],limit:100}};
    Promise.all([q(qPending),q(qActive),q(qExpired)]).then(r=>{
      var pend=r[0], act=r[1], exp=r[2];
      setTxt('m_total', (pend.length+act.length));
      setTxt('m_pending', pend.length);
      setTxt('m_expired', exp.length);
      fill('tbl_pending', pend, rowPending);
      fill('tbl_active',  act,  rowActive);
      fill('tbl_expired', exp,  rowExpired);
    }).catch(e=>console.warn('[admin] listings fetch error',e));
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run);} else {run();}
})();
