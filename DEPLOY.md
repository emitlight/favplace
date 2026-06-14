# 배포 가이드 — 하영의 지도

순서대로 따라하면 됩니다. (필요한 것: GitHub, Cloudflare, 무료 Gemini 키, 네이버 쿠키)

## 0. 비밀번호 정하기
`app/js/config.js` 의 `PASS` 를 원하는 값으로 변경.

## 1. GitHub (비공개 저장소)
```powershell
# 저장소 생성 후 (웹에서 New repository → Private)
git remote add origin https://github.com/<아이디>/hayoung-map.git
git push -u origin main
```
> gh CLI가 있으면: `gh repo create hayoung-map --private --source=. --push`

## 2. Cloudflare Pages (호스팅 + AI 함수)
1. Cloudflare 대시보드 → Workers & Pages → Create → Pages → Connect to Git → `emitlight/favplace` 선택
2. 빌드 설정: Framework preset=None, Build command=(비움), **Root directory(고급) = `app`**, Build output directory = `/`(기본값)
   → 정적 사이트(`app/*`)와 AI 함수(`app/functions/recommend.js` → `/recommend`)가 함께 배포됨
3. Deploy → `https://favplace.pages.dev` 같은 주소 생성

## 3. 비밀번호 접근제어 (Cloudflare Access — 무료)
Zero Trust → Access → Applications → Add → Self-hosted
- 도메인: 위 Pages 주소
- 정책: 본인 이메일만 허용(One-time PIN) → 링크 열면 이메일 인증 후 입장
> 이러면 URL을 알아도 인증 없이는 못 봅니다(집 주소 등 보호).

## 4. AI 추천 (Gemini, Pages Function)
AI는 사이트에 함께 배포되는 `app/functions/recommend.js`가 처리(별도 배포 불필요). 클라이언트는 `/recommend` 호출.
1. https://aistudio.google.com → Get API key (무료)
2. Cloudflare Pages 프로젝트 → Settings → **Environment variables** → Production에 추가:
   - 이름 `GEMINI_KEY`, 값 = 발급한 키, **Encrypt** 체크
3. Deployments → 최신 배포 **Retry deployment**(또는 새 push)로 키 반영
> 키 미설정 시 기기 내 휴리스틱 추천으로 자동 폴백(키 없이도 동작).

## 5. 매일 새벽 자동 갱신 (GitHub Actions)
1. 네이버 쿠키 추출: 로그인된 map.naver.com → F12 → Console:
   ```js
   copy(document.cookie)
   ```
   (또는 Application → Cookies 에서 `NID_AUT`, `NID_SES` 조합)
2. GitHub 저장소 → Settings → Secrets and variables → Actions → New secret
   - 이름 `NAVER_COOKIE`, 값 = 복사한 쿠키 문자열
3. Actions 탭 → "매일 즐겨찾기 갱신" → Run workflow 로 1회 테스트
> 매일 KST 04:00 자동 실행. 신규 장소만 보강하므로 빠름. 쿠키 만료 시 2번만 다시.

## 갱신 흐름
`fetch_bookmarks.py`(목록) → `enrich.py`(신규 사진·정보) → `build_data.py`(app/data/places.json) → 커밋 → Pages 자동 재배포
