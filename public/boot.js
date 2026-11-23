// Startup watchdog (classic script, runs before the app bundle).
// If the app fails to start, show the reason instead of a blank white page.
(function () {
  var errs = [];
  function note(m) { errs.push(String(m).slice(0, 300)); }
  window.addEventListener('error', function (e) { note((e.message || 'Script error') + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '')); }, true);
  window.addEventListener('unhandledrejection', function (e) { var r = e.reason; note('Promise: ' + (r && (r.message || r.name) || r)); });
  window.__fiscusBoot = { errs: errs };
  function show() {
    var root = document.getElementById('root');
    if (!root || root.childElementCount > 0 || window.__fiscusStarted === 'ready') return;
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#f2f2f7;color:#000;font:15px -apple-system,system-ui,sans-serif;padding:60px 22px;overflow:auto';
    d.innerHTML = '<div style="font-size:38px">⚠️</div><h2 style="margin:8px 0">Fiscus didn\'t start</h2>' +
      '<p style="color:#6c6c70;margin:0 0 12px">Your data is safe. Please send a screenshot of this screen.</p>' +
      '<pre id="fx-err" style="white-space:pre-wrap;word-break:break-word;font-size:12px;background:#fff;border-radius:12px;padding:12px;color:#c9003c"></pre>' +
      '<button id="fx-rl" style="margin-top:14px;padding:12px 26px;border:0;border-radius:99px;background:#10a36b;color:#fff;font-size:17px;font-weight:600">Reload</button>';
    document.body.appendChild(d);
    document.getElementById('fx-err').textContent =
      (errs.length ? errs.join('\n') : 'No error reported. Stage: ' + (window.__fiscusStarted || 'bundle not started')) + '\n\n' + navigator.userAgent;
    document.getElementById('fx-rl').onclick = function () {
      var p = [];
      try { if (navigator.serviceWorker) p.push(navigator.serviceWorker.getRegistrations().then(function (r) { return Promise.all(r.map(function (x) { return x.unregister(); })); })); } catch (e) {}
      try { if (window.caches) p.push(caches.keys().then(function (k) { return Promise.all(k.map(function (x) { return caches.delete(x); })); })); } catch (e) {}
      Promise.all(p).then(function () { location.reload(); }, function () { location.reload(); });
    };
  }
  setTimeout(show, 6000);
})();
