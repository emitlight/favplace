# Handoff: 지도 홈 (1b) + AI 추천 코스 (2a·2b) — "하영의 지도"

## Overview
개인용 웹앱 "하영의 지도"(네이버 지도 즐겨찾기 726곳을 대한민국 지도 위에서 탐색 + AI 코스 추천)의
UI 고도화 시안입니다. 기존 앱(`app/index.html`, `app/css/style.css`, `app/js/app.js`, Leaflet + markercluster)의
기능은 그대로 두고, **지도 홈**과 **AI 추천 코스** 화면의 시각 디자인을 교체하는 것이 목표입니다.

승인된 시안 3장:
- **1b — 지도 홈**: 지도 우선 + 미니멀 바텀시트 리스트 (블루 계열, 라이트 모드)
- **2a — AI 코스 입력**: 프롬프트 카드 + 예시 칩 + 최근 코스
- **2b — AI 코스 결과**: 블루 모노톤 지도 + 번호 경로 + 타임라인 리스트

## About the Design Files
번들의 `.dc.html` 파일은 **HTML로 만든 디자인 레퍼런스**입니다. 의도한 룩앤필과 배치를 보여주는
프로토타입이며, 그대로 복사해 배포할 production 코드가 아닙니다.
구현 과제는 이 시안을 **대상 코드베이스의 기존 환경에 다시 만드는 것**입니다.
이 프로젝트의 대상 환경은 이미 존재합니다: **바닐라 JS + Leaflet 1.9.4 + CSS 변수 기반 디자인 시스템
(`app/css/style.css`), Pretendard 웹폰트, Cloudflare Pages 배포**. 따라서 새 프레임워크를 도입하지 말고
기존 `style.css`의 토큰과 `app.js`의 렌더 함수를 수정/확장하는 방식으로 반영하세요.

## Fidelity
**High-fidelity.** 색상·타이포·간격·반경·그림자 값이 확정되어 있습니다. 아래 토큰과 스펙 그대로 재현하세요.
단, 시안은 정지 화면(static)이므로 인터랙션은 "Interactions & Behavior" 절의 서술을 따릅니다.

기준 캔버스: **390 × 844 px (iPhone 14 논리 해상도)**. 상태바 54px, 하단 홈 인디케이터 34px 반영.
디자인은 `dvh` 기준 풀스크린 앱 셸을 가정합니다(기존 `.app{height:100dvh}` 유지).

---

## Design Tokens

### Colors — 지도 홈 / AI 코스 공통 (블루, 라이트 온리)
| 역할 | 값 | 비고 |
|---|---|---|
| 앱 배경 (지도 홈) | `#EDF1F6` | 지도 미로드 시 바탕 |
| 앱 배경 (AI 코스) | `#F3F7FB` | 살짝 더 밝은 쿨 화이트 |
| 지도 타일 바탕 | `#E6EDF4` (홈) / `#E3EBF3` (코스) | |
| Surface (시트·카드) | `#FFFFFF` | |
| Accent (Primary) | `oklch(0.58 0.15 255)` ≈ `#3B7DE0` | 선택 칩, CTA, 번호 핀, 링크 |
| Accent hover/pressed | `oklch(0.52 0.15 255)` ≈ `#2E6BC8` | |
| Accent 12% 배경 | `oklch(0.58 0.15 255 / .1)` | 최근 코스 원형 배지 |
| Ink (본문 강) | `#16202B` (홈) / `#16232F`·`#0F1C29` (코스 제목) | |
| Ink 2 (보조) | `#5A6B7C` / `#3E4E5E` | |
| Ink 3 (약) | `#8C9BAA`, `#9AA8B6`, `#8FA1B4`, `#7C8CA0` | 캡션·플레이스홀더 |
| Hairline | `rgba(20,50,80,.06)` ~ `.11` | 리스트 구분선 |
| Border (칩·아웃라인) | `rgba(20,50,80,.07)` ~ `.13` | |
| 카테고리 — 음식점/한식·양식 | `oklch(0.66 0.15 25)` ≈ `#E06A56`, 배경 `/ .1` | 태그 |
| 카테고리 — 카페/디저트 | `oklch(0.72 0.13 55)` ≈ `#E0904F`, 배경 `/ .13` | 태그·핀 도트 |
| 별점 | `oklch(0.72 0.13 75)` ≈ `#D9992F` | ★ 텍스트 |
| 현재 위치 / OK | `oklch(0.70 0.14 155)` ≈ `#33B07A` | 작은 도트 |
| 다크 강조 (홈 정렬칩) | `#16202B` | 선택된 "가까운 순" 칩 |

다크모드는 이번 범위에서 제외(사용자 요청: 라이트만). 기존 `@media (prefers-color-scheme:dark)` 블록은
남겨도 되지만 신규 화면은 라이트 값으로 고정하세요.

### Typography
- Family: `Pretendard` (기존 CDN 그대로), fallback `-apple-system, system-ui, sans-serif`
- 화면 제목 (코스 결과): 26px / 700 / letter-spacing `-.03em` / line-height 1.15
- 대제목 (코스 입력): 32px / 700 / `-.035em` / 1.15
- 시트 헤더 (강남구): 19px / 700 / `-.02em`
- 장소명 (리스트 행): 15.5px / 600 / `-.01em`
- 장소명 (코스 타임라인): 16.5px / 700 / `-.025em`
- 본문·설명: 12.5px / 400 / line-height 1.45~1.55, `text-wrap: pretty`
- 메타 (평점·거리): 12px / 500~600
- 칩: 12.5px / 500 (비선택), 12.5~13px / 600 (선택), `white-space: nowrap`
- 키커(전체 대문자 라벨): 10.5px / 500 / letter-spacing `.13em`~`.16em` / 색 `#8FA1B4`
- 카테고리 태그: 10.5px / 600
- CTA 버튼: 15px / 700
- 상태바 시각: 14px / 600

### Radius
`3px` (에디토리얼 썸네일) · `12px` (핀 라벨) · `16~18px` (칩·작은 CTA) · `18px` (리스트 썸네일)
· `20px` (프롬프트 카드) · `23px`/`26px` (검색 필드·큰 CTA, pill) · `30px 30px 0 0` (바텀시트)
· `50%` (아이콘 버튼·핀)

### Shadows
- 떠 있는 컨트롤: `0 6px 18px rgba(46,96,145,.1)`
- 카드: `0 10px 30px rgba(46,96,145,.08)`
- 지도 위 핀/버블: `0 8px 18px rgba(40,90,140,.18)`
- 바텀시트: `0 -14px 40px rgba(40,90,140,.14)`
- Accent 버튼: `0 8px 20px oklch(0.58 0.15 255 / .3)` (큰 CTA는 `0 10px 24px … / .32`)

### Spacing
좌우 기본 거터 **16px** (지도 홈) / **24px** (AI 코스). 수직 리듬 6 · 10 · 12 · 14 · 16 · 22px.
칩 간격 7~8px, 리스트 행 패딩 `14~15px 22px`, 썸네일-텍스트 간격 14px.

---

## Screens / Views

### 1) 지도 홈 (시안 1b)
**Purpose** 저장한 장소를 지도에서 탐색하고, 현재 보이는 영역/지역의 목록을 시트에서 훑는다.

**Layout** (위 → 아래, 전부 `position:absolute` 오버레이 on 지도)
1. 지도: `inset:0`, Leaflet. 상단에 `linear-gradient(180deg, rgba(238,243,248,.86) 0, rgba(238,243,248,0) 22%)`
   스크림을 깔아 상단 컨트롤 가독성 확보.
2. 상태바 영역 54px (실기기에서는 `env(safe-area-inset-top)`).
3. **검색 바** `top:62px; left/right:16px`, 높이 46px, `flex:1`, 배경 `rgba(255,255,255,.96)`, radius 23px,
   좌측 18px 검색 아이콘(stroke `#9AA8B6`, 2px), 플레이스홀더 "어디로 가볼까요" 14.5px `#9AA8B6`.
   우측에 46px 원형 프로필 버튼 (배경 흰색, 텍스트 "하영" 13px/700 `#3E4E5E`), 간격 10px.
4. **필터 칩 행** `top:122px`, 좌우 16px, gap 7px, `white-space:nowrap` (횡스크롤).
   선택 칩: 배경 `#16202B`, 흰 글씨, 600. 비선택: `rgba(255,255,255,.9)` + `1px solid rgba(20,50,80,.07)`, `#5A6B7C`.
   순서: `가까운 순`(선택) · `카페` · `음식점` · `미방문`.
5. **동네 카운트 버블** (클러스터 대체 표현): 높이 36px pill, `padding:0 14px 0 10px`, 흰 배경,
   좌측 9px 카테고리 색 도트, 라벨 12.5px/600 `#16202B`. 선택된 버블은 배경 accent + 흰 글씨/흰 도트,
   그림자 `0 10px 22px oklch(0.58 0.15 255/.34)`.
   시안 좌표(390px 기준): `신사동 24` (64,210) · `청담동 11` (196,274) · `역삼동 18` (104,340, 선택).
6. **현재 위치 점**: 14px 원, 배경 `#16202B`, `3px solid #fff`, 그림자 `0 4px 10px rgba(0,0,0,.2)`.
7. **바텀시트**: `bottom:0`, 높이 452px (= 화면의 53.5%), 흰 배경, radius `30px 30px 0 0`,
   그림자 `0 -14px 40px rgba(40,90,140,.14)`.
   - 핸들: 38×4px, `#DCE4EC`, radius 2px, 상단 10px, 아래 14px 여백.
   - 헤더 행: 좌측 "강남구" 19px/700 + "저장 69곳" 13px/500 `#9AA8B6` (baseline 정렬, gap 8px),
     우측 "지도 새로고침" 12.5px/600 accent. 패딩 `0 22px 14px`.
   - 리스트 행 (반복): 상단 `1px solid rgba(20,50,80,.06)`, 패딩 `14px 22px`, gap 14px.
     · 썸네일 66×66, radius 18px, `object-fit:cover`
     · 1행: 장소명 15.5px/600 + 카테고리 태그(10.5px/600, `padding:2.5px 7px`, radius 8px, 카테고리 색 10~13% 배경)
     · 2행: 한 줄 소개 12.5px `#8C9BAA` (데이터의 `mc` 필드)
     · 3행: `★ 4.62` (별점색 600) ` · 청담동 · 1.2km` 12px/500 `#5A6B7C`
   - 시안의 4개 행: 밍글스(한식) / 벙커컴퍼니 압구정점(디저트) / 빌즈 강남(양식) / 허머스키친(한식)
8. 홈 인디케이터: 132×5px, `#16202B` 85%.

**Data mapping** (`app/data/places.json`): `n` 장소명 · `c1/c2` 카테고리 태그 · `mc` 한 줄 소개 ·
`sc` 평점 · `rv` 리뷰수 · `dong`·`gu`·`sido` 지역 · `ph[0]` 썸네일 · `la/lo` 좌표.
시트 헤더 카운트는 `meta.json`의 `regions[sido][gu]`.

### 2) AI 코스 입력 (시안 2a)
**Purpose** 자연어로 상황을 입력해 저장 장소 기반 코스를 생성한다. 기존 `#recommend` 오버레이 대체.

**Layout** (배경 `#F3F7FB`, 거터 24px)
1. `top:64px` 헤더: 40px 원형 뒤로가기(테두리 `1px solid rgba(20,50,80,.13)`, chevron 1.8px stroke),
   우측 키커 "AI COURSE" 11.5px/500 `.16em` `#8FA1B4`.
2. `top:132px` 타이틀 블록: "오늘 뭐 하고<br>싶으세요?" 32px/700 `-.035em` `#0F1C29`,
   그 아래 설명 13.5px/1.55 `#7C8CA0`: "저장한 726곳 중에서 지금 위치와 기분에 맞는 코스를 짜드려요."
3. `top:268px` **프롬프트 카드**: 흰 배경, radius 20px, `1px solid rgba(20,50,80,.07)`,
   그림자 `0 10px 30px rgba(46,96,145,.08)`, 패딩 `18px 18px 14px`.
   - 입력 텍스트 15px/1.5 `#16232F` (시안 예시: "오늘 청담인데 저녁 먹고 디저트까지 가고 싶어"),
     캐럿은 1.5×17px accent 바 (실제 구현은 `textarea` + auto-grow).
   - 하단 구분선 `1px solid rgba(20,50,80,.07)` 위 13px 여백.
   - 좌: 7px 초록 도트 + "현재 위치 · 청담동" 12px/600 `#7C8CA0`.
   - 우: "코스 만들기" 버튼 — accent 배경, 흰 13px/700, `padding:8px 16px`, radius 16px,
     그림자 `0 8px 20px oklch(0.58 0.15 255/.3)`.
4. `top:452px` **예시 칩**: 키커 "이렇게 물어보세요" + wrap 칩 4개
   (`비 오는 날 조용한 카페` / `부모님 모시고 한식` / `강릉 1박 코스` / `아직 안 가본 디저트`).
   칩: 흰 배경, `1px solid rgba(20,50,80,.08)`, radius 18px, `padding:9px 14px`, 12.5px/500 `#3E4E5E`.
   탭하면 프롬프트에 삽입.
5. `top:588px` **최근 만든 코스**: 키커 + 행 2개. 행 = 38px 원형 배지(accent 10% 배경, 장소 수 12.5px/700
   `oklch(0.52 0.15 255)`) + 제목 14.5px/700 + 메타 11.5px/500 `#8FA1B4` + 우측 chevron 16px `#B4C0CD`.
   행 상단 구분선 `1px solid rgba(20,50,80,.1)`, 패딩 `15px 0`.

### 3) AI 코스 결과 (시안 2b)
**Purpose** 생성된 코스를 지도 경로 + 시간순 리스트로 확인하고 길찾기로 넘어간다.

**Layout**
1. **상단 지도** `top:0`, 높이 396px, `overflow:hidden`.
   타일에 블루 모노톤 필터: `grayscale(1) brightness(1.02) sepia(.28) hue-rotate(178deg) saturate(2.1)`.
   위에 스크림 `linear-gradient(180deg, rgba(243,247,251,.96) 0, rgba(243,247,251,.08) 22%, rgba(243,247,251,.06) 62%, rgba(243,247,251,1) 100%)`
   → 지도 아래쪽이 배경으로 자연스럽게 사라짐(하드 엣지 없음).
2. `top:64px` 좌측 40px 원형 뒤로가기(흰 90% 배경 + `0 4px 14px rgba(46,96,145,.12)`),
   우측 "다시 만들기" 34px pill(같은 흰 배경/그림자, 12px/600 `#3E4E5E`).
3. **번호 핀** 40px 원, 방문 순서. 1·2번은 accent 채움 + 흰 숫자 13.5px/700 +
   그림자 `0 8px 18px oklch(0.58 0.15 255/.38)`; 3번(마지막/미정)은 흰 배경 + `1.5px solid accent` + accent 숫자.
   각 핀 우측 8px 간격으로 라벨 chip: `rgba(255,255,255,.92)`, radius 12px, `padding:5px 10px`, 12px/700 `#0F1C29`.
   시안 좌표: 1 (56,150) 밍글스 · 2 (168,236) 해피해피케이크 · 3 (36,284) 벙커컴퍼니.
4. **경로 점선**: 2px 높이 div, `repeating-linear-gradient(90deg, accent 0 5px, transparent 5px 10px)`,
   `transform-origin:left center`로 회전. 시안: (96,172) w88 `rotate(37deg)`, (188,256) w140 `rotate(160deg)`.
   실제 구현은 Leaflet `L.polyline`에 `dashArray:'5 5'`, `color: accent`, `weight:2`로 대체.
5. `top:330px` 코스 요약: 키커 "청담 · 오늘 저녁" → 제목 "저녁 한 상, 그리고 디저트" 26px/700 `-.03em`
   → 메타 "3곳 · 2.4km · 약 3시간 · 모두 도보" 12.5px/500 `#7C8CA0`.
6. `top:470px` **타임라인 리스트** (거터 24px, 행 상단 `1px solid rgba(20,50,80,.11)`, 패딩 `15px 0`, gap 14px):
   · 좌측 레일: 22px 원형 순번(accent, 흰 11px/700) + 아래로 이어지는 `1px` 세로선 `rgba(20,50,80,.14)`
   · 썸네일 66×80, radius 3px (에디토리얼 톤: 정사각 아님)
   · 키커 "18:30 — 한식 · 청담동" / 두 번째 행은 "20:20 — 케이크 · 도보 9분" (시간 + 카테고리 + 이동수단)
   · 장소명 16.5px/700 `-.025em`
   · 한 줄 소개 12.5px/1.45 `#7C8CA0`
   · 메타 11.5px/600 `#16232F`: "★ 4.62 · 리뷰 777 · 예약 권장" / "★ 4.41 · 리뷰 418 · 21시 마감"
7. **하단 액션 바** `bottom:0`, 높이 104px, 배경 `rgba(243,247,251,.94)`,
   상단 `1px solid rgba(20,50,80,.08)`, 패딩 `16px 24px 0`, gap 10px.
   좌: 52px 원형 아이콘 버튼(핀 아이콘, `1px solid rgba(20,50,80,.13)`).
   우: `flex:1` 52px CTA "네이버 지도로 길찾기" — accent 배경, 흰 15px/700, radius 26px,
   그림자 `0 10px 24px oklch(0.58 0.15 255/.32)`.

---

## Interactions & Behavior

### 지도 홈
- 칩 탭 → 카테고리/정렬 필터 즉시 적용, 지도 마커·시트 리스트 동시 갱신. 선택 칩만 다크 채움.
- 동네 버블 탭 → 해당 동으로 `map.flyTo` (0.5s), 시트가 그 동의 목록으로 교체, 버블은 accent 선택 상태.
- 시트: 3단 스냅 — peek 120px / 기본 452px / 확장 `calc(100dvh - 200px)`. 드래그 제스처,
  `transform: translateY()` + `cubic-bezier(.2,.8,.2,1) .28s`. 시트가 기본 이상으로 올라가면 지도는 정지.
- 리스트 행 탭 → 장소 상세(별도 시안 예정). 행 pressed: 배경 `rgba(20,50,80,.03)`, 0.12s.
- "지도 새로고침" → 현재 보이는 bounds 기준으로 목록 재조회.
- 지도 이동 후 100ms debounce로 시트 헤더 지역명/카운트 갱신.
- 마커는 zoom < 12에서 동네 버블(카운트), zoom ≥ 12에서 개별 핀으로 전환 (기존 markercluster 유지 가능).

### AI 코스
- 예시 칩 탭 → 프롬프트에 텍스트 삽입 + 포커스. 칩 pressed: 배경 `rgba(20,50,80,.04)`.
- "코스 만들기" → 로딩 상태: 버튼 텍스트를 "코스 짜는 중"으로 바꾸고 accent 24% 배경의 shimmer
  스켈레톤 3행을 리스트 위치에 표시. 실패 시 카드 하단에 12.5px `#E24B4A` 에러 문구 + 재시도.
  (백엔드: 기존 `app/functions/recommend.js`, 실패 시 기기 내 휴리스틱 폴백)
- 결과 진입: 지도 핀은 순번대로 60ms 간격 `scale(.6)→1` (0.28s, `cubic-bezier(.2,.8,.2,1)`),
  점선 경로는 `stroke-dashoffset` 0.5s로 그려짐.
- 타임라인 행 탭 → 장소 상세. 롱프레스/드래그로 순서 변경(추후 범위).
- "다시 만들기" → 2a로 복귀하며 이전 프롬프트 유지.
- CTA → 네이버 지도 앱 딥링크(`nmap://route/public?...`), 미설치 시 웹 URL 폴백.
- 접근성: 모든 탭 타깃 최소 44×44 확보(칩은 높이 34~36px이므로 터치 영역을 `padding`/`::before`로 확장),
  accent 위 흰 글씨 대비 4.5:1 이상 확인됨.

## State Management
```
// 지도 홈
mapCenter, mapZoom, visibleBounds
filter: { cat: null|'카페'|'음식점'|…, sort: 'near'|'saved', unvisitedOnly: bool }
selectedDong: string|null
sheetSnap: 'peek'|'default'|'expanded'
listItems: Place[]        // bounds/filter로 파생
regionHeader: { gu: string, count: number }

// AI 코스
prompt: string
geo: { lat, lng, dong } | null
status: 'idle'|'loading'|'error'|'done'
course: { title, kicker, distanceKm, durationMin, stops: [{ order, placeId, eta, mode, note }] }
recentCourses: Course[]   // localStorage
```
데이터 페칭: `app/data/places.json` + `meta.json`(정적, 앱 부팅 시 1회, SW 캐시),
코스 생성은 `POST /recommend` (Cloudflare Function).

## Assets
- **폰트**: Pretendard v1.3.9 (기존 jsDelivr CDN 그대로).
- **아이콘**: 전부 인라인 SVG, 24 그리드, `fill:none; stroke:currentColor; stroke-width:1.8~2;
  stroke-linecap:round; stroke-linejoin:round`. 사용 아이콘: 검색, 위치(핀), 현재위치(크로스헤어),
  chevron(좌/우), 홈, 그리드, 리스트, 프로필, 스파클(AI). 별점은 텍스트 `★`.
- **지도 타일**: 시안은 CARTO Basemaps(`light_all`, `light_nolabels`) 래스터 타일을 사용했습니다.
  실제 앱은 라이선스/한국 지명 품질을 고려해 네이버·카카오 또는 VWorld 타일로 교체하세요.
  블루 모노톤은 타일 위 CSS `filter`로 구현(위 2b 값 참고).
- **사진**: 네이버 `ldb-phinf.pstatic.net` 원본 URL을 그대로 사용(데이터의 `ph` 배열).
  핫링크 가능하지만 `loading="lazy"` + `decoding="async"` 권장, 실패 시 카테고리 색 플레이스홀더.

## Files
- `지도 홈 시안.dc.html` — 승인 시안 전체 (turn 2 = AI 코스 2a/2b, turn 1 = 지도 홈 1a/1b/1c).
  구현 대상은 **1b, 2a, 2b**. 1a/1c는 폐기된 대안이며 참고용.
- 원본 앱 소스는 이 저장소의 `app/` (index.html, css/style.css, js/app.js, functions/recommend.js).

## Out of scope (다음 단계)
장소 상세, 사진 갤러리, 내 기록, 진입 게이트, 다크모드, 코스 순서 편집 UI.
