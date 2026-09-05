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
    // 하늘색 키컬러와 어울리는 파스텔 톤 (지도 핀에서도 서로 구분되게 색상환을 넓게 씀)
    { k:"음식점", label:"음식점",      color:"#F2765F" },
    { k:"카페",   label:"카페",        color:"#D99A55" },
    { k:"술집바", label:"술집·바",     color:"#8A7BE8" },
    { k:"문화",   label:"문화",        color:"#3FB78C" },
    { k:"레저",   label:"레저",        color:"#2FB6CC" },
    { k:"명소",   label:"명소",        color:"#EE7AA1" },
    { k:"자연",   label:"자연",        color:"#83BE5C" },
    { k:"숙박",   label:"숙박",        color:"#6B8FEA" },
    { k:"쇼핑",   label:"쇼핑",        color:"#C577C6" },
    { k:"주거",   label:"주거·부동산",  color:"#7E8EA0" },
    { k:"생활",   label:"생활",        color:"#A6B4C2" }
  ]
};
