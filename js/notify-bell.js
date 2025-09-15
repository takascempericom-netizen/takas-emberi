/**
 * SAFE STUB for admin – no classes, no imports, plain ES5.
 * Prevents SyntaxError in admin panel.
 */
(function (w) {
  var api = {
    init: function(){},
    mount: function(){},
    on: function(){},
    off: function(){},
    fetchPending: function(){ return Promise.resolve([]); }
  };
  w.NotifyBell = api;
  w.__notifyBell = api;
})(window);
