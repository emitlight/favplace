const pptxgen = require("pptxgenjs");

/* ── 팔레트: 앱이 실제로 쓰는 토큰 ───────────────────────────── */
const INK = "16202B";      // 딥 네이비 (지배색)
const INK2 = "5A6B7C";
const INK3 = "8C9BAA";
const BLUE = "3B7DE0";     // 브랜드 액센트
const BLUE_D = "2E6BC8";
const ICE = "E8EFF9";
const PAPER = "F4F7FB";
const WHITE = "FFFFFF";
const GOLD = "D9992F";

// 앱의 카테고리 색 = 이 덱의 모티프
const CAT = [
  ["음식점", "F2765F", 272], ["카페", "D99A55", 198], ["주거·부동산", "7E8EA0", 87],
  ["생활", "A6B4C2", 71], ["문화", "3FB78C", 32], ["레저", "2FB6CC", 23],
  ["숙박", "6B8FEA", 20], ["술집·바", "8A7BE8", 16], ["명소", "EE7AA1", 13],
  ["쇼핑", "C577C6", 9], ["자연", "83BE5C", 9],
];

const F = "맑은 고딕";
const sh = (o = {}) => Object.assign({ type: "outer", color: "1E3A5F", opacity: 0.13, blur: 14, offset: 4, angle: 90 }, o);

const p = new pptxgen();
p.layout = "LAYOUT_WIDE";           // 13.333 x 7.5
p.author = "하영";
p.title = "하영의 지도 (favplace)";
const W = 13.333, H = 7.5;

/* ── 공용 헬퍼 ───────────────────────────────────────────────── */
function darkSlide() {
  const s = p.addSlide();
  s.background = { color: INK };
  return s;
}
function lightSlide(kicker, title) {
  const s = p.addSlide();
  s.background = { color: WHITE };
  if (kicker) s.addText(kicker, {
    x: 0.75, y: 0.42, w: 8, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12, bold: true, color: BLUE, charSpacing: 2,
  });
  if (title) s.addText(title, {
    x: 0.75, y: 0.72, w: 11.8, h: 0.72, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 34, bold: true, color: INK,
  });
  return s;
}
// 카테고리 색 점 — 덱 전체의 모티프
function dot(s, x, y, color, d = 0.17) {
  s.addShape(p.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color } });
}
function card(s, x, y, w, h, fill = PAPER) {
  s.addShape(p.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill }, shadow: sh(),
  });
}

/* ══ 1. 타이틀 ══════════════════════════════════════════════ */
{
  const s = darkSlide();
  // 카테고리 점 11개를 지도 핀처럼 흩뿌림 (모티프 도입)
  const pts = [[10.4,1.05],[11.5,1.6],[10.9,2.35],[12.1,2.75],[10.2,3.15],[11.4,3.6],
               [12.3,4.35],[10.7,4.6],[11.8,5.3],[10.3,5.75],[12.0,6.2]];
  pts.forEach((pt, i) => dot(s, pt[0], pt[1], CAT[i][1], 0.34));

  s.addText("PROJECT · 2026", {
    x: 0.9, y: 1.55, w: 6, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12.5, bold: true, color: "7FB0F0", charSpacing: 3,
  });
  s.addText("하영의 지도", {
    x: 0.9, y: 2.0, w: 8.6, h: 1.1, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 54, bold: true, color: WHITE,
  });
  s.addText("네이버 즐겨찾기 750곳을,  내가 실제로 쓸 수 있게", {
    x: 0.9, y: 3.15, w: 8.6, h: 0.5, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 21, color: "CADCFC",
  });
  s.addText("기획안 · 사용 매뉴얼", {
    x: 0.9, y: 4.15, w: 6, h: 0.4, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 15, bold: true, color: WHITE,
  });
  s.addText("favplace-map.pages.dev   ·   2026.09.04 기준", {
    x: 0.9, y: 4.62, w: 8, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, color: INK3,
  });
  s.addNotes("네이버 지도 즐겨찾기를 원본으로 삼아, 테마별로 정리하고 지도에 펼쳐 보여주는 개인용 웹앱. 기획 배경과 사용법을 함께 담은 덱.");
}

/* ══ 2. 문제 ═══════════════════════════════════════════════ */
{
  const s = lightSlide("PROBLEM", "저장은 쌓이는데, 다시 꺼내 쓸 수가 없었다");
  const items = [
    ["750곳", "네이버에 쌓인 즐겨찾기", "목록이 한 줄로만 나열돼\n어디에 뭐가 있는지 알 수 없음", CAT[0][1]],
    ["7개", "네이버의 리스트(폴더)", "폴더로는 테마 분류가 안 됨.\n'카페'와 '한식'을 갈라볼 수 없음", CAT[1][1]],
    ["0개", "내가 남긴 평가", "다녀왔는지, 좋았는지를\n기록할 자리가 아예 없음", CAT[7][1]],
  ];
  items.forEach(([big, label, desc, c], i) => {
    const x = 0.75 + i * 4.05;
    card(s, x, 2.1, 3.7, 3.2);
    dot(s, x + 0.35, 2.45, c, 0.2);
    s.addText(big, { x: x + 0.35, y: 2.72, w: 3, h: 0.85, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 42, bold: true, color: INK });
    s.addText(label, { x: x + 0.35, y: 3.62, w: 3, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 14, bold: true, color: INK });
    s.addText(desc, { x: x + 0.35, y: 4.02, w: 3.05, h: 1.0, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12.5, color: INK2, lineSpacingMultiple: 1.3 });
  });
  s.addText("즐겨찾기는 '저장하는 곳'이었지, '고르는 곳'이 아니었다.", {
    x: 0.75, y: 5.72, w: 11.8, h: 0.4, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 15, italic: true, color: BLUE_D,
  });
  s.addNotes("문제 정의: 저장 자체는 네이버가 잘 하지만, 750곳이 넘어가면 다시 찾아 쓰는 게 불가능해진다.");
}

/* ══ 3. 서비스 정의 ═════════════════════════════════════════ */
{
  const s = lightSlide("CONCEPT", "이 서비스가 무엇인가");
  card(s, 0.75, 1.95, 11.8, 1.5, ICE);
  s.addText([
    { text: "네이버 즐겨찾기가 ", options: { fontSize: 22, color: INK } },
    { text: "원본", options: { fontSize: 22, bold: true, color: BLUE_D } },
    { text: "이고, 이 앱은 그걸 ", options: { fontSize: 22, color: INK } },
    { text: "보기 좋게 정리해 보여주는 도구", options: { fontSize: 22, bold: true, color: BLUE_D } },
    { text: "다.", options: { fontSize: 22, color: INK } },
  ], { x: 1.15, y: 2.25, w: 11.0, h: 0.9, isTextBox: true, margin: 0, fontFace: F, lineSpacingMultiple: 1.25 });

  const roles = [
    ["네이버가 하는 일", ["장소 저장 (원본)", "폴더(리스트) 보관", "사진·평점·리뷰 제공"], INK3],
    ["이 앱이 하는 일", ["테마 11종으로 자동 분류", "지도·지역·점수로 탐색", "방문·별점·메모 기록", "AI 코스 생성"], BLUE],
  ];
  roles.forEach(([t, list, c], i) => {
    const x = 0.75 + i * 6.15;
    card(s, x, 3.75, 5.65, 2.55, i ? ICE : PAPER);
    dot(s, x + 0.4, 4.08, c, 0.19);
    s.addText(t, { x: x + 0.72, y: 4.0, w: 4.6, h: 0.35, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 15, bold: true, color: INK });
    s.addText(list.map((v, j) => ({ text: v, options: { bullet: true, breakLine: j < list.length - 1 } })), {
      x: x + 0.42, y: 4.5, w: 4.9, h: 1.65, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 13.5, color: INK2, paraSpaceAfter: 7,
    });
  });
  s.addNotes("역할 분담이 핵심. 네이버는 저장소, 이 앱은 뷰어이자 정리 도구. 원본을 대체하지 않는다.");
}

/* ══ 4. 데이터 파이프라인 ═══════════════════════════════════ */
{
  const s = lightSlide("PIPELINE", "데이터가 흘러오는 길");
  const steps = [
    ["01", "수집", "네이버 즐겨찾기 API에서\n전체 목록을 받아온다", CAT[7][1]],
    ["02", "보강", "장소별 사진·평점·메뉴·\n한줄평을 추가로 수집", CAT[1][1]],
    ["03", "분류", "카테고리 + 장소명을 분석해\n테마 11종 / 세부로 나눔", CAT[4][1]],
    ["04", "지역화", "주소에서 시도·시군구·동을\n추출해 3단 드릴다운 구성", CAT[5][1]],
    ["05", "배포", "정적 파일로 빌드해\nCloudflare에 올림", BLUE],
  ];
  steps.forEach(([no, t, d, c], i) => {
    const x = 0.62 + i * 2.46;
    card(s, x, 2.15, 2.2, 3.05);
    s.addShape(p.ShapeType.ellipse, { x: x + 0.32, y: 2.45, w: 0.5, h: 0.5, fill: { color: c } });
    s.addText(no, { x: x + 0.32, y: 2.55, w: 0.5, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 13, bold: true, color: WHITE, align: "center" });
    s.addText(t, { x: x + 0.32, y: 3.12, w: 1.7, h: 0.35, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 17, bold: true, color: INK });
    s.addText(d, { x: x + 0.32, y: 3.55, w: 1.66, h: 1.35, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 11.5, color: INK2, lineSpacingMultiple: 1.28 });
    if (i < 4) s.addText("›", { x: x + 2.16, y: 3.35, w: 0.32, h: 0.4, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 22, bold: true, color: INK3, align: "center" });
  });
  s.addText("01~04는 PC에서 매일 새벽 자동 실행 · 앱에서 ⟳ 버튼을 누르면 01만 즉시 실행돼 지도에 바로 반영", {
    x: 0.75, y: 5.62, w: 11.8, h: 0.4, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, color: INK2,
  });
  s.addNotes("수집은 가볍고 빠르지만, 보강은 장소당 1.4초가 걸려 브라우저에서는 못 한다. 그래서 두 겹 구조가 나왔다.");
}

/* ══ 5. 숫자 현황 ═══════════════════════════════════════════ */
{
  const s = lightSlide("STATUS", "숫자로 보는 현재");
  const stats = [
    ["750", "저장 장소", CAT[0][1]],
    ["588", "사진 확보", CAT[1][1]],
    ["11", "테마 분류", CAT[4][1]],
    ["708", "동 단위 위치", CAT[7][1]],
  ];
  stats.forEach(([n, l, c], i) => {
    const x = 0.75 + i * 3.02;
    card(s, x, 2.15, 2.72, 2.0);
    dot(s, x + 0.34, 2.48, c, 0.19);
    s.addText(n, { x: x + 0.32, y: 2.72, w: 2.1, h: 0.85, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 46, bold: true, color: INK });
    s.addText(l, { x: x + 0.34, y: 3.62, w: 2.1, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 13.5, color: INK2 });
  });
  const notes = [
    ["폐업 15곳", "네이버가 삭제했거나 문 닫은 곳 — 목록에 표시만 하고 걸러낼 수 있음"],
    ["사진 없는 162곳", "네이버에 대표 사진이 없는 장소. 이름·위치·분류는 모두 정상"],
    ["동 정보 42곳 없음", "이 중 10곳은 '주소 즐겨찾기'라 장소 페이지가 없어 원리상 채울 수 없음"],
  ];
  notes.forEach(([t, d], i) => {
    const y = 4.45 + i * 0.62;
    dot(s, 0.82, y + 0.09, INK3, 0.14);
    s.addText([
      { text: t + "  ", options: { bold: true, color: INK } },
      { text: d, options: { color: INK2 } },
    ], { x: 1.15, y: y, w: 11.4, h: 0.35, isTextBox: true, margin: 0, fontFace: F, fontSize: 13 });
  });
  s.addNotes("750곳 중 사진이 있는 곳이 588곳. 나머지는 네이버에 대표 사진 자체가 없다.");
}

/* ══ 6. 테마 분류 ═══════════════════════════════════════════ */
{
  const s = lightSlide("TAXONOMY", "테마 11종 — 색이 곧 분류");
  s.addChart(p.ChartType.bar, [{
    name: "장소 수",
    labels: CAT.map(c => c[0]),
    values: CAT.map(c => c[2]),
  }], {
    x: 0.7, y: 1.95, w: 7.0, h: 4.5,
    barDir: "bar", barGrouping: "clustered",
    chartColors: CAT.map(c => c[1]),
    varyColors: true,
    showValue: true, dataLabelPosition: "outEnd",
    dataLabelFontSize: 11, dataLabelColor: INK2, dataLabelFontFace: F,
    catAxisLabelColor: INK, catAxisLabelFontSize: 12, catAxisLabelFontFace: F,
    valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
    showLegend: false, barGapWidthPct: 45,
  });
  card(s, 8.1, 1.95, 4.45, 4.5, PAPER);
  s.addText("2단 구조", { x: 8.45, y: 2.25, w: 3.8, h: 0.38, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 17, bold: true, color: INK });
  s.addText("대분류를 고른 뒤 › 를 누르면 세부 종류로 좁혀집니다.", {
    x: 8.45, y: 2.68, w: 3.8, h: 0.6, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12.5, color: INK2, lineSpacingMultiple: 1.3 });
  const ex = [
    ["음식점", CAT[0][1], "한식 100 · 고기·구이 54 · 양식 43\n일식·회 33 · 중식 20 · 분식 15"],
    ["카페", CAT[1][1], "디저트 81 · 커피 47 · 베이커리 27\n브런치 11 · 케이크 8 · 베이글 6"],
  ];
  ex.forEach(([t, c, d], i) => {
    const y = 3.42 + i * 1.4;
    dot(s, 8.45, y + 0.06, c, 0.18);
    s.addText(t, { x: 8.75, y: y - 0.02, w: 2, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 14.5, bold: true, color: INK });
    s.addText(d, { x: 8.45, y: y + 0.36, w: 3.85, h: 0.75, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12, color: INK2, lineSpacingMultiple: 1.3 });
  });
  s.addText("네이버 카테고리 + 장소명을 함께 분석해 자동 분류", {
    x: 8.45, y: 5.88, w: 3.85, h: 0.5, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 11.5, italic: true, color: INK3, lineSpacingMultiple: 1.25 });
  s.addNotes("네이버가 주는 카테고리만으로는 부족해서 장소명·설명까지 같이 본다. 예를 들어 '소금빵'이 이름에 있으면 카페>소금빵으로 간다.");
}

/* ══ 7. 지역 분포 ═══════════════════════════════════════════ */
{
  const s = lightSlide("COVERAGE", "지역 분포 — 도 › 시군구 › 동");
  s.addChart(p.ChartType.bar, [{
    name: "장소 수",
    labels: ["경기", "서울", "대전", "제주", "강원", "부산", "경남", "광주"],
    values: [386, 190, 67, 29, 28, 13, 5, 5],
  }], {
    x: 0.7, y: 2.0, w: 6.9, h: 3.7,
    barDir: "col",
    chartColors: [BLUE],
    showValue: true, dataLabelPosition: "outEnd",
    dataLabelFontSize: 11, dataLabelColor: INK2, dataLabelFontFace: F,
    catAxisLabelColor: INK, catAxisLabelFontSize: 12, catAxisLabelFontFace: F,
    valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
    showLegend: false, barGapWidthPct: 55,
  });
  card(s, 8.0, 2.0, 4.55, 3.7, ICE);
  s.addText("3단 드릴다운", { x: 8.38, y: 2.3, w: 3.9, h: 0.38, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 17, bold: true, color: INK });
  const drill = [["도 / 시", "경기 386 · 서울 190 · 대전 67"],
                 ["시군구", "용인시 처인구 · 강남구 · 유성구"],
                 ["동 / 읍면리", "정자동 · 양지면 · 은행동"]];
  drill.forEach(([t, d], i) => {
    const y = 2.92 + i * 0.88;
    s.addShape(p.ShapeType.ellipse, { x: 8.38, y: y, w: 0.34, h: 0.34, fill: { color: BLUE } });
    s.addText(String(i + 1), { x: 8.38, y: y + 0.05, w: 0.34, h: 0.24, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 11.5, bold: true, color: WHITE, align: "center" });
    s.addText(t, { x: 8.85, y: y - 0.02, w: 3.4, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 14, bold: true, color: INK });
    s.addText(d, { x: 8.85, y: y + 0.28, w: 3.45, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 11.5, color: INK2 });
  });
  s.addText("지도에서 가까운 핀은 “동네 이름 + 개수” 버블로 묶여, 숫자만 뜨는 클러스터보다 어디인지 바로 읽힙니다.", {
    x: 0.75, y: 6.0, w: 11.8, h: 0.4, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, color: INK2 });
  s.addNotes("경기·서울이 전체의 77%. 지역 필터는 3단으로 좁혀 들어간다.");
}

/* ══ 8. 핵심 기능 ═══════════════════════════════════════════ */
{
  const s = lightSlide("FEATURES", "핵심 기능 여섯");
  const fs = [
    ["지도 탐색", "테마 색 핀 + 동네 버블.\n지역·테마·기록을 조합해 필터", CAT[7][1]],
    ["내 별점", "장소마다 별 1~5개.\n같은 별을 다시 누르면 해제", GOLD],
    ["점수 정렬·필터", "내 별점순 / 네이버 평점순.\n★4 이상만 골라 보기", CAT[0][1]],
    ["방문 · 메모", "가봤어요 체크와 자유 메모.\n안 가본 곳만 걸러 보기", CAT[4][1]],
    ["AI 코스", "말로 요청하면 저장 장소로\n동선·시간까지 짜줌", CAT[3][1]],
    ["네이버 반영", "앱에서 지우면 네이버\n즐겨찾기에서도 삭제", CAT[2][1]],
  ];
  fs.forEach(([t, d, c], i) => {
    const x = 0.75 + (i % 3) * 4.05;
    const y = 2.05 + Math.floor(i / 3) * 2.15;
    card(s, x, y, 3.7, 1.85);
    s.addShape(p.ShapeType.ellipse, { x: x + 0.35, y: y + 0.32, w: 0.42, h: 0.42, fill: { color: c } });
    s.addText(t, { x: x + 0.92, y: y + 0.34, w: 2.6, h: 0.38, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 16, bold: true, color: INK });
    s.addText(d, { x: x + 0.35, y: y + 0.92, w: 3.05, h: 0.8, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12.5, color: INK2, lineSpacingMultiple: 1.3 });
  });
  s.addNotes("여섯 가지가 이 앱의 전부. 나머지는 이걸 받쳐주는 장치.");
}

/* ══ 9. 매뉴얼 - 홈 화면 ════════════════════════════════════ */
{
  const s = lightSlide("사용 매뉴얼 01", "지도 홈 — 어디에 뭐가 있나");
  const rows = [
    ["상단 검색 필드", "이름 · 지명 · 메뉴 · 설명으로 검색. 지명을 넣으면 그 지역 장소만 남습니다"],
    ["필터 칩 3개", "지역 · 테마 · 내 기록. 누르면 각각 드릴다운 시트가 열립니다"],
    ["지도 우측 ⟳", "네이버에서 지금 목록을 받아 지도에 즉시 반영"],
    ["지도 우측 ◎", "내 위치 표시. 켜면 '가까운 순' 정렬이 추가됩니다"],
    ["우하단 ✨", "AI 추천 코스 열기"],
    ["하단 시트", "손잡이를 탭하면 단계별로 확장. ∨ 를 누르면 완전히 숨겨집니다"],
  ];
  rows.forEach(([t, d], i) => {
    const y = 1.95 + i * 0.75;
    s.addShape(p.ShapeType.roundRect, { x: 0.75, y: y, w: 11.8, h: 0.62,
      rectRadius: 0.08, fill: { color: i % 2 ? WHITE : PAPER }, line: { color: i % 2 ? PAPER : PAPER } });
    dot(s, 1.05, y + 0.23, CAT[i][1], 0.16);
    s.addText(t, { x: 1.38, y: y + 0.14, w: 2.5, h: 0.34, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 14, bold: true, color: INK });
    s.addText(d, { x: 4.0, y: y + 0.15, w: 8.3, h: 0.34, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 13, color: INK2 });
  });
  s.addNotes("홈 화면 구성 요소를 위에서 아래 순서로.");
}

/* ══ 10. 매뉴얼 - 필터 ══════════════════════════════════════ */
{
  const s = lightSlide("사용 매뉴얼 02", "필터 세 개로 750곳을 좁힌다");
  const cols = [
    ["지역", CAT[7][1], ["도 / 시 선택", "시군구로 좁히기", "동 / 읍면리까지"], "경기 386 › 용인시 처인구 › 양지면"],
    ["테마", CAT[0][1], ["대분류 11종", "› 로 세부 종류", "칩에 선택 표시"], "음식점 272 › 한식 100"],
    ["내 기록", GOLD, ["가본 곳 / 안 간 곳", "★5 · ★4 이상 · ★3 이상", "나만의 리스트"], "★4 이상 → 내가 좋아한 곳만"],
  ];
  cols.forEach(([t, c, list, ex], i) => {
    const x = 0.75 + i * 4.05;
    card(s, x, 2.0, 3.7, 3.5);
    s.addShape(p.ShapeType.ellipse, { x: x + 0.35, y: 2.3, w: 0.44, h: 0.44, fill: { color: c } });
    s.addText(t, { x: x + 0.95, y: 2.33, w: 2.5, h: 0.4, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 18, bold: true, color: INK });
    s.addText(list.map((v, j) => ({ text: v, options: { bullet: true, breakLine: j < list.length - 1 } })), {
      x: x + 0.37, y: 2.95, w: 3.1, h: 1.4, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 13, color: INK2, paraSpaceAfter: 8 });
    s.addShape(p.ShapeType.roundRect, { x: x + 0.32, y: 4.5, w: 3.06, h: 0.72,
      rectRadius: 0.08, fill: { color: ICE }, line: { color: ICE } });
    s.addText(ex, { x: x + 0.48, y: 4.62, w: 2.78, h: 0.5, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 11.5, bold: true, color: BLUE_D, lineSpacingMultiple: 1.2 });
  });
  s.addText("세 필터는 자유롭게 겹칩니다.   예)  지역 = 강남구  ×  테마 = 카페  ×  ★4 이상", {
    x: 0.75, y: 5.85, w: 11.8, h: 0.4, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 14.5, bold: true, color: INK });
  s.addNotes("필터를 겹칠 수 있다는 게 핵심. 조합하면 750곳이 몇 곳으로 줄어든다.");
}

/* ══ 11. 매뉴얼 - 내 기록 ═══════════════════════════════════ */
{
  const s = lightSlide("사용 매뉴얼 03", "장소마다 내 평가를 남긴다");
  card(s, 0.75, 1.95, 5.75, 2.5, PAPER);
  s.addText("내 별점", { x: 1.1, y: 2.22, w: 3, h: 0.4, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 18, bold: true, color: INK });
  for (let i = 0; i < 5; i++) {
    s.addText("★", { x: 1.08 + i * 0.52, y: 2.78, w: 0.5, h: 0.5, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 30, color: i < 4 ? GOLD : "D5DDE5", align: "center" });
  }
  s.addText("4점", { x: 3.75, y: 2.9, w: 1, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 15, bold: true, color: INK2 });
  s.addText("장소 상세에서 별을 누르면 바로 저장됩니다. 같은 별을 다시 누르면 해제돼요.", {
    x: 1.1, y: 3.5, w: 5.1, h: 0.7, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, color: INK2, lineSpacingMultiple: 1.3 });

  const right = [
    ["가봤어요", "체크하면 목록·지도에 ✓ 가 붙고 살짝 흐려집니다", CAT[3][1]],
    ["내 메모", "자유롭게 적으면 자동 저장. 네이버 메모와는 별개입니다", CAT[4][1]],
    ["리스트에 추가", "나만의 리스트를 만들어 담기", CAT[2][1]],
  ];
  right.forEach(([t, d, c], i) => {
    const y = 1.95 + i * 0.87;
    card(s, 6.8, y, 5.75, 0.75, i % 2 ? PAPER : WHITE);
    dot(s, 7.12, y + 0.29, c, 0.17);
    s.addText(t, { x: 7.45, y: y + 0.09, w: 1.9, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 14, bold: true, color: INK });
    s.addText(d, { x: 7.45, y: y + 0.38, w: 4.9, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12, color: INK2 });
  });

  s.addShape(p.ShapeType.roundRect, { x: 0.75, y: 4.75, w: 11.8, h: 1.5,
    rectRadius: 0.12, fill: { color: "FFF4E0" }, line: { color: "F0DDBC" } });
  s.addText("⚠  이 기록은 이 기기(브라우저)에만 저장됩니다", {
    x: 1.15, y: 4.98, w: 10, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 15, bold: true, color: "8A5A12" });
  s.addText("별점·메모·방문 기록·나만의 리스트는 서버가 아니라 브라우저에 있습니다. 폰을 바꾸거나 브라우저 데이터를 지우면 사라져요.\n내 기록 화면 맨 아래 “기록 내보내기”로 가끔 백업해 두세요. 다른 기기에서는 “가져오기”로 합칠 수 있습니다.", {
    x: 1.15, y: 5.35, w: 11.1, h: 0.75, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12.5, color: "6A4E1E", lineSpacingMultiple: 1.3 });
  s.addNotes("가장 중요한 주의사항: 내 기록은 로컬 저장이다. 백업을 권한다.");
}

/* ══ 12. 매뉴얼 - 정렬 ══════════════════════════════════════ */
{
  const s = lightSlide("사용 매뉴얼 04", "점수 높은 순으로 골라 보기");
  const sorts = [
    ["추천순", "사진·리뷰 수 기반 기본값", INK3],
    ["내 별점순", "내가 매긴 별점이 높은 순", GOLD],
    ["네이버 평점순", "방문자 평점이 높은 순", CAT[0][1]],
    ["가까운 순", "내 위치를 켰을 때만 나타남", CAT[7][1]],
  ];
  sorts.forEach(([t, d, c], i) => {
    const x = 0.75 + i * 3.02;
    card(s, x, 2.05, 2.72, 1.6);
    dot(s, x + 0.32, 2.38, c, 0.18);
    s.addText(t, { x: x + 0.32, y: 2.62, w: 2.3, h: 0.35, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 15, bold: true, color: INK });
    s.addText(d, { x: x + 0.32, y: 3.0, w: 2.2, h: 0.55, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 11.5, color: INK2, lineSpacingMultiple: 1.25 });
  });
  s.addText("정렬은 목록 위에 항상 떠 있고, 필터와 함께 걸립니다", {
    x: 0.75, y: 3.9, w: 11.8, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 14, bold: true, color: INK });

  card(s, 0.75, 4.42, 11.8, 1.85, ICE);
  s.addText("이렇게 쓰면 좋아요", { x: 1.15, y: 4.65, w: 4, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 15, bold: true, color: INK });
  const uses = [
    "강남에서 저녁 → 지역 강남구 × 테마 음식점 × 내 별점순",
    "재방문할 카페 → 테마 카페 × ★4 이상 × 가본 곳",
    "새로 가볼 곳 → 안 간 곳 × 네이버 평점순",
  ];
  uses.forEach((u, i) => {
    const y = 5.08 + i * 0.36;
    dot(s, 1.2, y + 0.08, BLUE, 0.13);
    s.addText(u, { x: 1.5, y: y, w: 10.8, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 13, color: INK2 });
  });
  s.addNotes("정렬 + 필터 조합 예시를 실제 상황으로 보여준다.");
}

/* ══ 13. 매뉴얼 - AI 코스 ═══════════════════════════════════ */
{
  const s = lightSlide("사용 매뉴얼 05", "AI 코스 — 말로 시키면 동선을 짠다");
  card(s, 0.75, 1.95, 5.75, 4.3, PAPER);
  s.addText("이렇게 물어보세요", { x: 1.1, y: 2.22, w: 4, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 15, bold: true, color: INK });
  const qs = ["오늘 청담인데 저녁 먹고 디저트까지",
              "비 오는 날 조용한 카페",
              "부모님 모시고 갈 한식집",
              "강릉 1박 코스",
              "아직 안 가본 디저트"];
  qs.forEach((q, i) => {
    const y = 2.72 + i * 0.68;
    s.addShape(p.ShapeType.roundRect, { x: 1.1, y: y, w: 5.05, h: 0.52,
      rectRadius: 0.26, fill: { color: WHITE }, line: { color: "DCE5EF" } });
    s.addText("“" + q + "”", { x: 1.32, y: y + 0.13, w: 4.7, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12.5, color: INK2 });
  });

  card(s, 6.8, 1.95, 5.75, 4.3, ICE);
  s.addText("결과로 나오는 것", { x: 7.15, y: 2.22, w: 4, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 15, bold: true, color: INK });
  const outs = [
    ["코스 제목과 요약", "3곳 · 2.4km · 약 3시간"],
    ["지도 위 번호 경로", "1 → 2 → 3 순서와 점선 동선"],
    ["시간순 타임라인", "18:30 한식 · 20:20 디저트"],
    ["장소별 추천 이유", "왜 이 순서인지까지 설명"],
  ];
  outs.forEach(([t, d], i) => {
    const y = 2.75 + i * 0.85;
    s.addShape(p.ShapeType.ellipse, { x: 7.15, y: y, w: 0.36, h: 0.36, fill: { color: BLUE } });
    s.addText(String(i + 1), { x: 7.15, y: y + 0.06, w: 0.36, h: 0.25, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12, bold: true, color: WHITE, align: "center" });
    s.addText(t, { x: 7.65, y: y - 0.02, w: 4.6, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 14, bold: true, color: INK });
    s.addText(d, { x: 7.65, y: y + 0.28, w: 4.6, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12, color: INK2 });
  });
  s.addText("코스는 내가 저장한 750곳 안에서만 짜집니다. 거리·소요시간·이동수단은 좌표로 계산돼요.", {
    x: 0.75, y: 6.45, w: 11.8, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, color: INK2 });
  s.addNotes("엔진은 Gemini. 저장 장소 안에서만 고르기 때문에 '가본 적 없는 엉뚱한 곳'이 나오지 않는다.");
}

/* ══ 14. 최신화 2겹 ═════════════════════════════════════════ */
{
  const s = lightSlide("SYNC", "최신화는 두 겹으로 돈다");
  const layers = [
    ["겹 1", "앱에서 즉시", "⟳ 버튼 · 24시간마다 자동", BLUE,
      ["새로 저장한 장소가 즉시 지도에 추가", "네이버에서 지운 장소는 즉시 사라짐", "사진·평점은 아직 안 붙음 (‘새로 추가’ 표시)"]],
    ["겹 2", "매일 새벽 2시", "GitHub Actions 자동 실행", CAT[4][1],
      ["사진·평점·메뉴까지 완전히 채움", "겹1에서 비어 있던 장소가 채워짐", "빌드 후 자동 배포까지"]],
  ];
  layers.forEach(([no, t, sub, c, list], i) => {
    const x = 0.75 + i * 6.15;
    card(s, x, 1.95, 5.65, 3.3);
    s.addShape(p.ShapeType.roundRect, { x: x + 0.35, y: 2.25, w: 0.85, h: 0.42,
      rectRadius: 0.1, fill: { color: c }, line: { color: c } });
    s.addText(no, { x: x + 0.35, y: 2.33, w: 0.85, h: 0.28, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 13, bold: true, color: WHITE, align: "center" });
    s.addText(t, { x: x + 1.35, y: 2.24, w: 4, h: 0.4, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 19, bold: true, color: INK });
    s.addText(sub, { x: x + 0.35, y: 2.82, w: 5, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12.5, bold: true, color: c });
    s.addText(list.map((v, j) => ({ text: v, options: { bullet: true, breakLine: j < list.length - 1 } })), {
      x: x + 0.37, y: 3.28, w: 5.0, h: 1.7, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12.5, color: INK2, paraSpaceAfter: 8 });
  });
  s.addShape(p.ShapeType.roundRect, { x: 0.75, y: 5.5, w: 11.8, h: 1.1,
    rectRadius: 0.12, fill: { color: "FFF4E0" }, line: { color: "F0DDBC" } });
  s.addText("겹 2를 켜려면 GitHub Secrets 두 개가 필요합니다", {
    x: 1.15, y: 5.68, w: 10, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 14, bold: true, color: "8A5A12" });
  s.addText("NAVER_COOKIE (네이버 로그인 쿠키)  ·  CLOUDFLARE_API_TOKEN (없으면 데이터만 커밋되고 배포는 안 됨)", {
    x: 1.15, y: 6.04, w: 11.1, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12.5, color: "6A4E1E" });
  s.addNotes("왜 두 겹인지: 사진 수집이 장소당 1.4초라 브라우저에서 못 한다. 그래서 즉시 반영과 완전 반영을 나눴다.");
}

/* ══ 15. 아키텍처 ═══════════════════════════════════════════ */
{
  const s = lightSlide("ARCHITECTURE", "무엇으로 만들었나");
  const stack = [
    ["프론트", "바닐라 JS + Leaflet", "프레임워크 없이 단일 파일 구조.\n지도는 Leaflet + CARTO 타일", CAT[7][1]],
    ["호스팅", "Cloudflare Pages", "정적 배포 + 엣지 함수.\n비밀번호(Basic Auth)로 보호", CAT[4][1]],
    ["수집·빌드", "Python", "즐겨찾기 수집 → 보강 → 분류 →\nplaces.json 생성", CAT[1][1]],
    ["AI", "Gemini", "코스 생성. 실패 시 자동으로\n간이 추천으로 폴백", CAT[3][1]],
  ];
  stack.forEach(([t, name, d, c], i) => {
    const x = 0.75 + i * 3.02;
    card(s, x, 2.05, 2.72, 2.85);
    dot(s, x + 0.32, 2.38, c, 0.18);
    s.addText(t, { x: x + 0.32, y: 2.62, w: 2.3, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12, bold: true, color: INK3 });
    s.addText(name, { x: x + 0.32, y: 2.92, w: 2.3, h: 0.4, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 15.5, bold: true, color: INK });
    s.addText(d, { x: x + 0.32, y: 3.42, w: 2.25, h: 1.2, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 11.5, color: INK2, lineSpacingMultiple: 1.3 });
  });
  card(s, 0.75, 5.15, 11.8, 1.2, PAPER);
  s.addText("안전장치 — 네이버 원본을 건드리는 기능은 3중 잠금", {
    x: 1.15, y: 5.33, w: 8, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 14, bold: true, color: INK });
  s.addText("①  쿠키가 없으면 아무것도 실행되지 않음      ②  쓰기 스위치가 켜져 있어야 허용      ③  삭제 전 “무엇이 지워지는지” 미리보기 확인", {
    x: 1.15, y: 5.68, w: 11.1, h: 0.58, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12.5, color: INK2, lineSpacingMultiple: 1.25 });
  s.addNotes("프레임워크를 안 쓴 이유는 개인용이고 가볍게 유지하기 위해서. 삭제는 되돌릴 수 없어 안전장치를 겹으로 걸었다.");
}

/* ══ 16. 현황 & 남은 것 ═════════════════════════════════════ */
{
  const s = darkSlide();
  s.addText("STATUS", { x: 0.9, y: 0.72, w: 6, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12, bold: true, color: "7FB0F0", charSpacing: 3 });
  s.addText("지금 어디까지 왔나", { x: 0.9, y: 1.05, w: 9, h: 0.65, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 34, bold: true, color: WHITE });

  const done = ["네이버 즐겨찾기 750곳 수집·분류·배포", "테마 11종 · 지역 3단 · 검색",
                "별점 · 방문 · 메모 · 점수 정렬/필터", "AI 코스 · 폰/PC 반응형",
                "실시간 갱신 · 앱에서 삭제하면 네이버에도 반영"];
  const todo = ["매일 자동 갱신 — GitHub Secrets 2개 등록 필요",
                "내 기록이 기기에만 저장 — 백업 권장",
                "네이버 메모·이름 수정은 범위에서 제외",
                "앱에서 새 장소 추가는 불가 (네이버에서 저장)"];

  s.addShape(p.ShapeType.roundRect, { x: 0.9, y: 2.1, w: 5.7, h: 3.65,
    rectRadius: 0.12, fill: { color: "1E2C3D" }, line: { color: "1E2C3D" } });
  dot(s, 1.25, 2.44, CAT[4][1], 0.2);
  s.addText("된 것", { x: 1.6, y: 2.35, w: 3, h: 0.38, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 17, bold: true, color: WHITE });
  s.addText(done.map((v, j) => ({ text: v, options: { bullet: true, breakLine: j < done.length - 1 } })), {
    x: 1.27, y: 2.9, w: 5.1, h: 2.7, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, color: "CADCFC", paraSpaceAfter: 10 });

  s.addShape(p.ShapeType.roundRect, { x: 6.9, y: 2.1, w: 5.55, h: 3.65,
    rectRadius: 0.12, fill: { color: "1E2C3D" }, line: { color: "1E2C3D" } });
  dot(s, 7.25, 2.44, GOLD, 0.2);
  s.addText("남은 것", { x: 7.6, y: 2.35, w: 3, h: 0.38, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 17, bold: true, color: WHITE });
  s.addText(todo.map((v, j) => ({ text: v, options: { bullet: true, breakLine: j < todo.length - 1 } })), {
    x: 7.27, y: 2.9, w: 4.95, h: 2.7, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, color: "CADCFC", paraSpaceAfter: 10 });

  s.addText("favplace-map.pages.dev", { x: 0.9, y: 6.15, w: 7, h: 0.4, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 16, bold: true, color: WHITE });
  s.addText("2026.09.04 기준 · 750곳", { x: 8.5, y: 6.2, w: 3.95, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, color: INK3, align: "right" });
  s.addNotes("마무리: 원래 요구했던 것은 모두 구현됐고, 남은 것은 운영 설정과 의도적으로 범위에서 뺀 것들이다.");
}

p.writeFile({ fileName: "하영의지도_기획안_매뉴얼.pptx" }).then(f => console.log("생성:", f));
