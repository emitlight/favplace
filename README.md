# 하영의 지도 🗺️

네이버 지도 즐겨찾기(저장) 700여 곳을, 대한민국 지도 + 사진으로 한눈에 둘러보고
AI가 상황에 맞는 코스를 추천해주는 **개인용 웹앱** (모바일 우선).

## 기능
- 🗺 대한민국 지도 위 장소 분포(카테고리 색·클러스터) + 필터
- 📍 장소 상세: 사진 캐러셀(대표/방문자) · 평점 · 리뷰 · 메뉴 · 키워드
- 🔎 검색 · 🖼 사진 갤러리(무한스크롤) · 📡 위치기반 "근처 추천"
- 🤖 AI 추천 코스: 기분/상황 입력 → 내 저장 장소로 코스 생성
- 🔒 비밀번호 게이트 (실배포는 Cloudflare Access로 접근제어)

## 구조
```
app/                정적 웹앱 (Cloudflare Pages 배포 대상)
  index.html  css/  js/  data/places.json
scripts(루트)       데이터 파이프라인
  fetch_bookmarks.py  enrich.py  build_data.py
.github/workflows/  매일 새벽 자동 갱신 (예정)
worker/             AI 추천 Cloudflare Worker (예정)
NOTES_api.md        네이버 비공개 API 메모
```

## 데이터 파이프라인
1. `fetch_bookmarks.py` — 네이버 즐겨찾기 목록 수집 (로그인 쿠키 필요)
2. `enrich.py` — 장소별 사진·카테고리·평점·폐업 수집 (공개 API)
3. `build_data.py` — 병합 → `app/data/places.json`

## 배포 (요약)
- 호스팅: Cloudflare Pages + Access(비밀번호)
- 자동화: GitHub Actions (매일 새벽 1→2→3 실행 후 커밋·배포)
- AI: Cloudflare Worker + Claude API (선택; 없으면 기기 내 휴리스틱)

> ⚠️ 개인정보(집 주소·주거지 포함) 때문에 저장소는 **비공개**, 사이트는 **접근제어** 필수.
