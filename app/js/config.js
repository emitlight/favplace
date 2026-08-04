/* ============== 앱 설정 ============== */
window.CONFIG = {
  // 비밀번호 게이트 (v1 임시 — 실제 보안은 Cloudflare Access로 대체 예정)
  // 변경: 원하는 비밀번호 문자열로. 숫자 4자리 권장.
  PASS: "1234",

  // AI 추천 엔드포인트 (Cloudflare Pages Function /recommend). 키 미설정/미배포 시 자동 휴리스틱 폴백.
  AI_ENDPOINT: "/recommend",

  // 지도 타일 (무료, 키 불필요 / 한글 라벨)
  TILE_LIGHT: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  TILE_DARK:  "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png",
  TILE_ATTR:  '&copy; OpenStreetMap &copy; CARTO',

  CENTER: [36.5, 127.8],
  ZOOM: 7,

  // 카테고리 정의 (순서/색)
  CATS: [
    { k:"음식점", label:"음식점",      color:"#E8590C" },
    { k:"카페",   label:"카페",        color:"#B07A3C" },
    { k:"술집바", label:"술집·바",     color:"#7048E8" },
    { k:"문화",   label:"문화",        color:"#2F9E44" },
    { k:"레저",   label:"레저",        color:"#0CA678" },
    { k:"명소",   label:"명소",        color:"#E64980" },
    { k:"자연",   label:"자연",        color:"#66A80F" },
    { k:"숙박",   label:"숙박",        color:"#1971C2" },
    { k:"쇼핑",   label:"쇼핑",        color:"#9C36B5" },
    { k:"주거",   label:"주거·부동산",  color:"#495057" },
    { k:"생활",   label:"생활",        color:"#868E96" }
  ]
};
