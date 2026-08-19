/* ============== 하영의 지도 — 앱 로직 ============== */
(function () {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const C = window.CONFIG;
const catMap = Object.fromEntries(C.CATS.map(c => [c.k, c]));
const catColor = k => (catMap[k] && catMap[k].color) || '#99A7B6';
const catLabel = k => (catMap[k] && (catMap[k].label || catMap[k].k)) || k;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const fmtN = n => (n == null ? '' : Number(n).toLocaleString('ko-KR'));
const LITE = /[?&]lite\b/.test(location.search);
const LITE_SRC = 'data:image/svg+xml;charset=utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%224%22 height=%223%22%3E%3C/svg%3E';
const picSrc = u => LITE ? LITE_SRC : u;

let mapBounds = null;
let PLACES = [], META = {}, map, clusterGroup, selLayer, activeCat = null, activeSub = null, activeRegion = null, searchQ = '', listLimit = 60, userLoc = null, sortMode = 'reco';

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
    const [p, m, ls] = await Promise.all([
      fetch('./data/places.json', { cache: 'no-store' }).then(r => r.json()),
      fetch('./data/meta.json', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
      fetch('./data/lists.json', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ lists: [] }))
    ]);
    PLACES = p; META = m || {}; loadCurated(ls);
  } catch (e) { console.error('데이터 로드 실패', e); PLACES = []; }
  loadStore();
  initMap(); renderChips(); renderMarkers(); renderList();
  initSheet(); initSearch(); initLocate(); initRegion(); initTheme(); initMine(); initRecommend(); initNearby(); initGuide(); initSync(); initResponsive();
  applyScreenParam();
}

/* ---------- 반응형: 폭이 바뀌면 지도 크기 재계산 ---------- */
function invalidateMaps() {
  try { if (map) map.invalidateSize(); } catch (e) {}
  try { if (courseMap) courseMap.invalidateSize(); } catch (e) {}
}
function initResponsive() {
  let t;
  const on = () => { clearTimeout(t); t = setTimeout(invalidateMaps, 160); };
  window.addEventListener('resize', on);
  window.addEventListener('orientationchange', on);
  // 모바일<->데스크톱 전환 시에는 시트 상태도 기본으로 되돌린다
  const mqChange = () => { setSheet(isDesktop() ? 'half' : 'peek'); setTimeout(invalidateMaps, 220); };
  if (DESKTOP_MQ.addEventListener) DESKTOP_MQ.addEventListener('change', mqChange);
  else if (DESKTOP_MQ.addListener) DESKTOP_MQ.addListener(mqChange);
}

/* ---------- 화면 딥링크 (?screen=) — 목업 카탈로그/스크린샷용 ---------- */
const SCREENS = ['home','list','list-full','detail','region','theme','mine','guide','search','course','course-result'];
function applyScreenParam() {
  const m = /[?&]screen=([\w-]+)/.exec(location.search);
  if (!m) return;
  const key = m[1];
  const pick = () => PLACES.find(p => p.map && p.ph.length && p.mc) || PLACES.find(p => p.map);
  setTimeout(() => {
    try {
      if (key === 'list') setSheet('half');
      else if (key === 'list-full') setSheet('full');
      else if (key === 'detail') { const p = pick(); if (p) openDetail(p); }
      else if (key === 'region') openRegion();
      else if (key === 'theme') openTheme();
      else if (key === 'mine') openMine();
      else if (key === 'guide') openGuide();
      else if (key === 'search') { $('#btn-search').click(); $('#search-input').value = '베이커리'; $('#search-input').dispatchEvent(new Event('input')); }
      else if (key === 'course') openCourseInput('');
      else if (key === 'course-result') openCourseInput('강릉에서 바다 보이는 카페랑 밥집');
    } catch (e) { console.warn('screen param 처리 실패', e); }
  }, 350);
}

/* ---------- 지도 ---------- */
function initMap() {
  const dark = matchMedia('(prefers-color-scheme:dark)').matches;
  map = L.map('map', { zoomControl: false, attributionControl: true, tap: true }).setView(C.CENTER, C.ZOOM);
  L.tileLayer(dark ? C.TILE_DARK : C.TILE_LIGHT, { attribution: C.TILE_ATTR, subdomains: 'abcd', maxZoom: 19, detectRetina: true }).addTo(map);
  clusterGroup = L.markerClusterGroup({ maxClusterRadius: 48, showCoverageOnHover: false, iconCreateFunction: clusterIcon });
  map.addLayer(clusterGroup);
  selLayer = L.layerGroup().addTo(map);
  setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 350);
}
function highlight(p) {
  if (!selLayer) return;
  selLayer.clearLayers();
  L.marker([p.la, p.lo], {
    zIndexOffset: 2000,
    icon: L.divIcon({ html: `<div class="mk mk-sel" style="background:${catColor(p.c1)}"></div>`, className: '', iconSize: [38, 38], iconAnchor: [19, 36] })
  }).addTo(selLayer);
}
// 클러스터를 "동네 이름 + 개수" 버블로 (시안 1b). 가장 많은 동/구 이름과 카테고리 색을 씀.
function topOf(arr, key) {
  const m = {};
  arr.forEach(v => { const k = v[key]; if (k) m[k] = (m[k] || 0) + 1; });
  let best = null, bn = 0;
  Object.keys(m).forEach(k => { if (m[k] > bn) { bn = m[k]; best = k; } });
  return best;
}
function clusterIcon(cluster) {
  const n = cluster.getChildCount();
  const ps = cluster.getAllChildMarkers().map(m => m.__p).filter(Boolean);
  const label = topOf(ps, 'dong') || shortRg(topOf(ps, 'gu') || '') || shortRg(topOf(ps, 'sido') || '') || '저장';
  const col = catColor(topOf(ps, 'c1'));
  const w = Math.min(180, 46 + String(label).length * 13 + String(n).length * 9);
  return L.divIcon({
    html: `<div class="dongpill"><span class="d" style="background:${col}"></span>${esc(label)} ${n}</div>`,
    className: '', iconSize: [w, 36], iconAnchor: [w / 2, 18]
  });
}
function markerFor(p) {
  const m = L.marker([p.la, p.lo], {
    icon: L.divIcon({ html: `<div class="mk" style="background:${catColor(p.c1)}"></div>`, className: '', iconSize: [26, 26], iconAnchor: [13, 24] })
  });
  m.__p = p;
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
function matchRegion(p) {
  if (!activeRegion) return true;
  if (activeRegion.sido && p.sido !== activeRegion.sido) return false;
  if (activeRegion.gu && p.gu !== activeRegion.gu) return false;
  if (activeRegion.dong && p.dong !== activeRegion.dong) return false;
  return true;
}
function basePool() { return (activeMine && activeMine.type === 'curated') ? curatedMembers(activeMine.id) : PLACES; }
function matchBounds(p) { return !mapBounds || mapBounds.contains([p.la, p.lo]); }
function visiblePlaces() {
  return basePool().filter(p => p.map && (!activeCat || p.c1 === activeCat) && (!activeSub || p.c2 === activeSub) && matchRegion(p) && matchMine(p) && matchSearch(p) && matchBounds(p));
}
function renderMarkers() {
  if (!clusterGroup) return;
  clusterGroup.clearLayers();
  visiblePlaces().forEach(p => clusterGroup.addLayer(markerFor(p)));
}

/* ---------- 카테고리 칩 ---------- */
function catCount(k) { return PLACES.filter(p => p.c1 === k && p.map).length; }
// 상단은 지역 · 테마 · 내 기록 3개만. 세부 선택은 각자 드릴다운 시트에서.
function renderChips() {
  const el = $('#chips'); el.innerHTML = '';
  const row = document.createElement('div'); row.className = 'chiprow';
  row.appendChild(makeRegionChip());
  row.appendChild(makeCatChip());
  row.appendChild(makeMineChip());
  el.appendChild(row);
}
function catChipLabel() { return activeSub || (activeCat ? catLabel(activeCat) : '테마'); }
function makeCatChip() {
  const on = !!activeCat;
  const b = document.createElement('button');
  b.className = 'chip cat-chip' + (on ? ' on' : '');
  const dot = on ? `<span class="dot" style="background:${catColor(activeCat)}"></span>`
    : `<svg viewBox="0 0 24 24" class="rg-ic"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>`;
  b.innerHTML = dot + esc(catChipLabel()) + (on ? ' <span class="rg-x">×</span>' : '');
  b.onclick = e => { if (on && e.target.closest('.rg-x')) { applyCat(null, null); return; } openTheme(); };
  return b;
}

/* ---------- 바텀시트 목록 ---------- */
function sortPlaces(a, b) {
  return (b.en - a.en) || ((b.ph.length > 0) - (a.ph.length > 0)) || ((b.rv || 0) - (a.rv || 0));
}
// 리스트 행 (시안 1b): 썸네일 66 / 이름+카테고리 태그 / 한 줄 소개 / ★·동·거리
function cardHTML(p) {
  const thumb = p.ph[0] ? `<img class="thumb" loading="lazy" decoding="async" src="${picSrc(p.ph[0])}" alt="">` : `<div class="thumb skeleton"></div>`;
  const col = catColor(p.c1);
  const tag = p.c2 || catLabel(p.c1);
  const bits = [];
  if (p.sc) bits.push(`<span class="score">★ ${p.sc}</span>`);
  const area = p.dong || shortRg(p.gu) || shortRg(p.sido);
  if (area) bits.push(esc(area));
  if (userLoc) bits.push(`<span class="dist">${fmtDist(distTo(p))}</span>`);
  return `<div class="pcard${isVisited(p.id) ? ' visited' : ''}">${thumb}<div class="meta">
    <div class="nmrow">
      <span class="nm">${isVisited(p.id) ? '<span class="vchk">✓</span> ' : ''}${esc(p.n)}</span>
      <span class="ctag" style="color:${col};background:${col}1F">${esc(tag)}</span>
      ${p.x ? '<span class="tag-closed">폐업</span>' : ''}
    </div>
    ${p.mc ? `<div class="mc">${esc(p.mc)}</div>` : ''}
    <div class="ct">${bits.join(' · ')}</div>
  </div></div>`;
}
function distTo(p) { return userLoc ? haversine(userLoc.la, userLoc.lo, p.la, p.lo) : 0; }
// 시트 헤더 지역명: 활성 지역 필터 > 보이는 장소들의 최빈 시군구 > 전체
function regionHeading(vis) {
  if (activeRegion) return activeRegion.dong || shortRg(activeRegion.gu) || shortRg(activeRegion.sido) || '전국';
  if (mapBounds) return '이 지도 범위';
  if (activeCat) return catChipLabel();
  const gu = topOf(vis, 'gu');
  if (gu && vis.filter(p => p.gu === gu).length > vis.length * 0.4) return shortRg(gu);
  const sido = topOf(vis, 'sido');
  if (sido && vis.filter(p => p.sido === sido).length > vis.length * 0.4) return shortRg(sido);
  return '전국';
}
function renderList() {
  const body = $('#sheet-body');
  const vis = visiblePlaces().slice();
  vis.sort((userLoc && sortMode === 'near') ? (a, b) => distTo(a) - distTo(b) : sortPlaces);
  const shown = vis.slice(0, listLimit);
  const head = regionHeading(vis);
  let html = `<div class="list-head">
      <span class="lh-l"><b>${esc(head)}</b><span>저장 ${fmtN(vis.length)}곳</span></span>
      <button class="list-refresh" id="lst-refresh">${mapBounds ? '전체 보기' : '지도 새로고침'}</button>
    </div>`;
  if (userLoc) html += `<div class="list-head" style="padding-top:0"><span class="sortrow"><button class="sortbtn${sortMode === 'near' ? ' on' : ''}" data-s="near">가까운 순</button><button class="sortbtn${sortMode === 'reco' ? ' on' : ''}" data-s="reco">추천 순</button></span></div>`;
  html += shown.map(cardHTML).join('<div class="divider"></div>');
  if (vis.length > listLimit) html += `<button id="more" class="act" style="margin-top:14px">더 보기 (${vis.length - listLimit}곳)</button>`;
  if (!vis.length) html += `<div style="text-align:center;padding:44px 0;color:var(--ink-3)"><span class="pin" style="width:34px;height:34px;opacity:.35"></span><p style="margin:14px 0 0;font-size:14px;color:var(--ink-2)">조건에 맞는 장소가 없어요</p><p style="margin:4px 0 0;font-size:12.5px">필터를 바꾸거나 지역을 넓혀보세요</p></div>`;
  body.innerHTML = html; body.scrollTop = 0;
  $$('.pcard', body).forEach((el, i) => el.onclick = () => openDetail(shown[i]));
  $$('.sortbtn', body).forEach(b => b.onclick = () => { sortMode = b.dataset.s; listLimit = 60; renderList(); });
  const more = $('#more', body); if (more) more.onclick = () => { listLimit += 60; renderList(); };
  const rf = $('#lst-refresh', body);
  if (rf) rf.onclick = () => {
    mapBounds = mapBounds ? null : map.getBounds();
    listLimit = 60; renderMarkers(); renderList();
  };
  updateSheetTab();
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
    <button class="detail-close" id="d-close" aria-label="상세 닫기">✕</button>
    ${carousel}
    <h2>${esc(p.n)}${p.x ? ' <span class="tag-closed">폐업</span>' : ''}</h2>
    <div class="sub">
      <span class="badge"><span class="dot" style="background:${catColor(p.c1)}"></span>${esc(p.nc || catLabel(p.c1))}</span>
      ${p.sc ? `<span class="score">★ ${p.sc}</span>` : ''}${p.rv ? `<span>리뷰 ${fmtN(p.rv)}</span>` : ''}
    </div>
    <div class="sub"><span><span class="pin sm" style="vertical-align:-2px;margin-right:4px"></span>${esc(p.rg)}</span>${(p.f && p.f.filter(Boolean).length) ? `<span>· 폴더: ${esc(p.f.filter(Boolean).join(', '))}</span>` : ''}</div>
    ${p.mc ? `<div class="micro">${esc(p.mc)}</div>` : ''}
    ${kw}
    ${p.memo ? `<div class="sec-title">네이버 메모</div><div class="micro">${esc(p.memo)}</div>` : ''}
    ${detailMineHTML(p)}
    ${menus}
    <button class="act" id="d-sim" style="width:100%;margin-bottom:10px;background:var(--surface-2)">이런 곳 더 추천받기</button>
    <div class="actions">
      <button class="act primary" id="d-naver">네이버</button>
      <button class="act" id="d-dir">길찾기</button>
      ${p.tel ? '<button class="act" id="d-tel">전화</button>' : ''}
      <button class="act" id="d-share">공유</button>
    </div>
  </div>`;
  setSheet('full');
  const pageUrl = `https://map.naver.com/p/entry/place/${p.id}`;
  const nv = $('#d-naver'); if (nv) nv.onclick = () => window.open(pageUrl, '_blank');
  const dir = $('#d-dir'); if (dir) dir.onclick = () => {
    const t = Date.now();
    location.href = `nmap://route/public?dlat=${p.la}&dlng=${p.lo}&dname=${encodeURIComponent(p.n)}&appname=favplace.pages.dev`;
    setTimeout(() => { if (Date.now() - t < 1600) window.open(pageUrl, '_blank'); }, 1100);
  };
  const tel = $('#d-tel'); if (tel) tel.onclick = () => { location.href = 'tel:' + String(p.tel).replace(/[^0-9+]/g, ''); };
  const sh = $('#d-share'); if (sh) sh.onclick = async () => {
    try { if (navigator.share) await navigator.share({ title: p.n, text: `${p.n} · ${p.rg}`, url: pageUrl }); else { await navigator.clipboard.writeText(pageUrl); alert('링크를 복사했어요'); } } catch (e) {}
  };
  const sim = $('#d-sim'); if (sim) sim.onclick = () => openCourseInput(`'${p.n}'(${p.rg})와 비슷한 분위기의 장소로 코스 짜줘`);
  const dc = $('#d-close', body); if (dc) dc.onclick = closeDetail;
  bindDetailMine(p, body);
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

function closeDetail() {
  if (selLayer) selLayer.clearLayers();
  renderList();
  setSheet('peek');
}

const DESKTOP_MQ = window.matchMedia('(min-width:768px)');
function isDesktop() { return DESKTOP_MQ.matches; }

/* ---------- 바텀시트 동작 (실시간 드래그 + 스냅) ---------- */
// hidden = 시트를 화면 밖으로 완전히 내리고 하단 탭 버튼만 남기는 상태
const SORDER = ['hidden', 'peek', 'half', 'full']; let sIdx = 1;
function setSheet(state) {
  const i = SORDER.indexOf(state); sIdx = i < 0 ? 1 : i;
  const s = $('#sheet'); if (!s) return;
  const cur = SORDER[sIdx], off = cur === 'hidden';
  s.style.transition = ''; s.style.transform = '';
  s.classList.remove('hidden', 'peek', 'half', 'full'); s.classList.add(cur);
  s.setAttribute('aria-hidden', off ? 'true' : 'false');
  document.body.classList.toggle('sheet-off', off);
  document.body.dataset.snap = cur;
  const fab = $('#fab'); if (fab) fab.style.display = (cur === 'peek' || off) ? 'flex' : 'none';
  const lb = $('#btn-locate'); if (lb) lb.style.display = (cur === 'peek' || off) ? 'flex' : 'none';
  const tab = $('#sheet-tab'); if (tab) tab.classList.toggle('on', off);
  updateSheetTab();
}
// 탭 버튼 라벨 = 현재 필터에 걸린 장소 수
function updateSheetTab() {
  const lbl = $('#sheet-tab-label'); if (!lbl) return;
  let n = 0; try { n = visiblePlaces().length; } catch (e) {}
  lbl.textContent = n ? `목록 ${fmtN(n)}곳` : '목록';
}
function initSheet() {
  setSheet(isDesktop() ? 'half' : 'peek');
  const sheet = $('#sheet'), handle = $('#sheet-handle'), body = $('#sheet-body');
  const safeTop = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
  const winH = () => window.innerHeight;
  // 시안 스냅: peek 120px · 기본 452px · 확장(상단 200px 남김)
  const pos = () => ({ hidden: sheet.offsetHeight, peek: sheet.offsetHeight - 120, half: Math.max(0, sheet.offsetHeight - 452), full: Math.max(safeTop(), 200 - (winH() - sheet.offsetHeight)) });
  let pending = false, dragging = false, fromBody = false, startX = 0, startY = 0, baseTY = 0, lastY = 0, lastT = 0, vel = 0;
  // 손잡이 탭 = peek→half→full→peek 순환 (실수로 숨겨지지 않게 hidden은 제외)
  const cycle = () => setSheet(sIdx >= 3 ? 'peek' : SORDER[Math.max(1, sIdx) + 1]);
  function down(e, viaBody) {
    pending = true; dragging = false; fromBody = viaBody;
    startX = e.clientX; startY = e.clientY; baseTY = pos()[SORDER[sIdx]];
    lastY = e.clientY; lastT = e.timeStamp || 0; vel = 0;
  }
  function move(e) {
    if (!pending && !dragging) return;
    const dy = e.clientY - startY, dx = e.clientX - startX;
    if (pending) {
      if (fromBody) {
        if (body.scrollTop > 0) { pending = false; return; }          // 내용 스크롤 중 → 시트는 그대로
        if (dy > 6 && dy > Math.abs(dx)) { dragging = true; pending = false; sheet.style.transition = 'none'; }
        else if (dy < -4 || Math.abs(dx) > 10) { pending = false; return; }
        else return;
      } else {
        if (Math.abs(dy) > 2) { dragging = true; pending = false; sheet.style.transition = 'none'; }
        else return;
      }
    }
    if (!dragging) return;
    e.preventDefault();
    const P = pos();
    const ty = Math.max(P.full, Math.min(P.hidden, baseTY + dy));
    sheet.style.transform = `translateY(${ty}px)`;
    const now = e.timeStamp || 0;
    if (now > lastT) { vel = (e.clientY - lastY) / (now - lastT); lastY = e.clientY; lastT = now; }
  }
  function up(e) {
    if (pending && !dragging) { pending = false; if (!fromBody) cycle(); return; }
    if (!dragging) return;
    dragging = false; sheet.style.transition = '';
    const P = pos(), ty = baseTY + (e.clientY - startY);
    let target;
    // 아래로 세게 튕기면: peek 아래에서 시작했으면 완전히 내림(hidden), 아니면 peek
    if (vel > 0.45) target = (ty > P.peek + 24) ? 'hidden' : 'peek';
    else if (vel < -0.45) target = 'full';
    else {
      const cand = [['full', P.full], ['half', P.half], ['peek', P.peek], ['hidden', P.hidden]];
      cand.sort((a, b) => Math.abs(ty - a[1]) - Math.abs(ty - b[1]));
      target = cand[0][0];
    }
    setSheet(target);
  }
  // ∨ 버튼: 어느 단계에서든 한 번에 완전히 내림 (손잡이 드래그/탭과 겹치지 않게 전파 차단)
  const collapse = $('#sheet-collapse');
  if (collapse) {
    collapse.addEventListener('pointerdown', e => e.stopPropagation());
    collapse.addEventListener('click', e => { e.stopPropagation(); setSheet('hidden'); });
  }
  // 하단 탭 버튼: 다시 올림
  const tab = $('#sheet-tab');
  if (tab) tab.addEventListener('click', () => setSheet('peek'));

  // 768px 이상에서는 시트가 좌측 고정 패널이라 드래그 스냅을 붙이지 않는다
  if (!isDesktop()) {
    handle.addEventListener('pointerdown', e => down(e, false));
    body.addEventListener('pointerdown', e => down(e, true));
  }
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', () => { pending = false; if (dragging) { dragging = false; setSheet(SORDER[sIdx]); } });
}

/* ---------- 검색 ---------- */
function syncSearchLabel() {
  const lb = $('#search-label'), f = $('#btn-search');
  if (!lb) return;
  lb.textContent = searchQ || '어디로 가볼까요';
  f.classList.toggle('has', !!searchQ);
}
function initSearch() {
  const bar = $('#searchbar'), input = $('#search-input');
  $('#btn-search').onclick = () => { bar.hidden = false; input.value = searchQ; input.focus(); };
  $('#search-close').onclick = () => { bar.hidden = true; input.value = ''; searchQ = ''; syncSearchLabel(); renderMarkers(); renderList(); };
  input.oninput = () => { searchQ = input.value.trim(); listLimit = 60; syncSearchLabel(); renderMarkers(); renderList(); setSheet('half'); };
}

/* ---------- 내 위치 ---------- */
let myLocMarker = null;
function sheetState() { return SORDER[sIdx]; }
function initLocate() {
  const btn = $('#btn-locate'); if (!btn) return;
  btn.onclick = () => {
    if (!navigator.geolocation) { alert('이 기기는 위치를 지원하지 않아요.'); return; }
    btn.classList.add('locating');
    navigator.geolocation.getCurrentPosition(pos => {
      btn.classList.remove('locating'); btn.classList.add('on');
      const { latitude: la, longitude: lo } = pos.coords;
      userLoc = { la, lo }; sortMode = 'near';
      showMyLocation(la, lo);
      map.setView([la, lo], Math.max(map.getZoom(), 14), { animate: true });
      renderList();
      if (sheetState() === 'peek') setSheet('half');
    }, () => {
      btn.classList.remove('locating');
      alert('위치를 가져올 수 없어요. 브라우저 설정에서 위치 권한을 허용해 주세요.');
    }, { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 });
  };
}
function showMyLocation(la, lo) {
  if (!map) return;
  if (myLocMarker) map.removeLayer(myLocMarker);
  myLocMarker = L.marker([la, lo], {
    zIndexOffset: 4000, interactive: false, keyboard: false,
    icon: L.divIcon({ html: '<div class="myloc"></div>', className: 'myloc-wrap', iconSize: [14, 14], iconAnchor: [7, 7] })
  }).addTo(map);
}

/* ---------- 테마 드릴다운 (대분류 > 세부) ---------- */
let themeDrill = '';
function initTheme() {
  const cl = $('#theme-close'); if (cl) cl.onclick = () => { $('#theme').hidden = true; };
}
function openTheme() {
  themeDrill = activeCat || '';
  $('#theme').hidden = false; renderTheme();
}
function renderTheme() {
  const crumb = $('#theme-crumb'), body = $('#theme-body');
  crumb.innerHTML = ''; body.innerHTML = '';
  const steps = [['전체 테마', '']];
  if (themeDrill) steps.push([catLabel(themeDrill), themeDrill]);
  steps.forEach((st, i) => {
    const c = document.createElement('button'); c.className = 'crumb'; c.textContent = st[0];
    c.onclick = () => { themeDrill = st[1]; renderTheme(); };
    crumb.appendChild(c);
    if (i < steps.length - 1) { const sep = document.createElement('span'); sep.className = 'crumb-sep'; sep.textContent = '›'; crumb.appendChild(sep); }
  });
  const hint = document.createElement('p'); hint.className = 'rg-hint';
  hint.textContent = themeDrill ? '세부 종류를 누르면 바로 적용돼요.' : '테마를 누르면 바로 적용돼요. › 를 누르면 세부 종류가 나와요.';
  body.appendChild(hint);
  if (!themeDrill) {
    $('#theme-title').textContent = '테마 선택';
    body.appendChild(rgBtn('전체 보기', PLACES.filter(p => p.map).length, () => applyCat(null, null), null, 'var(--ink-3)'));
    C.CATS.forEach(c => {
      const n = catCount(c.k); if (!n) return;
      const t = (META.tree && META.tree[c.k]) || {};
      const hasSub = Object.keys(t).length >= 1;
      body.appendChild(rgBtn(c.label || c.k, n, () => applyCat(c.k, null),
        hasSub ? () => { themeDrill = c.k; renderTheme(); } : null, c.color));
    });
  } else {
    const c = catMap[themeDrill] || {};
    $('#theme-title').textContent = catLabel(themeDrill);
    body.appendChild(rgBtn(catLabel(themeDrill) + ' 전체', catCount(themeDrill), () => applyCat(themeDrill, null), null, c.color));
    const t = (META.tree && META.tree[themeDrill]) || {};
    Object.keys(t).sort((a, b) => t[b] - t[a]).forEach(s =>
      body.appendChild(rgBtn(s, t[s], () => applyCat(themeDrill, s), null, c.color)));
  }
}
function applyCat(c1, c2) {
  activeCat = c1; activeSub = c2; listLimit = 60;
  $('#theme').hidden = true;
  renderChips(); renderMarkers(); renderList();
  setSheet('half');
}

/* ---------- 지역 드릴다운 (도 > 시군구 > 동) ---------- */
let regionDrill = { sido: '', gu: '' };
function shortRg(s) { return String(s || '').replace('특별자치도', '').replace('특별자치시', '').replace('특별시', '').replace('광역시', ''); }
function regionLabel() { if (!activeRegion) return '지역'; return activeRegion.dong || shortRg(activeRegion.gu) || shortRg(activeRegion.sido) || '지역'; }
function makeRegionChip() {
  const b = document.createElement('button');
  b.className = 'chip region-chip' + (activeRegion ? ' on' : '');
  b.innerHTML = `<svg viewBox="0 0 24 24" class="rg-ic"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>` +
    esc(regionLabel()) + (activeRegion ? ' <span class="rg-x">×</span>' : '');
  b.onclick = e => { if (activeRegion && e.target.closest('.rg-x')) { applyRegion(null); return; } openRegion(); };
  return b;
}
function initRegion() {
  const cl = $('#region-close'); if (cl) cl.onclick = () => { $('#region').hidden = true; };
}
function openRegion() {
  regionDrill = { sido: (activeRegion && activeRegion.sido) || '', gu: (activeRegion && activeRegion.gu) || '' };
  $('#region').hidden = false; renderRegion();
}
function rgBtn(label, count, onApply, onDrill, dotColor) {
  const row = document.createElement('div'); row.className = 'rgrow2';
  const main = document.createElement('button'); main.className = 'rgrow-main';
  main.innerHTML = (dotColor ? `<span class="rgdot" style="background:${dotColor}"></span>` : '') +
    `<span class="rgname">${esc(label)}</span><span class="rgcnt">${count}</span>`;
  main.onclick = onApply; row.appendChild(main);
  if (onDrill) {
    const d = document.createElement('button'); d.className = 'rgdrill'; d.setAttribute('aria-label', label + ' 하위 지역 보기'); d.textContent = '›';
    d.onclick = onDrill; row.appendChild(d);
  }
  return row;
}
function renderRegion() {
  const crumb = $('#region-crumb'), body = $('#region-body');
  const vis = PLACES.filter(p => p.map && p.sido);
  crumb.innerHTML = '';
  const steps = [['전국', 'all']];
  if (regionDrill.sido) steps.push([shortRg(regionDrill.sido), 'sido']);
  if (regionDrill.gu) steps.push([shortRg(regionDrill.gu), 'gu']);
  steps.forEach((st, i) => {
    const c = document.createElement('button'); c.className = 'crumb'; c.textContent = st[0];
    c.onclick = () => { if (st[1] === 'all') regionDrill = { sido: '', gu: '' }; else if (st[1] === 'sido') regionDrill.gu = ''; renderRegion(); };
    crumb.appendChild(c);
    if (i < steps.length - 1) { const sep = document.createElement('span'); sep.className = 'crumb-sep'; sep.textContent = '›'; crumb.appendChild(sep); }
  });
  body.innerHTML = '';
  const hint = document.createElement('p'); hint.className = 'rg-hint'; hint.textContent = '지역을 누르면 지도에 바로 표시돼요. › 를 누르면 더 좁게 볼 수 있어요.'; body.appendChild(hint);
  const group = (arr, key) => { const m = {}; arr.forEach(p => { const k = p[key]; if (k) m[k] = (m[k] || 0) + 1; }); return m; };
  if (!regionDrill.sido) {
    $('#region-title').textContent = '지역 선택 · 도/시';
    body.appendChild(rgBtn('전국 전체', vis.length, () => applyRegion(null), null));
    const m = group(vis, 'sido');
    Object.keys(m).sort((a, b) => m[b] - m[a]).forEach(s => body.appendChild(
      rgBtn(shortRg(s), m[s], () => applyRegion({ sido: s }), () => { regionDrill.sido = s; regionDrill.gu = ''; renderRegion(); })
    ));
  } else if (!regionDrill.gu) {
    $('#region-title').textContent = shortRg(regionDrill.sido);
    const sub = vis.filter(p => p.sido === regionDrill.sido);
    body.appendChild(rgBtn(shortRg(regionDrill.sido) + ' 전체', sub.length, () => applyRegion({ sido: regionDrill.sido }), null));
    const m = group(sub, 'gu');
    Object.keys(m).sort((a, b) => m[b] - m[a]).forEach(g => {
      const hasDong = sub.some(p => p.gu === g && p.dong);
      body.appendChild(rgBtn(shortRg(g), m[g], () => applyRegion({ sido: regionDrill.sido, gu: g }), hasDong ? () => { regionDrill.gu = g; renderRegion(); } : null));
    });
  } else {
    $('#region-title').textContent = shortRg(regionDrill.gu);
    const sub = vis.filter(p => p.sido === regionDrill.sido && p.gu === regionDrill.gu);
    body.appendChild(rgBtn(shortRg(regionDrill.gu) + ' 전체', sub.length, () => applyRegion({ sido: regionDrill.sido, gu: regionDrill.gu }), null));
    const m = group(sub, 'dong');
    Object.keys(m).sort((a, b) => m[b] - m[a]).forEach(d => body.appendChild(
      rgBtn(d, m[d], () => applyRegion({ sido: regionDrill.sido, gu: regionDrill.gu, dong: d }), null)
    ));
    const noDong = sub.filter(p => !p.dong).length;
    if (noDong) { const n = document.createElement('div'); n.className = 'rg-note'; n.textContent = `그 외 ${noDong}곳은 동 정보가 아직 없어요`; body.appendChild(n); }
  }
}
function applyRegion(r) {
  activeRegion = r; mapBounds = null;
  $('#region').hidden = true;
  listLimit = 60;
  renderChips(); renderMarkers(); renderList();
  const vis = visiblePlaces();
  if (vis.length && map) { try { map.fitBounds(L.latLngBounds(vis.map(p => [p.la, p.lo])), { padding: [60, 60], maxZoom: 14 }); } catch (e) {} }
  setSheet('half');
}

/* ---------- 나만의 기록 (방문·메모·리스트) : 기기 저장 ---------- */
const SKEY = 'hymap_store_v1';
let Store = { visited: [], memo: {}, lists: [] };
let activeMine = null;

/* 큐레이션 리스트 (배포 데이터 lists.json — 하영이 준 장소 정보로 채움) */
let CURATED = [], curPool = {};
function normCurPlace(x) {
  const la = +x.la || 0, lo = +x.lo || 0;
  return {
    id: String(x.id != null ? x.id : ('x' + Math.random().toString(36).slice(2))),
    n: x.n || '(이름없음)', la, lo, c1: x.c1 || '명소', c2: x.c2 || '', nc: x.nc || '',
    tel: x.tel || null, sido: x.sido || '', gu: x.gu || '', dong: x.dong || '',
    rg: x.rg || [x.sido, x.gu].filter(Boolean).join(' '), rcode: '', f: [], memo: x.memo || '',
    mc: x.mc || '', sc: x.sc != null ? x.sc : null, rv: x.rv != null ? x.rv : null,
    ph: Array.isArray(x.ph) ? x.ph : [], mn: Array.isArray(x.mn) ? x.mn : [], kw: Array.isArray(x.kw) ? x.kw : [],
    x: 0, en: 0, map: (la && lo) ? 1 : 0, cur: 1
  };
}
function loadCurated(data) {
  CURATED = (data && Array.isArray(data.lists)) ? data.lists : [];
  curPool = {};
  CURATED.forEach(l => { l._inline = (l.places || []).map(normCurPlace); l._inline.forEach(p => { curPool[p.id] = p; }); });
}
function curatedById(id) { return CURATED.find(l => l.id === id); }
function curatedMembers(id) {
  const l = curatedById(id); if (!l) return [];
  const byId = {}; PLACES.forEach(p => byId[String(p.id)] = p);
  const out = [];
  (l.ids || []).forEach(i => { const p = byId[String(i)]; if (p) out.push(p); });
  (l._inline || []).forEach(p => out.push(p));
  return out;
}
function curatedCount(id) { return curatedMembers(id).length; }
function loadStore() {
  try { const s = JSON.parse(localStorage.getItem(SKEY)); if (s) Store = { visited: s.visited || [], memo: s.memo || {}, lists: s.lists || [] }; } catch (e) {}
}
function saveStore() { try { localStorage.setItem(SKEY, JSON.stringify(Store)); } catch (e) {} }
function isVisited(id) { return Store.visited.includes(String(id)); }
function toggleVisited(id) { id = String(id); const i = Store.visited.indexOf(id); if (i < 0) Store.visited.push(id); else Store.visited.splice(i, 1); saveStore(); }
function getMemo(id) { return Store.memo[String(id)] || ''; }
function setMemo(id, t) { id = String(id); t = (t || '').trim(); if (t) Store.memo[id] = t; else delete Store.memo[id]; saveStore(); }
function listById(id) { return Store.lists.find(l => l.id === id); }
function newList(name) { const id = 'L' + Date.now().toString(36) + Math.floor(Math.random() * 900 + 100); Store.lists.push({ id, name: (name || '새 리스트').trim(), ids: [] }); saveStore(); return id; }
function toggleInList(listId, pid) { const l = listById(listId); if (!l) return; pid = String(pid); const i = l.ids.indexOf(pid); if (i < 0) l.ids.push(pid); else l.ids.splice(i, 1); saveStore(); }
function deleteList(id) { Store.lists = Store.lists.filter(l => l.id !== id); if (activeMine && activeMine.type === 'list' && activeMine.id === id) activeMine = null; saveStore(); }
function matchMine(p) {
  if (!activeMine) return true;
  if (activeMine.type === 'visited') return isVisited(p.id);
  if (activeMine.type === 'unvisited') return !isVisited(p.id);
  if (activeMine.type === 'list') { const l = listById(activeMine.id); return !!(l && l.ids.includes(String(p.id))); }
  return true;
}
function mineLabel() {
  if (!activeMine) return '내 기록';
  if (activeMine.type === 'visited') return '가본 곳';
  if (activeMine.type === 'unvisited') return '안 가본 곳';
  if (activeMine.type === 'list') { const l = listById(activeMine.id); return l ? l.name : '리스트'; }
  if (activeMine.type === 'curated') { const l = curatedById(activeMine.id); return l ? l.name : '리스트'; }
  return '내 기록';
}
function makeMineChip() {
  const b = document.createElement('button');
  b.className = 'chip mine-chip' + (activeMine ? ' on' : '');
  b.innerHTML = `<svg viewBox="0 0 24 24" class="rg-ic"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>` +
    esc(mineLabel()) + (activeMine ? ' <span class="rg-x">×</span>' : '');
  b.onclick = e => { if (activeMine && e.target.closest('.rg-x')) { applyMine(null); return; } openMine(); };
  return b;
}
function initMine() { const cl = $('#mine-close'); if (cl) cl.onclick = () => { $('#mine').hidden = true; }; }
function openMine() { $('#mine').hidden = false; renderMine(); }
function renderMine() {
  const body = $('#mine-body'); body.innerHTML = '';
  const allN = PLACES.filter(p => p.map).length, vN = Store.visited.length;
  const quick = [['all', '전체 보기', allN], ['visited', '✓ 가본 곳', vN], ['unvisited', '아직 안 간 곳', allN - vN]];
  quick.forEach(([f, label, n]) => {
    const b = document.createElement('button'); b.className = 'rgrow';
    b.innerHTML = `<span class="rgname">${label}</span><span class="rgcnt">${n}</span>`;
    b.onclick = () => applyMine(f === 'all' ? null : { type: f });
    body.appendChild(b);
  });
  if (CURATED.length) {
    const ct = document.createElement('div'); ct.className = 'sec-title'; ct.style.margin = '20px 4px 8px'; ct.textContent = '큐레이션 리스트'; body.appendChild(ct);
    CURATED.forEach(l => {
      const b = document.createElement('button'); b.className = 'rgrow crow';
      b.innerHTML = `<span class="crow-txt"><span class="rgname">✦ ${esc(l.name)}</span>${l.note ? `<span class="rg-sub">${esc(l.note)}</span>` : ''}</span><span class="rgcnt">${curatedCount(l.id)}</span>`;
      b.onclick = () => applyMine({ type: 'curated', id: l.id });
      body.appendChild(b);
    });
  }
  const t = document.createElement('div'); t.className = 'sec-title'; t.style.margin = '20px 4px 8px'; t.textContent = '내 리스트'; body.appendChild(t);
  if (!Store.lists.length) { const e = document.createElement('div'); e.className = 'rg-note'; e.style.textAlign = 'left'; e.textContent = '아직 리스트가 없어요. 아래에서 만들어보세요.'; body.appendChild(e); }
  Store.lists.forEach(l => {
    const row = document.createElement('div'); row.className = 'listrow';
    const main = document.createElement('button'); main.className = 'listrow-main';
    main.innerHTML = `<span class="rgname">☆ ${esc(l.name)}</span><span class="rgcnt">${l.ids.length}</span>`;
    main.onclick = () => applyMine({ type: 'list', id: l.id });
    const del = document.createElement('button'); del.className = 'listrow-x'; del.setAttribute('aria-label', '리스트 삭제'); del.textContent = '✕';
    del.onclick = () => { if (confirm(`'${l.name}' 리스트를 삭제할까요?\n(리스트만 지워지고 장소는 그대로예요)`)) { deleteList(l.id); renderMine(); renderChips(); renderMarkers(); renderList(); } };
    row.appendChild(main); row.appendChild(del); body.appendChild(row);
  });
  const nl = document.createElement('div'); nl.className = 'lp-new';
  nl.innerHTML = `<input id="mine-new" placeholder="새 리스트 이름" maxlength="24"><button id="mine-add">만들기</button>`;
  body.appendChild(nl);
  $('#mine-add', nl).onclick = () => { const v = ($('#mine-new', nl).value || '').trim(); if (!v) return; newList(v); renderMine(); renderChips(); };
  const io = document.createElement('div'); io.className = 'mine-io';
  io.innerHTML = `<button id="mine-export" class="mine-io-btn">기록 내보내기</button><button id="mine-import" class="mine-io-btn">가져오기</button><input id="mine-file" type="file" accept="application/json,.json" hidden>`;
  body.appendChild(io);
  $('#mine-export', io).onclick = exportStore;
  $('#mine-import', io).onclick = () => $('#mine-file', io).click();
  $('#mine-file', io).onchange = e => { importStore(e.target.files[0]); e.target.value = ''; };
  const note = document.createElement('p'); note.className = 'rg-note'; note.style.cssText = 'text-align:left;margin-top:14px;line-height:1.5';
  note.textContent = '방문·메모·리스트는 이 기기에 저장돼요. 다른 기기로 옮기려면 내보내기로 백업하고 가져오기 하세요.';
  body.appendChild(note);
  appendSyncEntry(body);
}
function applyMine(m) {
  activeMine = m; $('#mine').hidden = true; listLimit = 60;
  renderChips(); renderMarkers(); renderList();
  const vis = visiblePlaces();
  if (vis.length && map) { try { map.fitBounds(L.latLngBounds(vis.map(p => [p.la, p.lo])), { padding: [60, 60], maxZoom: 15 }); } catch (e) {} }
  setSheet('half');
}
function exportStore() {
  try {
    const blob = new Blob([JSON.stringify(Store, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = '내지도_기록_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (e) { alert('내보내기에 실패했어요.'); }
}
function importStore(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    let s; try { s = JSON.parse(r.result); } catch { alert('올바른 백업 파일이 아니에요.'); return; }
    if (!s || typeof s !== 'object') { alert('올바른 백업 파일이 아니에요.'); return; }
    Store.visited = [...new Set([...(Store.visited || []), ...((s.visited || []).map(String))])];
    Store.memo = Object.assign({}, (s.memo || {}), Store.memo);
    (Array.isArray(s.lists) ? s.lists : []).forEach(il => {
      if (!il || !il.name) return;
      let ex = Store.lists.find(l => l.name === il.name);
      if (!ex) { ex = { id: 'L' + Date.now().toString(36) + Math.floor(Math.random() * 900 + 100), name: String(il.name).slice(0, 24), ids: [] }; Store.lists.push(ex); }
      ex.ids = [...new Set([...ex.ids, ...((il.ids || []).map(String))])];
    });
    saveStore(); renderMine(); renderChips(); renderMarkers(); renderList();
    alert('기록을 가져왔어요.');
  };
  r.readAsText(file);
}

/* 상세 시트의 방문/메모/리스트 UI */
function detailMineHTML(p) {
  const vis = isVisited(p.id), memo = getMemo(p.id);
  return `<div class="mine-box">
    <div class="mine-actions">
      <button class="mine-toggle${vis ? ' on' : ''}" id="m-visited">${vis ? '✓ 가봤어요' : '가봤어요'}</button>
      <button class="mine-toggle" id="m-list">☆ 리스트에 추가</button>
    </div>
    <div id="m-listpick" class="listpick" hidden></div>
    <div class="sec-title">내 메모</div>
    <textarea id="m-memo" class="memo-input" rows="2" placeholder="이곳에 대한 나만의 메모를 남겨보세요">${esc(memo)}</textarea>
    <div id="m-tags" class="mine-tags"></div>
  </div>`;
}
// 내 기록 화면 맨 아래 — 네이버 원본 관리 진입
function appendSyncEntry(body) {
  const t = document.createElement('div');
  t.className = 'sec-title'; t.style.margin = '24px 4px 8px';
  t.textContent = '네이버 원본';
  body.appendChild(t);
  const b = document.createElement('button');
  b.className = 'rgrow-main'; b.style.width = '100%';
  b.innerHTML = '<span class="rgname">네이버 즐겨찾기 가져오기 · 폴더 · 삭제</span><span class="rgcnt">›</span>';
  b.onclick = openSync;
  body.appendChild(b);
  const h = document.createElement('p');
  h.className = 'rg-hint'; h.style.marginTop = '8px';
  h.textContent = '네이버에 저장된 원본을 지금 상태로 가져와 비교하고, 폴더에서 빼거나 삭제할 수 있어요.';
  body.appendChild(h);
}

function renderMineTags(p) {
  const el = $('#m-tags'); if (!el) return;
  const inLists = Store.lists.filter(l => l.ids.includes(String(p.id)));
  el.innerHTML = inLists.map(l => `<span class="mine-tag">☆ ${esc(l.name)}</span>`).join('');
}
function renderListPick(p) {
  const pick = $('#m-listpick'); if (!pick) return;
  const chips = Store.lists.map(l => `<button class="lp-chip${l.ids.includes(String(p.id)) ? ' on' : ''}" data-id="${l.id}">${esc(l.name)}</button>`).join('');
  pick.innerHTML = `<div class="lp-chips">${chips || '<span class="lp-empty">리스트를 만들어 이 장소를 담아보세요</span>'}</div>
    <div class="lp-new"><input id="lp-name" placeholder="새 리스트 이름" maxlength="24"><button id="lp-add">담기</button></div>`;
  $$('.lp-chip', pick).forEach(b => b.onclick = () => { toggleInList(b.dataset.id, p.id); b.classList.toggle('on'); renderMineTags(p); renderMarkers(); });
  $('#lp-add', pick).onclick = () => { const v = ($('#lp-name', pick).value || '').trim(); if (!v) return; const id = newList(v); toggleInList(id, p.id); renderListPick(p); renderMineTags(p); renderChips(); };
}
function bindDetailMine(p, body) {
  renderMineTags(p);
  const vb = $('#m-visited', body); if (vb) vb.onclick = () => { toggleVisited(p.id); const v = isVisited(p.id); vb.classList.toggle('on', v); vb.textContent = v ? '✓ 가봤어요' : '가봤어요'; renderMarkers(); };
  const lb = $('#m-list', body), pick = $('#m-listpick', body);
  if (lb) lb.onclick = () => { pick.hidden = !pick.hidden; if (!pick.hidden) renderListPick(p); };
  const mm = $('#m-memo', body);
  if (mm) { let t; mm.oninput = () => { clearTimeout(t); t = setTimeout(() => setMemo(p.id, mm.value), 400); }; mm.onblur = () => setMemo(p.id, mm.value); }
}

/* ---------- AI 추천 코스 (시안 2a 입력 / 2b 결과) ---------- */
const EXAMPLES = ['비 오는 날 조용한 카페', '부모님 모시고 한식', '강릉 1박 코스', '아직 안 가본 디저트'];
const RCKEY = 'hymap.recentCourses.v1';
let courseMap = null, courseLayer = null, lastCourse = null, lastPrompt = '';

function loadRecent() { try { return JSON.parse(localStorage.getItem(RCKEY)) || []; } catch (e) { return []; } }
function saveRecent(list) { try { localStorage.setItem(RCKEY, JSON.stringify(list.slice(0, 6))); } catch (e) {} }
function pushRecent(course, km) {
  const list = loadRecent().filter(r => r.title !== course.title);
  list.unshift({ title: course.title || '오늘의 코스', n: course.stops.length, km: Math.round(km * 10) / 10, at: Date.now(), q: lastPrompt });
  saveRecent(list);
}
function fmtDate(ms) { const d = new Date(ms); return `${d.getMonth() + 1}월 ${d.getDate()}일`; }

function initRecommend() {
  $('#fab').onclick = () => openCourseInput('');
  $('#ci-back').onclick = closeCourse;
  $('#cr-back').onclick = () => { $('#course-result').hidden = true; openCourseInput(null); };
  $('#cr-redo').onclick = () => { $('#course-result').hidden = true; openCourseInput(null); };
  $('#ci-go').onclick = runRecommend;

  const ta = $('#ci-input');
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; };
  ta.addEventListener('input', grow);

  const ex = $('#ci-examples');
  ex.innerHTML = EXAMPLES.map(e => `<button class="ex">${esc(e)}</button>`).join('');
  $$('.ex', ex).forEach(b => b.onclick = () => { ta.value = b.textContent; grow(); ta.focus(); });

  $('#cr-pin').onclick = () => { if (lastCourse) fitCourseMap(lastCourse.stops.map(s => s.p)); };
  $('#cr-cta').onclick = () => {
    if (!lastCourse || !lastCourse.stops.length) return;
    const last = lastCourse.stops[lastCourse.stops.length - 1].p;
    const web = `https://map.naver.com/p/search/${encodeURIComponent(last.n)}`;
    const app = `nmap://route/public?dlat=${last.la}&dlng=${last.lo}&dname=${encodeURIComponent(last.n)}&appname=favplace`;
    const t = setTimeout(() => { location.href = web; }, 900);
    window.addEventListener('pagehide', () => clearTimeout(t), { once: true });
    location.href = app;
  };
}

function closeCourse() { $('#course-input').hidden = true; $('#course-result').hidden = true; }

function openCourseInput(prefill) {
  $('#course-result').hidden = true;
  $('#course-input').hidden = false;
  $('#ci-sub').textContent = `저장한 ${fmtN(PLACES.filter(p => p.map).length)}곳 중에서 지금 위치와 기분에 맞는 코스를 짜드려요.`;
  $('#ci-err').hidden = true;
  const ta = $('#ci-input');
  if (prefill !== null && prefill !== undefined) ta.value = prefill;
  ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
  renderGeoLabel();
  renderRecent();
  if (prefill) runRecommend();
}

function renderGeoLabel() {
  const el = $('#ci-geo');
  if (!userLoc) { el.textContent = '위치 없이 추천'; return; }
  let near = null, best = Infinity;
  PLACES.forEach(p => { if (!p.map) return; const d = distTo(p); if (d < best) { best = d; near = p; } });
  el.textContent = near ? `현재 위치 · ${near.dong || shortRg(near.gu) || shortRg(near.sido)}` : '현재 위치 확인됨';
}

function renderRecent() {
  const box = $('#ci-recent'), list = loadRecent();
  if (!list.length) { box.innerHTML = `<p class="rc-empty">아직 만든 코스가 없어요. 위에 상황을 적고 코스를 만들어 보세요.</p>`; return; }
  box.innerHTML = list.map(r => `<button class="rc-row">
      <span class="rc-badge">${r.n}</span>
      <span class="rc-meta"><b>${esc(r.title)}</b><span>${fmtDate(r.at)}${r.km ? ` · ${r.km}km` : ''}</span></span>
      <svg viewBox="0 0 24 24" class="ic" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6l6 6-6 6"/></svg>
    </button>`).join('');
  $$('.rc-row', box).forEach((b, i) => b.onclick = () => { const q = list[i].q || list[i].title; $('#ci-input').value = q; runRecommend(); });
}

async function runRecommend() {
  const q = $('#ci-input').value.trim();
  if (!q) { $('#ci-input').focus(); return; }
  lastPrompt = q;
  const go = $('#ci-go'), err = $('#ci-err');
  err.hidden = true; go.disabled = true; go.textContent = '코스 짜는 중';
  let skel = $('#ci-skel');
  if (!skel) { skel = document.createElement('div'); skel.id = 'ci-skel'; skel.className = 'cs-skel'; skel.innerHTML = '<div></div><div></div><div></div>'; $('#ci-recent').parentNode.insertBefore(skel, $('#ci-recent')); }
  skel.hidden = false;

  let course = null, failed = false;
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
        if (stops.length) course = { title: data.title || '', intro: data.intro || '', tips: data.tips || '', stops };
      }
    } catch (e) { failed = true; }
  }
  if (!course) course = heuristicCourse(q);

  go.disabled = false; go.textContent = '코스 만들기';
  skel.hidden = true;

  if (!course || !course.stops.length) {
    err.hidden = false;
    err.innerHTML = '조건에 맞는 저장 장소를 못 찾았어요. 지역이나 종류를 바꿔서 적어보세요.';
    return;
  }
  if (failed) {
    err.hidden = false;
    err.innerHTML = 'AI 연결에 실패해 기기 안에서 골랐어요.<button id="ci-retry">다시 시도</button>';
    const rt = $('#ci-retry'); if (rt) rt.onclick = runRecommend;
  }
  showCourseResult(course, q);
}

/* ---------- 2b 결과 ---------- */
function courseGeom(stops) {
  let km = 0;
  for (let i = 1; i < stops.length; i++) km += haversine(stops[i - 1].la, stops[i - 1].lo, stops[i].la, stops[i].lo) / 1000;
  return km;
}
function legMode(km) { return km < 1.2 ? `도보 ${Math.max(1, Math.round(km / 4 * 60))}분` : km < 12 ? `차 ${Math.max(3, Math.round(km / 25 * 60))}분` : `이동 ${Math.round(km / 50 * 60)}분`; }
function hhmm(d) { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

function showCourseResult(course, q) {
  lastCourse = course;
  $('#course-input').hidden = true;
  $('#course-result').hidden = false;

  const stops = course.stops.map(s => s.p);
  const km = courseGeom(stops);
  const mins = stops.length * 60 + Math.round(km / 4 * 60);
  const first = stops[0];
  const kicker = `${first.dong || shortRg(first.gu) || shortRg(first.sido) || '오늘'} · ${new Date().getHours() < 15 ? '오늘 낮' : '오늘 저녁'}`;
  const allWalk = stops.every((p, i) => i === 0 || haversine(stops[i - 1].la, stops[i - 1].lo, p.la, p.lo) / 1000 < 1.2);
  const meta = `${stops.length}곳 · ${km.toFixed(1)}km · 약 ${Math.round(mins / 60)}시간${allWalk ? ' · 모두 도보' : ''}`;

  const t0 = new Date(); t0.setMinutes(t0.getMinutes() < 30 ? 30 : 0); if (t0.getMinutes() === 0) t0.setHours(t0.getHours() + 1);
  let cur = new Date(t0);

  let html = `<div class="cr-head">
      <div class="k">${esc(kicker)}</div>
      <h2>${esc(course.title || '오늘의 코스')}</h2>
      <div class="m">${esc(meta)}</div>
    </div>`;
  if (course.intro) html += `<div class="cr-note"><span class="ai-badge">AI 분석</span>${esc(course.intro)}</div>`;

  html += '<div class="cr-list">';
  course.stops.forEach((s, i) => {
    const p = s.p;
    if (i > 0) {
      const legKm = haversine(stops[i - 1].la, stops[i - 1].lo, p.la, p.lo) / 1000;
      cur = new Date(cur.getTime() + (60 + Math.max(5, Math.round(legKm / 4 * 60))) * 60000);
    }
    const legKm = i === 0 ? 0 : haversine(stops[i - 1].la, stops[i - 1].lo, p.la, p.lo) / 1000;
    const where = i === 0 ? (p.dong || shortRg(p.gu) || '') : legMode(legKm);
    const kick = `${hhmm(cur)} — ${esc(p.c2 || catLabel(p.c1))}${where ? ` · ${esc(where)}` : ''}`;
    const bits = [];
    if (p.sc) bits.push(`★ ${p.sc}`);
    if (p.rv) bits.push(`리뷰 ${fmtN(p.rv)}`);
    if (p.x) bits.push('폐업');
    html += `<button class="cr-stop">
        <span class="cr-rail"><span class="n">${i + 1}</span>${i < course.stops.length - 1 ? '<span class="l"></span>' : ''}</span>
        ${p.ph[0] ? `<img loading="lazy" decoding="async" src="${picSrc(p.ph[0])}" alt="">` : `<span class="ph" style="background:${catColor(p.c1)}22"></span>`}
        <span class="cr-txt">
          <span class="k">${kick}</span>
          <span class="n">${esc(p.n)}</span>
          ${(s.why || p.mc) ? `<span class="d">${esc(s.why || p.mc)}</span>` : ''}
          ${bits.length ? `<span class="m">${esc(bits.join(' · '))}</span>` : ''}
        </span>
      </button>`;
  });
  html += '</div>';
  if (course.tips) html += `<div class="cr-tips">${esc(course.tips)}</div>`;

  const body = $('#cr-body');
  body.innerHTML = html; body.scrollTop = 0;
  $$('.cr-stop', body).forEach((el, i) => el.onclick = () => { closeCourse(); openDetail(course.stops[i].p); });

  drawCourseMap(stops);
  pushRecent(course, km);
}

function drawCourseMap(stops) {
  const el = $('#cr-map-el');
  if (!courseMap) {
    courseMap = L.map(el, { zoomControl: false, attributionControl: false, dragging: true, tap: true });
    L.tileLayer(C.TILE_LIGHT, { subdomains: 'abcd', maxZoom: 19, detectRetina: true }).addTo(courseMap);
  }
  setTimeout(() => { try { courseMap.invalidateSize(); } catch (e) {} }, 60);
  if (courseLayer) courseMap.removeLayer(courseLayer);
  courseLayer = L.layerGroup();
  const latlngs = stops.map(p => [p.la, p.lo]);
  const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#3B7DE0';
  if (latlngs.length > 1) L.polyline(latlngs, { color: brand, weight: 2, dashArray: '5 5', opacity: .95 }).addTo(courseLayer);
  stops.forEach((p, i) => {
    const last = i === stops.length - 1 && stops.length > 2;
    L.marker([p.la, p.lo], {
      zIndexOffset: 1000 + i,
      icon: L.divIcon({
        className: '',
        html: `<div class="cnum${last ? ' last' : ''}" style="animation-delay:${i * 60}ms"><span class="c">${i + 1}</span><span class="t">${esc(p.n)}</span></div>`,
        iconSize: [40, 40], iconAnchor: [20, 20]
      })
    }).addTo(courseLayer);
  });
  courseLayer.addTo(courseMap);
  fitCourseMap(stops);
}
function fitCourseMap(stops) {
  if (!courseMap) return;
  const latlngs = stops.map(p => [p.la, p.lo]);
  if (latlngs.length > 1) courseMap.fitBounds(latlngs, { padding: [70, 90], maxZoom: 15 });
  else if (latlngs.length) courseMap.setView(latlngs[0], 15);
}

function slim(p) { return { id: p.id, n: p.n, c1: p.c1, c2: p.c2, nc: p.nc, rg: p.rg, kw: p.kw, sc: p.sc, mc: (p.mc || '').slice(0, 60) }; }
function candidatesFor(q) {
  let pool = PLACES.filter(p => p.map && !p.x);
  const sidos = [...new Set(PLACES.map(p => p.sido).filter(Boolean))];
  const gus = [...new Set(PLACES.map(p => p.gu).filter(Boolean))];
  const norm = r => r.replace(/(특별자치도|특별자치시|광역시|특별시|자치시|자치구|시|군|구|도)$/, '');
  const region = [...gus, ...sidos].find(r => r && (q.includes(r) || (norm(r).length >= 2 && q.includes(norm(r)))));
  if (region) pool = pool.filter(p => p.rg.includes(region));
  const FOOD = ['음식점'];
  const wants = [];
  const RULES = [
    [/대게|회|해물|해산물|물회|초밥|스시|일식|돈카츠|라멘|사시미/, ['일식·회'], '바다'],
    [/고기|구이|삼겹|갈비|한우|곱창|막창|스테이크|족발|보쌈|오리|장어/, ['고기·구이'], null],
    [/중식|짜장|짬뽕|마라|탕수|양꼬치|딤섬/, ['중식'], null],
    [/파스타|피자|양식|이탈리|버거|햄버거|멕시|쌀국수|베트남|태국/, ['양식·아시안'], null],
    [/한식|국밥|백반|찌개|냉면|칼국수|한정식|찜|탕|해장국/, ['한식'], null],
    [/분식|떡볶이|김밥|순대|치킨|닭강정/, ['분식', '치킨'], null],
    [/맛집|밥|먹|식당|점심|저녁|식사|회식|배고/, FOOD, null],
    [/카페|커피|디저트|빵|베이커리|케이크|브런치|베이글|소금빵|도넛/, ['카페'], null],
    [/술|바|와인|칵테일|포차|맥주|하이볼|이자카야|호프|위스키/, ['술집바'], null],
    [/미술관|전시|박물관|문화|갤러리|공연|영화|도서관|서점|책방|복합문화/, ['문화'], null],
    [/골프|스포츠|수영|볼링|클라이밍|헬스|체험|공방/, ['레저'], null],
    [/명소|관광|시장|전망|랜드마크|유적|고궁/, ['명소'], null],
    [/바다|오션|해변|해수욕|산|숲|공원|자연|계곡|폭포|온천|노을|풍경|호수/, ['자연'], '바다뷰'],
    [/룸|프라이빗|단체/, null, '룸'],
    [/늦게|늦은|밤|24시|새벽|마감/, null, '24시'],
    [/숙박|호텔|펜션|글램핑|캠핑|리조트|모텔/, ['숙박'], null],
    [/쇼핑|아울렛|백화점|마트/, ['쇼핑'], null]
  ];
  RULES.forEach(([re, cats, kw]) => { if (re.test(q)) wants.push({ cats, kw }); });
  if (!wants.length) { wants.push({ cats: FOOD, kw: null }, { cats: ['카페'], kw: null }); }
  const score = p => {
    let s = 0;
    wants.forEach(w => { if (w.cats && (w.cats.includes(p.c1) || w.cats.includes(p.c2))) s += 5; if (w.kw && p.kw.includes(w.kw)) s += 4; });
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
    if ((used[p.c1] || 0) >= 2) continue;
    used[p.c1] = (used[p.c1] || 0) + 1; pick.push(p);
  }
  const orank = { 음식점: 0, 술집바: 1, 카페: 2, 문화: 3, 명소: 4, 자연: 4, 레저: 4, 숙박: 5, 쇼핑: 6, 생활: 7, 주거: 8 };
  pick.sort((a, b) => (orank[a.c1] ?? 9) - (orank[b.c1] ?? 9));
  return { title: region ? `${region} 코스` : '오늘의 코스', intro: region ? `'${q}' 요청을 바탕으로 ${region} 근처 저장 장소에서 골랐어요.` : `'${q}' 요청을 바탕으로 저장 장소에서 어울리는 곳을 골랐어요.`, stops: pick.map(p => ({ p, why: p.mc || '' })) };
}

/* ---------- 토스트 (짧은 알림) ---------- */
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), 3200);
}

/* ================= 네이버 원본 관리 (가져오기 · 폴더 · 삭제) =================
   백엔드는 app/functions/naver-sync.js. 쿠키가 등록되기 전엔 503이라 안내 화면만 보인다.
   쓰기는 반드시 dry-run 미리보기 -> 사용자가 확인 -> confirm:true 순서로만 실행한다. */
let SYNC = { ping: null, snap: null, folderId: null, sel: new Set(), busy: false };

function initSync() {
  const cl = $('#sync-close');
  if (cl) cl.onclick = () => { $('#sync').hidden = true; };
}
function openSync() {
  $('#sync').hidden = false;
  SYNC.sel.clear(); SYNC.folderId = null;
  renderSync();
  syncPing();
}
async function syncApi(qs) {
  const r = await fetch('/naver-sync?' + qs, { cache: 'no-store' });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, d };
}
async function syncPing() {
  const res = await syncApi('action=ping');
  SYNC.ping = Object.assign({}, res.d, { status: res.status });
  renderSync();
}
function syncEl(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function renderSync() {
  const body = $('#sync-body'); if (!body) return;
  body.innerHTML = '';
  const p = SYNC.ping;
  if (!p) { body.appendChild(syncEl('p', 'rg-hint', '연결 상태 확인 중…')); return; }

  const on = !!p.hasCookie, w = !!p.writeEnabled;
  const card = syncEl('div', 'sync-card',
    '<div class="sync-row"><span class="sync-dot' + (on ? ' ok' : '') + '"></span><b>' +
    (on ? '네이버 계정 연결됨' : '네이버 계정 미연결') + '</b></div>' +
    '<div class="sync-row"><span class="sync-dot' + (w ? ' ok' : '') + '"></span><b>' +
    (w ? '수정·삭제 허용됨' : '수정·삭제 잠김') + '</b></div>');
  body.appendChild(card);

  if (!on) {
    body.appendChild(syncEl('div', 'sync-guide',
      '<p>이 기능을 켜려면 Cloudflare에 <b>본인이 직접</b> 값을 등록해야 합니다. ' +
      '네이버 로그인 쿠키는 비밀값이라 앱이나 저장소에 넣지 않습니다.</p>' +
      '<ol><li>크롬에서 <b>map.naver.com</b> 로그인 → F12 → Application → Cookies → ' +
      '<code>NID_AUT</code>, <code>NID_SES</code> 값 복사</li>' +
      '<li>Cloudflare → Workers &amp; Pages → favplace-map → Settings → Variables and secrets</li>' +
      '<li><code>NAVER_COOKIE</code> = <code>NID_AUT=…; NID_SES=…</code> (Secret)</li>' +
      '<li>수정·삭제까지 쓰려면 <code>NAVER_SYNC_WRITE</code> = <code>on</code></li></ol>' +
      '<p class="warn">쿠키는 몇 주 뒤 만료됩니다. 안 되면 다시 복사해 넣으세요.</p>'));
    return;
  }

  const sec1 = syncEl('div', 'sec-title'); sec1.textContent = '네이버에서 최신 목록 가져오기';
  sec1.style.margin = '20px 4px 8px'; body.appendChild(sec1);

  const btn = syncEl('button', 'act primary');
  btn.textContent = SYNC.busy ? '가져오는 중…' : '지금 가져와서 비교하기';
  btn.disabled = SYNC.busy;
  btn.onclick = syncFetchSnapshot;
  body.appendChild(btn);

  if (!SYNC.snap) return;

  const snap = SYNC.snap;
  const localSids = new Set(PLACES.map(x => String(x.id)));
  const remoteSids = new Set(snap.bookmarks.map(b => String(b.sid)).filter(Boolean));
  const added = snap.bookmarks.filter(b => b.sid && !localSids.has(String(b.sid)));
  const gone = PLACES.filter(x => !remoteSids.has(String(x.id)));

  body.appendChild(syncEl('div', 'sync-card',
    '<div class="sync-kv"><span>네이버 원본</span><b>' + fmtN(snap.bookmarks.length) + '곳</b></div>' +
    '<div class="sync-kv"><span>이 앱의 데이터</span><b>' + fmtN(PLACES.length) + '곳</b></div>' +
    '<div class="sync-kv"><span>앱에 없는 새 장소</span><b class="pos">' + added.length + '곳</b></div>' +
    '<div class="sync-kv"><span>네이버에서 사라진 장소</span><b class="neg">' + gone.length + '곳</b></div>'));

  const listBlock = (title, arr, nameOf) => {
    if (!arr.length) return;
    const t = syncEl('div', 'sec-title'); t.textContent = title; t.style.margin = '14px 4px 6px';
    body.appendChild(t);
    const box = syncEl('div', 'sync-list');
    arr.slice(0, 40).forEach(x => { const r = syncEl('div', 'sync-li'); r.textContent = nameOf(x); box.appendChild(r); });
    if (arr.length > 40) { const r = syncEl('div', 'sync-li dim'); r.textContent = '그 외 ' + (arr.length - 40) + '곳…'; box.appendChild(r); }
    body.appendChild(box);
  };
  listBlock('앱에 없는 새 장소', added, b => b.name);
  listBlock('네이버에서 사라진 장소', gone, x => x.n);

  body.appendChild(syncEl('p', 'rg-hint',
    '지도에 실제로 반영하려면 사진·평점 보강이 필요해서 <b>PC에서 빌드</b>를 한 번 돌려야 합니다 ' +
    '(<code>enrich.py</code> → <code>build_data.py</code> → 배포). 여기서는 무엇이 달라졌는지까지 확인합니다.'));

  const sec2 = syncEl('div', 'sec-title'); sec2.textContent = '폴더 관리 · 삭제';
  sec2.style.margin = '22px 4px 8px'; body.appendChild(sec2);

  if (!w) {
    body.appendChild(syncEl('div', 'sync-guide',
      '<p>수정·삭제가 잠겨 있습니다. Cloudflare에 <code>NAVER_SYNC_WRITE</code> = <code>on</code> 을 추가하면 열립니다.</p>'));
    return;
  }
  renderSyncFolders(body);
}

async function syncFetchSnapshot() {
  SYNC.busy = true; renderSync();
  const res = await syncApi('action=snapshot');
  SYNC.busy = false;
  if (!res.ok) { SYNC.snap = null; renderSync(); toast('가져오기 실패 (HTTP ' + res.status + ') ' + (res.d.error || '')); return; }
  SYNC.snap = res.d; SYNC.folderId = null; SYNC.sel.clear();
  renderSync();
}

function renderSyncFolders(body) {
  const snap = SYNC.snap;
  const counts = {};
  snap.bookmarks.forEach(b => b.folderIds.forEach(f => { counts[f] = (counts[f] || 0) + 1; }));

  if (SYNC.folderId == null) {
    body.appendChild(syncEl('p', 'rg-hint',
      '폴더를 고르면 그 폴더의 장소를 골라 <b>폴더에서 빼거나 삭제</b>할 수 있어요.'));
    snap.folders.forEach(f => {
      const row = syncEl('div', 'rgrow2');
      const main = syncEl('button', 'rgrow-main',
        '<span class="rgname">' + esc(f.name) + (f.isDefault ? ' <span class="fbadge">기본</span>' : '') +
        '</span><span class="rgcnt">' + (counts[f.folderId] || 0) + '</span>');
      main.onclick = () => { SYNC.folderId = f.folderId; SYNC.sel.clear(); renderSync(); };
      row.appendChild(main); body.appendChild(row);
    });
    return;
  }

  const folder = snap.folders.find(f => f.folderId === SYNC.folderId) || { name: '폴더' };
  const back = syncEl('button', 'crumb'); back.textContent = '‹ 폴더 목록';
  back.onclick = () => { SYNC.folderId = null; SYNC.sel.clear(); renderSync(); };
  body.appendChild(back);

  const items = snap.bookmarks.filter(b => b.folderIds.includes(SYNC.folderId));
  const t = syncEl('div', 'sec-title'); t.style.margin = '14px 4px 8px';
  t.textContent = folder.name + ' · ' + items.length + '곳';
  body.appendChild(t);
  body.appendChild(syncEl('p', 'rg-hint',
    '이 폴더에만 들어있는 장소를 빼면 <b>즐겨찾기에서 완전히 삭제</b>됩니다. 실행 전에 항목별로 어떻게 되는지 먼저 보여드려요.'));

  const box = syncEl('div', 'sync-list');
  items.slice(0, 300).forEach(b => {
    const only = b.folderIds.length <= 1;
    const row = syncEl('label', 'sync-pick',
      '<input type="checkbox"' + (SYNC.sel.has(b.bookmarkId) ? ' checked' : '') + ' />' +
      '<span class="sp-name">' + esc(b.name) + '</span>' +
      '<span class="sp-tag' + (only ? ' danger' : '') + '">' + (only ? '삭제됨' : '폴더만') + '</span>');
    row.querySelector('input').onchange = e => {
      if (e.target.checked) {
        if (SYNC.sel.size >= 25) { e.target.checked = false; toast('한 번에 25개까지만 선택할 수 있어요'); return; }
        SYNC.sel.add(b.bookmarkId);
      } else SYNC.sel.delete(b.bookmarkId);
      const go = $('#sync-go');
      if (go) { go.disabled = !SYNC.sel.size; go.textContent = SYNC.sel.size ? '선택한 ' + SYNC.sel.size + '곳 처리하기' : '장소를 선택하세요'; }
    };
    box.appendChild(row);
  });
  body.appendChild(box);

  const go = syncEl('button', 'act primary'); go.id = 'sync-go';
  go.style.marginTop = '14px';
  go.disabled = !SYNC.sel.size;
  go.textContent = SYNC.sel.size ? '선택한 ' + SYNC.sel.size + '곳 처리하기' : '장소를 선택하세요';
  go.onclick = syncPreview;
  body.appendChild(go);
}

async function syncPost(payload) {
  const r = await fetch('/naver-sync', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, d };
}

async function syncPreview() {
  const ids = Array.from(SYNC.sel);
  if (!ids.length) return;
  const res = await syncPost({ action: 'unmapFolder', folderId: SYNC.folderId, bookmarkIds: ids });
  if (!res.ok || !res.d.dryRun) { toast('미리보기 실패 (HTTP ' + res.status + ') ' + (res.d.error || '')); return; }
  const pv = res.d.preview || [];
  const del = pv.filter(x => String(x['결과'] || '').indexOf('삭제') >= 0);
  const lines = pv.slice(0, 12).map(x => '· ' + x.name + ' — ' + x['결과']).join('\n');
  const more = pv.length > 12 ? '\n… 그 외 ' + (pv.length - 12) + '곳' : '';
  const msg = res.d.count + '곳을 처리합니다.\n\n' +
    '폴더에서만 제거: ' + (pv.length - del.length) + '곳\n' +
    '⚠️ 즐겨찾기에서 완전 삭제: ' + del.length + '곳\n\n' + lines + more +
    '\n\n되돌릴 수 없습니다. 진행할까요?';
  if (!window.confirm(msg)) return;
  syncExecute(ids);
}

async function syncExecute(ids) {
  const res = await syncPost({ action: 'unmapFolder', folderId: SYNC.folderId, bookmarkIds: ids, confirm: true });
  if (!res.ok) { toast('실행 실패 (HTTP ' + res.status + ') ' + (res.d.error || '')); return; }
  const un = (res.d['폴더에서제거됨'] || []).length, rm = (res.d['완전삭제됨'] || []).length;
  toast('완료 — 폴더에서 뺀 곳 ' + un + ', 삭제된 곳 ' + rm);
  SYNC.sel.clear();
  await syncFetchSnapshot();
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
    showMyLocation(la, lo);
    const lb = $('#btn-locate'); if (lb) lb.classList.add('on');
    const cand = PLACES.filter(p => p.map && !p.x).map(p => ({ p, d: haversine(la, lo, p.la, p.lo) })).sort((a, b) => a.d - b.d);
    const near = cand.find(c => c.p.ph.length && c.d < 30000) || (cand[0] && cand[0].d < 30000 ? cand[0] : null);
    if (near) {
      $('#nearby-text').innerHTML = `근처 ${fmtDist(near.d)} · <b>${esc(near.p.n)}</b> · ${esc(near.p.nc || catLabel(near.p.c1))}`;
      const n = $('#nearby'); n.hidden = false;
      $('#nearby-close').onclick = ev => { ev.stopPropagation(); n.hidden = true; };
      $('#nearby-text').onclick = () => openDetail(near.p);
    }
  }, () => {}, { timeout: 8000, maximumAge: 600000 });
}

function initGuide() {
  const btn = $('#btn-info'); if (btn) btn.onclick = openGuide;
  const cl = $('#guide-close'); if (cl) cl.onclick = () => { $('#guide').hidden = true; };
}
function openGuide() {
  const total = META.total != null ? META.total : PLACES.length;
  const withPhoto = META.withPhoto != null ? META.withPhoto : PLACES.filter(p => p.ph.length).length;
  const closed = META.closed != null ? META.closed : PLACES.filter(p => p.x).length;
  const catRows = C.CATS.map(c => { const n = catCount(c.k); return n ? `<div class="gcat"><span class="dot" style="background:${c.color}"></span>${esc(c.label || c.k)}<b>${n}</b></div>` : ''; }).join('');
  const feats = [
    ['지도', '핀 색이 곧 테마. 클러스터 숫자를 탭하면 펼쳐져요.'],
    ['지역', '맨 앞 지역 칩으로 도 › 시군구 › 동까지 좁혀보기.'],
    ['카테고리', '테마 칩(대분류→세부)으로 필터링.'],
    ['검색', '이름·지역·메뉴로 검색(🔍).'],
    ['내 기록', '방문 체크·나만의 메모·리스트로 나만의 지도를 만들어요.'],
    ['내 위치', '상단 ◎ 버튼으로 현재 위치 표시 + 가까운 순 정렬.'],
    ['AI 추천', '기분/상황을 적으면 코스를 만들어줘요.'],
    ['장소 상세', '사진·메뉴·평점 + 네이버·길찾기·전화·공유. 아래로 쓸어내려 닫기.']
  ];
  $('#guide-body').innerHTML =
    `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:6px">
      <div class="mcard"><div class="mlbl">전체 장소</div><div class="mval">${total}</div></div>
      <div class="mcard"><div class="mlbl">사진 있는 곳</div><div class="mval">${withPhoto}</div></div>
      <div class="mcard"><div class="mlbl">폐업 표시</div><div class="mval">${closed}</div></div>
      <div class="mcard"><div class="mlbl">마지막 갱신</div><div class="mval" style="font-size:15px">${esc(META.updated || '-')}</div></div>
    </div>
    <p style="font-size:12px;color:var(--ink-3);margin:4px 0 16px">매일 새벽 2시, 네이버 즐겨찾기에서 자동으로 가져와 갱신돼요.</p>
    <div class="sec-title">카테고리</div><div class="gcats">${catRows}</div>
    <div class="sec-title" style="margin-top:16px">기능 안내</div>
    ${feats.map(f => `<div class="gfeat"><b>${f[0]}</b><span>${f[1]}</span></div>`).join('')}`;
  $('#guide').hidden = false;
}
document.addEventListener('DOMContentLoaded', initGate);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
})();
