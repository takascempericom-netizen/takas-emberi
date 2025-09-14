<script>
window.letterAvatarColor = function(text){
  var s = (text || 'U').trim();
  var ch = (s[0] || 'U').toUpperCase();
  var colors = ['#ff5a5a','#ff7a00','#ffd33d','#12d179','#1f6feb','#a371f7','#e36209','#e11d48'];
  var sum = 0; for (var i=0; i<s.length; i++){ sum += s.charCodeAt(i); }
  var color = colors[sum % colors.length];
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">'
          + '<rect width="100%" height="100%" fill="'+color+'"/>'
          + '<text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"'
          + ' font-family="Inter,Arial,sans-serif" font-size="96" fill="#fff">'+ch+'</text></svg>';
  return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg);
};
</script>
