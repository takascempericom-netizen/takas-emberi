window.addEventListener('error', function(e){
  var msg = String(e && (e.error || e.message) || '');
  if (msg.indexOf('permission-denied') !== -1) {
    console.warn('[admin] permission-denied (sönümlendi)');
    e.preventDefault(); return false;
  }
});
