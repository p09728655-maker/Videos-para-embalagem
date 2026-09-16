/* Service worker do gerador (RitmoPatrimar Vídeos Embalagem).
 *
 * IMPORTANTE: este SW NUNCA intercepta /tv. O painel da TV depende de comparar
 * ETag/Last-Modified para detectar publicação nova; se o SW servisse /tv do cache,
 * a TV ficaria presa num produto antigo sem ninguém perceber. O guard em fetch()
 * abaixo é o que garante isso — não remova.
 */
var CACHE = 'ritmopatrimar-embalagem-v16';

/* Só o que o gerador precisa para abrir sem internet. */
var ESSENCIAL = [
  './',
  './inicio.html',
  './gerador.html',
  './manifest.webmanifest',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-maskable-512.png',
  './icones/apple-touch-icon.png',
  './logo/patrimar.png',
  './biblioteca.html',
  './configuracoes.html',
  './supabase-config.js',
  './publicar.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

/* Cacheia item a item: se o CDN falhar, o SW ainda instala em vez de abortar tudo. */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ESSENCIAL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' }))['catch'](function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) {
        return k === CACHE ? null : caches['delete'](k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  /* Guard do painel da TV — deixa passar direto para a rede, sempre. */
  if (url.origin === self.location.origin && /^\/tv(\/|$)/.test(url.pathname)) return;

  /* Guard do Supabase: respostas de API vem como CORS e cairiam no cache abaixo,
     servindo painel velho e escondendo a troca de produto. Nunca interceptar. */
  if (url.hostname.indexOf('supabase.co') >= 0) return;

  /* Rede primeiro, com cache como reserva: o gerador atualizado sempre vence,
     mas continua abrindo offline. */
  e.respondWith(
    fetch(req).then(function (resp) {
      if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'cors')) {
        var copia = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); });
      }
      return resp;
    })['catch'](function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match('./gerador.html');
      });
    })
  );
});
