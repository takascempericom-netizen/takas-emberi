(function(){
  function show(msg){
    let box = document.getElementById('debug-error-box');
    if(!box){
      box = document.createElement('pre');
      box.id = 'debug-error-box';
      box.style.cssText = 'position:fixed;z-index:99999;left:8px;bottom:8px;max-width:90vw;max-height:60vh;overflow:auto;background:#111;color:#0f0;padding:10px;border:1px solid #0f0;font:12px/1.4 monospace;white-space:pre-wrap;';
      document.body.appendChild(box);
    }
    box.textContent = msg;
    console.error(msg);
  }

  window.addEventListener('error', (e)=>{
    const err = e.error || {};
    show(
      'ERROR: ' + e.message +
      '\nfile: ' + (e.filename||'?') +
      '\nline: ' + (e.lineno||'?') + ':' + (e.colno||'?') +
      '\nstack:\n' + (err.stack||'(no stack)')
    );
  });

  window.addEventListener('unhandledrejection', (e)=>{
    const r = e.reason || {};
    show(
      'UNHANDLED REJECTION: ' + (r.message||String(r)) +
      '\nstack:\n' + (r.stack||'(no stack)')
    );
  });
})();
