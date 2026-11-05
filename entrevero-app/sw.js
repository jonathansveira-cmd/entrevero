const V = 'efc-v8';
self.window = self;
try { importScripts('config.js'); } catch (e) { }
const ARQ = ['./', 'index.html', 'styles.css', 'app.js', 'core.js', 'pdf.js', 'config.js', 'manifest.webmanifest', 'icons/escudo.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(ARQ))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'efc-meta').map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});

/* ---------- notificações ---------- */
async function meta(k) { try { const c = await caches.open('efc-meta'); const r = await c.match('/__efc/' + k); return r ? await r.text() : ''; } catch (e) { return ''; } }
async function setMeta(k, v) { try { const c = await caches.open('efc-meta'); await c.put('/__efc/' + k, new Response(String(v))); } catch (e) { } }
const ICONE = 'icons/icon-192.png';
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let lista = [];
    try {
      const token = await meta('token');
      if (self.EFC_API && token) {
        const r = await fetch(self.EFC_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'avisos', token }) });
        const j = await r.json(); lista = (j && j.avisos) || [];
      }
    } catch (x) { }
    const ult = await meta('ultimo');
    let novos = lista.filter(a => !ult || a.id > ult).slice(0, 3);
    if (!novos.length) novos = lista.slice(0, 1);
    if (lista[0]) await setMeta('ultimo', lista[0].id);
    if (!novos.length) return self.registration.showNotification('Entrevero Futsal Clube', { body: 'Tem novidade no app ⚽', icon: ICONE, badge: ICONE, tag: 'efc' });
    return Promise.all(novos.reverse().map(a => self.registration.showNotification(a.titulo, { body: a.texto, icon: ICONE, badge: ICONE, tag: a.id, data: { url: './' } })));
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) { if ('focus' in w) return w.focus(); }
    return self.clients.openWindow('./');
  }));
});
