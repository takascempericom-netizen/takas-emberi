/** SAFE STUB (ES5) */
(function (w) {
  var api = {
    init: function(){}, mount: function(){},
    on: function(){}, off: function(){},
    fetchPending: function(){ return Promise.resolve([]); }
  };
  w.NotifyBell = api; w.__notifyBell = api;
})(window);
