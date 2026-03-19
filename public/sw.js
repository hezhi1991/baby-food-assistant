self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (e) => {
  // 简单的透传，确保 PWA 可被识别
  e.respondWith(fetch(e.request));
});
