/**
 * Admin safe guard: swallow Firestore permission-denied errors.
 */
window.addEventListener('error', function(e){
  var msg = String(e && (e.error || e.message) || '');
  if (msg.indexOf('permission-denied') !== -1) {
    console.warn('[admin] snapshot blocked by rules (permission-denied).');
    e.preventDefault();
    return false;
  }
});
