// 하영의 지도 — 서비스워커 (설치형 PWA + 기본 오프라인)
const C = "hymap-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return; // CDN 등은 브라우저 기본 캐시
  const isData = u.pathname.startsWith("/data/");
  const isDoc = e.request.mode === "navigate" || u.pathname === "/" ||
    u.pathname.endsWith(".html") || u.pathname.endsWith(".webmanifest");
  if (isData || isDoc) {
    // 최신 우선(오프라인 시 캐시 폴백)
    e.respondWith(
      fetch(e.request).then((r) => { const c = r.clone(); caches.open(C).then((x) => x.put(e.request, c)); return r; })
        .catch(() => caches.match(e.request))
    );
  } else {
    // 정적 에셋(css/js/아이콘): 캐시 우선
    e.respondWith(
      caches.match(e.request).then((r) => r ||
        fetch(e.request).then((rr) => { const c = rr.clone(); caches.open(C).then((x) => x.put(e.request, c)); return rr; }))
    );
  }
});
