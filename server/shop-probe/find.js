
(function () {
  var clicked = 0;
  function pick() {
    var text = document.body ? document.body.innerText : '';
    var m = text.match(/(?:состав|ingredients|inci)\s*[:：]?\s*\n*\s*((?:aqua|water|вода|[a-zа-яё][^\n]{2,60}),[^\n]{20,3000})/i);
    if (m) return m[1];
    var html = document.documentElement ? document.documentElement.innerHTML : '';
    var h = html.match(/(?:Состав|Ingredients|INCI)[^<]{0,40}<\/[^>]+>(?:\s*<[^>]+>){0,4}\s*([^<]{30,3000})/i);
    if (h && h[1].indexOf(',') > 0) return h[1];
    var j = html.match(/"(?:composition|ingredients|sostav)"\s*:\s*"([^"]{30,3000})"/i);
    return j ? j[1] : null;
  }
  function tick() {
    try {
      if (clicked < 3) {
        var els = document.querySelectorAll('button, [role="tab"], [role="button"], summary, li, div, span, a');
        for (var i = 0; i < els.length; i++) {
          var t = (els[i].textContent || '').trim().toLowerCase();
          if (t === 'состав' || t === 'ingredients' || t === 'состав продукта' || t === 'состав и описание' || t === 'описание и состав') { els[i].click(); clicked++; break; }
        }
      }
      var found = pick();
      if (found) {
        window.__found = { title: document.title, text: found };
        return;
      }
    } catch (e) {}
    setTimeout(tick, 800);
  }
  setTimeout(tick, 1000);
})();
