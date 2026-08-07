/* رماة الصحراء — عامل الخدمة
   يخزّن اللعبة على الجهاز فتشتغل بدون إنترنت،
   ويجيب أي تحديث بصمت ويبلّغ الصفحة لما يجهز. */
const VER   = 'sahra-v2';
const SHELL = ['./', './index.html'];
const norm  = req => (req.mode === 'navigate' ? './index.html' : req.url);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VER);
    await Promise.all(SHELL.map(u =>
      c.add(new Request(u, {cache:'reload'})).catch(() => {})
    ));
    // ما نستعجل التفعيل لو فيه نسخة شغالة — نخلي الصفحة تقرر
    if(!(await self.clients.matchAll()).length) self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// الصفحة تطلب تفعيل النسخة الجديدة فوراً
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'skipWaiting') self.skipWaiting();
});

async function tell(type){
  const cs = await self.clients.matchAll({includeUncontrolled:true});
  for(const c of cs) c.postMessage({type});
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  if(new URL(req.url).origin !== location.origin) return;

  e.respondWith((async () => {
    const c = await caches.open(VER);
    const key = norm(req);
    const hit = await c.match(key);

    // نجيب من الشبكة بالخلفية ونقارن: إذا تغيّر المحتوى نبلّغ الصفحة
    const net = fetch(req).then(async r => {
      if(!r || !r.ok) return r;
      const fresh = r.clone();
      if(hit){
        try{
          const [a, b] = await Promise.all([hit.clone().text(), r.clone().text()]);
          if(a !== b){ await c.put(key, fresh); tell('update'); }
        }catch(err){ await c.put(key, fresh); }
      } else {
        await c.put(key, fresh);
      }
      return r;
    }).catch(() => null);

    if(hit){ net; return hit; }               // من المخزن فوراً، والتحديث بالخلفية
    const r = await net;
    if(r) return r;
    if(req.mode === 'navigate'){
      const home = await c.match('./index.html');
      if(home) return home;
    }
    return new Response('غير متاح بدون إنترنت', {status:503,
      headers:{'Content-Type':'text/plain; charset=utf-8'}});
  })());
});
