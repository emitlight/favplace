/* ============== 하영의 지도 — 앱 로직 ============== */
(function () {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const C = window.CONFIG;
const catMap = Object.fromEntries(C.CATS.map(c => [c.k, c]));
const catColor = k => (catMap[k] && catMap[k].color) || '#9A9890';
const catLabel = k => (catMap[k] && (catMap[k].label || catMap[k].k)) || k;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const fmtN = n => (n == null ? '' : Number(n).toLocaleString('ko-KR'));
const LITE = /[?&]lite\b/.test(location.search);
const LITE_SRC = 'data:image/svg+xml;charset=utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%224%22 height=%223%22%3E%3C/svg%3E';
const picSrc = u => LITE ? LITE_SRC : u;

let PLACES = [], META = {}, map, clusterGroup, selLayer, activeCat = null, searchQ = '', listLimit = 60, userLoc = null, sortMode = 'reco';

/* ---------- 비밀번호 게이트 ---------- */
function initGate() {
  // 배포본은 Cloudflare 엣지 인증(_middleware Basic Auth)으로 보호되므로 클라이언트 게이트는 생략.
  $('#gate').style.display = 'none';
  $('#app').hidden = false;
  boot();
}

/* ---------- 부트 ---------- */
async function boot() {
  try {
    const [p, m] = await Promise.all([
      fetch('./data/places.json', { cache: 'no-store' }).then(r => r.json()),
      fetch('./data/meta.json', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
    ]);
    PLACES = p; META = m || {};
  } catch (e) { console.error('데이터 로드 실패', e); PLACES = []; }
  initMap(); renderChips(); renderMarkers(); renderList();
  initSheet(); initSearch(); initGallery(); initRecommend(); initNearby();
}

/* ---------- 지도 ---------- */
function initMap() {
  const dark = matchMedia('(prefers-color-scheme:dark)').matches;
  map = L.map('map', { zoomControl: false, attributionControl: true, tap: true }).setView(C.CENTER, C.ZOOM);
  L.tileLayer(dark ? C.TILE_DARK : C.TILE_LIGHT, { attribution: C.TILE_ATTR, subdomains: 'abcd', maxZoom: 19, detectRetina: true }).addTo(map);
  clusterGroup = L.markerClusterGroup({ maxClusterRadius: 48, showCoverageOnHover: false, iconCreateFunction: clusterIcon });
  map.addLayer(clusterGroup);
  selLayer = L.layerGroup().addTo(map);
}
function highlight(p) {
  if (!selLayer) return;
  selLayer.clearLayers();
  L.marker([p.la, p.lo], {
    zIndexOffset: 2000,
    icon: L.divIcon({ html: `<div class="mk mk-sel" style="background:${catColor(p.c)}"></div>`, className: '', iconSize: [38, 38], iconAnchor: [19, 36] })
  }).addTo(selLayer);
}
function clusterIcon(cluster) {
  const n = cluster.getChildCount();
  const size = n < 10 ? 38 : n < 50 ? 46 : 54;
  return L.divIcon({ html: `<div class="cluster" style="width:${size}px;height:${size}px;background:var(--brand)">${n}</div>`, className: '', iconSize: [size, size] });
}
function markerFor(p) {
  const m = L.marker([p.la, p.lo], {
    icon: L.divIcon({ html: `<div class="mk" style="background:${catColor(p.c)}"></div>`, className: '', iconSize: [26, 26], iconAnchor: [13, 24] })
  });
  m.on('click', () => openDetail(p));
  return m;
}
function matchSearch(p) {
  if (!searchQ) return true;
  const q = searchQ.toLowerCase();
  return (p.n && p.n.toLowerCase().includes(q)) || (p.rg && p.rg.includes(q)) ||
    (p.nc && p.nc.includes(q)) || (p.mc && p.mc.includes(q)) ||
    (p.mn && p.mn.some(m => m.n && m.n.toLowerCase().includes(q)));
}
function visiblePlaces() {
  return PLACES.filter(p => p.map && (!activeCat || p.c === activeCat) && matchSearch(p));
}
function renderMarkers() {
  if (!clusterGroup) return;
  clusterGroup.clearLayers();
  visiblePlaces().forEach(p => clusterGroup.addLayer(markerFor(p)));
}

/* ---------- 카테고리 칩 ---------- */
function catCount(k) { return PLACES.filter(p => p.c === k && p.map).length; }
function renderChips() {
  const el = $('#chips'); el.innerHTML = '';
  el.appendChild(makeChip(null, '전체', null));
  C.CATS.forEach(c => { if (catCount(c.k) > 0) el.appendChild(makeChip(c.k, c.label || c.k, c.color)); });
}
function makeChip(key, label, color) {
  const cnt = key === null ? PLACES.filter(p => p.map).length : catCount(key);
  const b = document.createElement('button');
  b.className = 'chip' + (activeCat === key ? ' on' : '');
  if (activeCat === key && color) { b.style.background = color; b.style.color = '#fff'; b.style.borderColor = color; }
  b.innerHTML = (color ? `<span class="dot" style="background:${activeCat === key ? '#fff' : color}"></span>` : '') + esc(label) + ` <span class="cnt">${cnt}</span>`;
  b.onclick = () => { activeCat = key; listLimit = 60; renderChips(); renderMarkers(); renderList(); setSheet('half'); };
  return b;
}

/* ---------- 바텀시트 목록 ---------- */
function sortPlaces(a, b) {
  return (b.en - a.en) || ((b.ph.length > 0) - (a.ph.length > 0)) || ((b.rv || 0) - (a.rv || 0));
}
function cardHTML(p) {
  const thumb = p.ph[0] ? `<img class="thumb" loading="lazy" src="${picSrc(p.ph[0])}" alt="">` : `<div class="thumb skeleton"></div>`;
  return `<div class="pcard">${thumb}<div class="meta">
    <div class="nm">${esc(p.n)}${p.x ? ' <span class="tag-closed">폐업</span>' : ''}</div>
    <div class="ct"><span class="dot" style="background:${catColor(p.c)}"></span>${esc(p.nc || catLabel(p.c))}${p.sc ? ` · <span class="score">★${p.sc}</span>` : ''}${userLoc ? ` · <span class="dist">${fmtDist(distTo(p))}</span>` : ''}</div>
    ${p.mc ? `<div class="mc">${esc(p.mc)}</div>` : `<div class="rg">${esc(p.rg)}</div>`}
  </div></div>`;
}
function distTo(p) { return userLoc ? haversine(userLoc.la, userLoc.lo, p.la, p.lo) : 0; }
function renderList() {
  const body = $('#sheet-body');
  const vis = visiblePlaces().slice();
  vis.sort((userLoc && sortMode === 'near') ? (a, b) => distTo(a) - distTo(b) : sortPlaces);
  const shown = vis.slice(0, listLimit);
  const toggle = userLoc ? `<span class="sortrow"><button class="sortbtn${sortMode === 'near' ? ' on' : ''}" data-s="near">가까운 순</button><button class="sortbtn${sortMode === 'reco' ? ' on' : ''}" data-s="reco">추천 순</button></span>` : '';
  let html = `<div class="list-head"><b>${esc(activeCat ? catLabel(activeCat) : '전체')}</b><span>${vis.length}곳${searchQ ? ` · "${esc(searchQ)}"` : ''}</span>${toggle}</div>`;
  html += shown.map(cardHTML).join('<div class="divider"></div>');
  if (vis.length > listLimit) html += `<button id="more" class="act" style="margin-top:14px">더 보기 (${vis.length - listLimit}곳)</button>`;
  if (!vis.length) html += `<p style="color:var(--ink-2);text-align:center;padding:30px 0">표시할 장소가 없어요.</p>`;
  body.innerHTML = html; body.scrollTop = 0;
  $$('.pcard', body).forEach((el, i) => el.onclick = () => openDetail(shown[i]));
  $$('.sortbtn', body).forEach(b => b.onclick = () => { sortMode = b.dataset.s; listLimit = 60; renderList(); });
  const more = $('#more', body); if (more) more.onclick = () => { listLimit += 60; renderList(); };
}

/* ---------- 장소 상세 ---------- */
function openDetail(p) {
  map.setView([p.la, p.lo], Math.max(map.getZoom(), 14), { animate: true });
  highlight(p);
  const body = $('#sheet-body');
  const carousel = p.ph.length
    ? `<div class="carousel"><div class="carousel-track">${p.ph.map(u => `<img loading="lazy" src="${picSrc(u)}" alt="">`).join('')}</div><div class="carousel-count">${p.ph.length}장</div></div>`
    : `<div class="carousel"><div class="carousel-track"><div style="width:100%;display:flex;align-items:center;justify-content:center;color:var(--ink-3)">사진 준비중</div></div></div>`;
  const kw = (p.kw && p.kw.length) ? `<div class="kw-row">${p.kw.map(k => `<span class="kw">#${esc(k)}</span>`).join('')}</div>` : '';
  const menus = (p.mn && p.mn.length) ? `<div class="sec-title">대표 메뉴</div>` + p.mn.map(m => `<div class="menu-row"><span>${esc(m.n)}</span><span class="pr">${esc(m.p || '')}</span></div>`).join('') : '';
  body.innerHTML = `<div class="detail">
    ${carousel}
    <h2>${esc(p.n)}${p.x ? ' <span class="tag-closed">폐업</span>' : ''}</h2>
    <div class="sub">
      <span class="badge"><span class="dot" style="background:${catColor(p.c)}"></span>${esc(p.nc || catLabel(p.c))}</span>
      ${p.sc ? `<span class="score">★ ${p.sc}</span>` : ''}${p.rv ? `<span>리뷰 ${fmtN(p.rv)}</span>` : ''}
    </div>
    <div class="sub"><span>📍 ${esc(p.rg)}</span>${(p.f && p.f.filter(Boolean).length) ? `<span>· 폴더: ${esc(p.f.filter(Boolean).join(', '))}</span>` : ''}</div>
    ${p.mc ? `<div class="micro">${esc(p.mc)}</div>` : ''}
    ${kw}
    ${p.memo ? `<div class="sec-title">내 메모</div><div class="micro">${esc(p.memo)}</div>` : ''}
    ${menus}
    <div class="actions">
      <button class="act primary" id="d-naver">네이버에서 열기</button>
      <button class="act" id="d-sim">비슷한 곳</button>
    </div>
  </div>`;
  setSheet('full');
  const nv = $('#d-naver'); if (nv) nv.onclick = () => window.open(`https://map.naver.com/p/entry/place/${p.id}`, '_blank');
  const sim = $('#d-sim'); if (sim) sim.onclick = () => openRecommend(`'${p.n}'(${p.rg})와 비슷한 분위기의 장소로 코스 짜줘`);
  if (p.ph.length > 1) {
    const track = $('.carousel-track', body), wrap = document.createElement('div');
    wrap.className = 'carousel-dots';
    const N = Math.min(p.ph.length, 10);
    for (let i = 0; i < N; i++) { const d = document.createElement('i'); if (i === 0) d.className = 'on'; wrap.appendChild(d); }
    $('.carousel', body).appendChild(wrap);
    track.addEventListener('scroll', () => {
      const idx = Math.min(Math.round(track.scrollLeft / track.clientWidth), N - 1);
      $$('.carousel-dots i', body).forEach((d, i) => d.classList.toggle('on', i === idx));
    });
  }
}

/* ---------- 바텀시트 동작 ---------- */
const SORDER = ['peek', 'half', 'full']; let sIdx = 0;
function setSheet(state) {
  sIdx = Math.max(0, SORDER.indexOf(state));
  const s = $('#sheet'); s.classList.remove('peek', 'half', 'full'); s.classList.add(state);
  const fab = $('#fab'); if (fab) fab.style.display = (state === 'peek') ? 'flex' : 'none';
}
function initSheet() {
  setSheet('peek');
  const handle = $('#sheet-handle'); let sy = 0;
  const go = i => setSheet(SORDER[Math.max(0, Math.min(2, i))]);
  handle.addEventListener('pointerdown', e => { sy = e.clientY; });
  handle.addEventListener('pointerup', e => {
    const dy = e.clientY - sy;
    if (Math.abs(dy) < 10) go((sIdx + 1) % 3); else go(dy < 0 ? sIdx + 1 : sIdx - 1);
  });
}

/* ---------- 검색 ---------- */
function initSearch() {
  const bar = $('#searchbar'), input = $('#search-input');
  $('#btn-search').onclick = () => { bar.hidden = false; input.focus(); };
  $('#search-close').onclick = () => { bar.hidden = true; input.value = ''; searchQ = ''; renderMarkers(); renderList(); };
  input.oninput = () => { searchQ = input.value.trim(); listLimit = 60; renderMarkers(); renderList(); setSheet('half'); };
}

/* ---------- 갤러리 ---------- */
let galleryList = [], galleryShown = 0, galleryObserver = null;
function initGallery() {
  $('#btn-view').onclick = openGallery;
  $('#gallery-close').onclick = () => { $('#gallery').hidden = true; if (galleryObserver) galleryObserver.disconnect(); };
}
function openGallery() {
  galleryList = visiblePlaces().filter(p => p.ph.length).sort(sortPlaces);
  galleryShown = 0;
  $('#gallery-title').textContent = `갤러리 · ${galleryList.length}곳`;
  const grid = $('#gallery-grid');
  grid.innerHTML = '';
  $('#gallery').hidden = false;
  if (!galleryList.length) { grid.innerHTML = `<p style="padding:30px;color:var(--ink-2)">사진이 있는 장소가 아직 없어요.</p>`; return; }
  renderGalleryChunk();
}
function renderGalleryChunk() {
  const grid = $('#gallery-grid'), CHUNK = 30;
  const slice = galleryList.slice(galleryShown, galleryShown + CHUNK);
  const old = document.getElementById('gallery-sentinel'); if (old) old.remove();
  const frag = document.createDocumentFragment();
  slice.forEach((p, i) => {
    const idx = galleryShown + i;
    const d = document.createElement('div');
    d.className = 'gcard';
    d.innerHTML = `<img loading="lazy" decoding="async" src="${picSrc(p.ph[0])}" alt=""><div class="gname">${esc(p.n)}</div>`;
    d.onclick = () => { $('#gallery').hidden = true; openDetail(galleryList[idx]); };
    frag.appendChild(d);
  });
  grid.appendChild(frag);
  galleryShown += slice.length;
  if (galleryShown < galleryList.length) {
    const s = document.createElement('div');
    s.id = 'gallery-sentinel'; s.style.cssText = 'grid-column:1/-1;height:1px';
    grid.appendChild(s);
    if (galleryObserver) galleryObserver.disconnect();
    galleryObserver = new IntersectionObserver(es => { if (es[0].isIntersecting) renderGalleryChunk(); }, { root: grid, rootMargin: '400px' });
    galleryObserver.observe(s);
  }
}

/* ---------- AI 추천 코스 ---------- */
const EXAMPLES = [
  '오늘 부산인데 대게 먹고 바다 보이는 카페 가고 싶어',
  '평일 저녁 8시, 늦게까지 하고 룸 있는 식당',
  '용인에서 분위기 좋은 디저트 카페 코스',
  '제주에서 빵지순례 하고 싶어'
];
function initRecommend() {
  $('#fab').onclick = () => openRecommend('');
  $('#recommend-close').onclick = () => { $('#recommend').hidden = true; };
  const ex = $('#recommend-examples'); ex.innerHTML = EXAMPLES.map(e => `<button class="ex">${esc(e)}</button>`).join('');
  $$('.ex', ex).forEach(b => b.onclick = () => { $('#recommend-input').value = b.textContent; runRecommend(); });
  $('#recommend-go').onclick = runRecommend;
}
function openRecommend(prefill) {
  $('#recommend').hidden = false;
  if (prefill) $('#recommend-input').value = prefill;
  $('#recommend-result').innerHTML = '';
  if (prefill) runRecommend();
}
async function runRecommend() {
  const q = $('#recommend-input').value.trim(); if (!q) return;
  const res = $('#recommend-result');
  res.innerHTML = '<div class="skeleton" style="height:90px;border-radius:14px"></div>';
  let course = null;
  if (C.AI_ENDPOINT) {
    try {
      const ranked = candidatesFor(q).ranked;
      const cand = (ranked.length ? ranked : PLACES.filter(p => p.map && !p.x)).slice(0, 80).map(slim);
      const data = await fetch(C.AI_ENDPOINT, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q, candidates: cand })
      }).then(r => r.json());
      if (data && Array.isArray(data.stops) && data.stops.length) {
        const byId = {}; PLACES.forEach(p => byId[String(p.id)] = p);
        const stops = data.stops.map(s => ({ p: byId[String(s.id)], why: s.why || '' })).filter(s => s.p);
        if (stops.length) course = { note: data.note || 'AI 추천 코스', stops };
      }
    } catch (e) { /* 폴백 */ }
  }
  if (!course) course = heuristicCourse(q);
  renderCourse(course, res);
}
function slim(p) { return { id: p.id, n: p.n, c: p.c, nc: p.nc, rg: p.rg, kw: p.kw, sc: p.sc }; }
function candidatesFor(q) {
  let pool = PLACES.filter(p => p.map && !p.x);
  const sidos = [...new Set(PLACES.map(p => p.sido).filter(Boolean))];
  const gus = [...new Set(PLACES.map(p => p.gu).filter(Boolean))];
  const norm = r => r.replace(/(특별자치도|특별자치시|광역시|특별시|자치시|자치구|시|군|구|도)$/, '');
  const region = [...gus, ...sidos].find(r => r && (q.includes(r) || (norm(r).length >= 2 && q.includes(norm(r)))));
  if (region) pool = pool.filter(p => p.rg.includes(region));
  const FOOD = ['한식', '고기', '일식', '중식', '양식'];
  const wants = [];
  const RULES = [
    [/대게|회|해물|해산물|물회|조개|굴|랍스터|초밥|스시|일식|돈카츠|라멘/, ['일식'], '바다'],
    [/고기|구이|삼겹|갈비|한우|곱창|막창|스테이크|족발|보쌈|오리|장어/, ['고기'], null],
    [/중식|짜장|짬뽕|마라|탕수|양꼬치|딤섬/, ['중식'], null],
    [/파스타|피자|양식|이탈리|버거|햄버거|멕시|쌀국수|베트남|태국/, ['양식'], null],
    [/한식|국밥|백반|찌개|냉면|칼국수|분식|떡볶이|김밥|치킨|한정식|찜|탕/, ['한식'], null],
    [/맛집|밥|먹|식당|점심|저녁|식사|회식|배고/, FOOD, null],
    [/카페|커피|디저트|빵|베이커리|케이크|브런치/, ['카페'], null],
    [/술|바|와인|칵테일|포차|맥주|하이볼|이자카야|호프|위스키/, ['술집바'], null],
    [/미술관|전시|박물관|문화|갤러리|공연|영화|공원|체험|서점|책방/, ['문화여가'], null],
    [/바다|오션|뷰|풍경|노을|호수/, null, '바다뷰'],
    [/룸|프라이빗|단체/, null, '룸'],
    [/늦게|늦은|밤|24시|새벽|마감/, null, '24시'],
    [/숙박|호텔|펜션|글램핑|캠핑|산|관광|여행|명소|드라이브|온천|휴양/, ['숙박여행'], null]
  ];
  RULES.forEach(([re, cats, kw]) => { if (re.test(q)) wants.push({ cats, kw }); });
  if (!wants.length) { wants.push({ cats: FOOD, kw: null }, { cats: ['카페'], kw: null }); }
  const score = p => {
    let s = 0;
    wants.forEach(w => { if (w.cats && w.cats.includes(p.c)) s += 5; if (w.kw && p.kw.includes(w.kw)) s += 4; });
    if (p.ph.length) s += 1.5;
    if (p.sc) s += Math.min(2, p.sc - 3);
    s += Math.min(1.5, (p.rv || 0) / 2000);
    return s;
  };
  const ranked = pool.map(p => ({ p, s: score(p) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.p);
  return { region, ranked };
}
function heuristicCourse(q) {
  const { region, ranked } = candidatesFor(q);
  const pick = [], used = {};
  for (const p of ranked) {
    if (pick.length >= 4) break;
    if ((used[p.c] || 0) >= 2) continue;
    used[p.c] = (used[p.c] || 0) + 1; pick.push(p);
  }
  const orank = { 한식: 0, 고기: 0, 일식: 0, 중식: 0, 양식: 0, 술집바: 1, 카페: 2, 문화여가: 3, 숙박여행: 4, 생활: 5, 주거: 6 };
  pick.sort((a, b) => (orank[a.c] ?? 9) - (orank[b.c] ?? 9));
  return { note: region ? `${region} 중심 추천` : '전체에서 추천', stops: pick.map(p => ({ p, why: p.mc || '' })) };
}
function renderCourse(course, res) {
  if (!course || !course.stops || !course.stops.length) {
    res.innerHTML = '<p style="color:var(--ink-2);padding:10px 0">조건에 맞는 저장 장소를 못 찾았어요. 지역이나 종류를 바꿔서 적어보세요.</p>';
    return;
  }
  const s = course.stops;
  res.innerHTML = `<div class="sec-title">추천 코스 · ${esc(course.note || '')}</div>` +
    s.map((it, i) => { const p = it.p; return `<div class="course-stop">
      <div class="course-col"><div class="num">${i + 1}</div>${i < s.length - 1 ? '<div class="course-line"></div>' : ''}</div>
      <div class="pcard" style="flex:1">${p.ph[0] ? `<img class="thumb" loading="lazy" src="${picSrc(p.ph[0])}">` : '<div class="thumb skeleton"></div>'}
        <div class="meta"><div class="nm">${esc(p.n)}</div>
        <div class="ct"><span class="dot" style="background:${catColor(p.c)}"></span>${esc(p.nc || catLabel(p.c))}</div>
        <div class="mc">${esc(it.why || p.rg)}</div></div></div></div>`; }).join('');
  $$('.pcard', res).forEach((el, i) => el.onclick = () => { $('#recommend').hidden = true; openDetail(s[i].p); });
  plotCourse(s.map(it => it.p));
}
function plotCourse(stops) {
  if (window._courseLayer) map.removeLayer(window._courseLayer);
  const g = L.layerGroup();
  const latlngs = stops.map(p => [p.la, p.lo]);
  L.polyline(latlngs, { color: '#F2542D', weight: 3, dashArray: '6 7', opacity: .85 }).addTo(g);
  stops.forEach((p, i) => L.marker([p.la, p.lo], {
    icon: L.divIcon({ html: `<div class="cluster" style="width:30px;height:30px;background:var(--brand)">${i + 1}</div>`, className: '', iconSize: [30, 30] })
  }).addTo(g));
  g.addTo(map); window._courseLayer = g;
  if (latlngs.length > 1) map.fitBounds(latlngs, { padding: [70, 70], maxZoom: 15 });
  else if (latlngs.length) map.setView(latlngs[0], 14);
}

/* ---------- 위치 기반 추천 ---------- */
function haversine(la1, lo1, la2, lo2) {
  const R = 6371000, t = Math.PI / 180;
  const d1 = (la2 - la1) * t, d2 = (lo2 - lo1) * t;
  const a = Math.sin(d1 / 2) ** 2 + Math.cos(la1 * t) * Math.cos(la2 * t) * Math.sin(d2 / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const fmtDist = m => m < 1000 ? Math.round(m / 10) * 10 + 'm' : (m / 1000).toFixed(1) + 'km';
function initNearby() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: la, longitude: lo } = pos.coords;
    userLoc = { la, lo }; sortMode = 'near'; renderList();
    const cand = PLACES.filter(p => p.map && !p.x).map(p => ({ p, d: haversine(la, lo, p.la, p.lo) })).sort((a, b) => a.d - b.d);
    const near = cand.find(c => c.p.ph.length && c.d < 30000) || (cand[0] && cand[0].d < 30000 ? cand[0] : null);
    if (near) {
      $('#nearby-text').innerHTML = `근처 ${fmtDist(near.d)} · <b>${esc(near.p.n)}</b> · ${esc(near.p.nc || catLabel(near.p.c))}`;
      const n = $('#nearby'); n.hidden = false;
      $('#nearby-close').onclick = ev => { ev.stopPropagation(); n.hidden = true; };
      $('#nearby-text').onclick = () => openDetail(near.p);
    }
  }, () => {}, { timeout: 8000, maximumAge: 600000 });
}

document.addEventListener('DOMContentLoaded', initGate);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
})();
