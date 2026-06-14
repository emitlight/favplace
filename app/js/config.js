/* ============== 앱 설정 ============== */
window.CONFIG = {
  // 비밀번호 게이트 (v1 임시 — 실제 보안은 Cloudflare Access로 대체 예정)
  // 변경: 원하는 비밀번호 문자열로. 숫자 4자리 권장.
  PASS: "1234",

  // AI 추천 코스 엔드포인트 (Cloudflare Worker). 비워두면 기기 내 휴리스틱 추천 사용.
  AI_ENDPOINT: "",

  // 지도 타일 (무료, 키 불필요 / 한글 라벨)
  TILE_LIGHT: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  TILE_DARK:  "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png",
  TILE_ATTR:  '&copy; OpenStreetMap &copy; CARTO',

  CENTER: [36.5, 127.8],
  ZOOM: 7,

  // 카테고리 정의 (순서/색)
  CATS: [
    { k:"맛집",   color:"#E8590C", icon:"🍽" },
    { k:"카페",   color:"#B07A3C", icon:"☕" },
    { k:"술집바", color:"#7C6CE0", icon:"🍷", label:"술집·바" },
    { k:"숙박",   color:"#2F87E0", icon:"🏨" },
    { k:"여행",   color:"#18A07A", icon:"⛰", label:"여행·관광" },
    { k:"쇼핑",   color:"#E0568A", icon:"🛍" },
    { k:"문화여가", color:"#5FA021", icon:"🎭", label:"문화·여가" },
    { k:"교육",   color:"#2B62D6", icon:"📚" },
    { k:"자동차", color:"#6B6B6B", icon:"🚗" },
    { k:"생활",   color:"#9A9890", icon:"📍", label:"생활·기타" }
  ]
};
