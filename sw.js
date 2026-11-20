const C='yaryi-v8';
const A=['./','index.html','app.js?v=1.7','data/program.js?v=1.7','lib/jszip.min.js','tpl.js?v=1.7','templates/konspekt-158-v1.docx','templates/konspekt-158-v2.docx','templates/prezentatsiya-158.pptx','lib/pptxgen.min.js','lib/pdf.min.mjs','lib/pdf.worker.min.mjs',
'manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/icon-32.png','icons/apple-touch-icon.png',
'fonts/russo-one-cyrillic-400-normal.woff2','fonts/russo-one-latin-400-normal.woff2','fonts/tektur-cyrillic-400-normal.woff2','fonts/tektur-cyrillic-700-normal.woff2','fonts/tektur-latin-400-normal.woff2','fonts/tektur-latin-700-normal.woff2',
'fonts/jetbrains-mono-cyrillic-400-normal.woff2','fonts/jetbrains-mono-cyrillic-700-normal.woff2','fonts/jetbrains-mono-latin-400-normal.woff2','fonts/jetbrains-mono-latin-700-normal.woff2',
'fonts/golos-cyrillic-400.woff2','fonts/golos-cyrillic-600.woff2','fonts/golos-latin-400.woff2','fonts/golos-latin-600.woff2'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(A.map(u=>c.add(u).catch(()=>null)))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url); if(u.origin!==location.origin||e.request.method!=='GET') return;
  const isPage=e.request.mode==='navigate';
  e.respondWith(
    fetch(e.request).then(r=>{ if(r.ok){ const cp=r.clone(); caches.open(C).then(c=>c.put(isPage?'index.html':e.request,cp)); } return r; })
    .catch(()=>caches.match(isPage?'index.html':e.request,{ignoreSearch:isPage}).then(r=>r||caches.match(e.request,{ignoreSearch:true})))
  );
});
