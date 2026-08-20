# 네이버 지도 즐겨찾기 — API/데이터 메모

## 1) 즐겨찾기 목록 (로그인 필요)
- `GET https://map.naver.com/p/api/bookmark`  (브라우저 세션 쿠키 NID_AUT/NID_SES 필요)
- 응답:
  - `my.folderSync.folders[]` : {folderId, name, bookmarkCount, shareId, isDefaultFolder}
    - 기본 폴더 "내 장소"(=전체) folderId 3401176, 693개. 총 7폴더.
  - `my.bookmarkSync.bookmarks[]` (count=728) : 각 항목 `.bookmark`
    - sid(장소ID), name, px(경도), py(위도), type(place/address), mcid(DINING/CAFE/BAR/ACCOMMODATION/TRAVEL/SHOPPING/LIFE_CULTURE/ENTERTAINMENT/EDUCATION/CAR/...), mcidName, address, memo
    - `bookmarkMismatchInfo.details`: ["AVAILABLE"|"UNAVAILABLE"|"GEOMETRY"]  → UNAVAILABLE=폐업/삭제(5건)
    - `folderMappings`: 소속 폴더 (다중 가능)

## 1-1) 즐겨찾기 **쓰기** API ✦ 2026-08-17 HAR 캡처로 확인

- ✅ **수정(이름·메모·폴더이동)**: `PATCH https://pages.map.naver.com/save-widget/api/maps-bookmark/bookmarks/{bookmarkId}?cv=v1.4.7&t={epoch_ms}`
  - 헤더: `content-type: application/json`, `origin: https://pages.map.naver.com`,
    `referer: https://pages.map.naver.com/save-pages/...`, 로그인 쿠키. (커스텀 인증 헤더 없음)
  - 바디: `{"displayName":"", "memo":"", "url":"", "mapping":{"addFolderIds":[3401176],"removeFolderIds":[253423448]}, "token":"<32B base64>", "cv":"v1.4.7"}`
  - 응답 200: `{"displayName","memo","url","mapping":{"removedFolderIds":[],"addedMappings":[{folderId,creationTime}],"nonExistentFolderIds":[],"skippedFolderIds":[],"updateDate","bookmarkRemoved":false}}`
  - ⚠️ **경로 파라미터는 `sid`가 아니라 `bookmarkId`** (별개의 값). 예: bookmarkId 4290071632 ↔ sid 72690307.
    sid→bookmarkId 매핑은 sync/`/p/api/bookmark` 응답의 `bookmark.bookmarkId` 로 만들어야 함.
- ❓ **`token` 출처 미확인**. 캡처한 HAR 전체(21요청)에서 이 문자열은 PATCH 바디에 **딱 1번**만 등장 →
  어떤 API 응답에도 없음. save-widget 페이지 HTML/JS 번들에서 나오는 것으로 추정. **한 번 더 캡처 필요.**
- ✅ **삭제/폴더에서 빼기 — 토큰 불필요!** (2차 HAR 캡처)
  `DELETE https://pages.map.naver.com/save-pages/api/maps-bookmark/v3/folders/{folderId}/mapping`
  - 헤더: `content-type: application/json`, `origin`/`referer` = pages.map.naver.com, 로그인 쿠키. **커스텀 토큰 없음.**
  - 바디: `{"bookmarkIds":[4268267138]}`
  - 응답 200: `{"nonExistentBookmarkIds":[], "unmappedBookmarkIds":[...], "removedBookmarkIds":[...], "updateDate":...}`
    - `unmappedBookmarkIds` = 그 폴더에서만 빠짐(다른 폴더에 남아있음)
    - `removedBookmarkIds` = **즐겨찾기 자체가 삭제됨**(마지막 폴더에서 뺀 경우)
  - ⚠️ `save-widget`(PATCH, 토큰 필요)과 `save-pages/v3`(토큰 불필요)는 **다른 계열**. v3 쪽을 쓸 것.
- ✅ **리스트(폴더) 만들기 — 토큰 불필요!** (3차 HAR, 2026-08-19)
  `POST https://pages.map.naver.com/save-widget/api/maps-bookmark/folders/new?t={epoch_ms}`
  - 바디: `{"name":"새 리스트","colorCode":"1","isPublished":false,"isExposed":false}`
  - 응답 200: 폴더 객체 전체 `{folderId, name, colorCode, iconId, markerColor, shareId, bookmarkCount:0, folderType:"MY", creationTime, ...}`
  - ⚠️ **중요**: `save-widget` 계열인데도 `token`이 없다. 3차 HAR 전체에서 `"token"` 등장 **0회**.
    → 토큰이 필요한 건 `save-widget`의 **북마크 PATCH 하나뿐**일 수 있음.
    쿠키 등록 후 PATCH를 token 없이 한 번 시도해볼 가치가 있다.
- ✅ **리스트(폴더) 삭제 — 토큰 불필요**
  `DELETE https://pages.map.naver.com/save-pages/api/maps-bookmark/v3/folders/{folderId}` 바디 `{}`
  - 응답 200: `{"statusCode":"200","apiErrorCode":200,"apiErrorMessage":"","displayMessage":"OK"}`
  - ⚠️ **캡처한 두 건 모두 빈 폴더(bookmarkCount 0)였다.** 장소가 들어있는 폴더를 지웠을 때
    그 장소들이 "내 장소"에 남는지 함께 삭제되는지는 **검증되지 않음.** 확인 전까지 비어있지 않은 폴더는 막을 것.
- 보조: `PUT /save-widget/api/maps-search/kvfarm/favorite-timestamp` — 쓰기 직후 호출되는 캐시 무효화용. 없어도 동작하는 것으로 보임.
- **v3 보조**: `GET /v3/folder-mappings?q=bookmark-ids=A;B` → `[{bookmarkId, folderMappings:[{folderId,creationTime}]}]`
  · `GET /v3/shares/{shareId}/bookmarks` → `{folder, bookmarkList, unavailableCount, mismatchedCount, removed}`
- **읽기 보조**: `GET /save-widget/api/maps-bookmark/sync?t={ms}` = `/p/api/bookmark` 과 같은 전체 동기화 페이로드.
  `GET /save-widget/api/maps-bookmark/folders?t={ms}`, `GET /save-pages/api/maps-bookmark/v3/folder-mappings?q=bookmark-ids={id}`.
- **폴더 ID**(2026-08-17): 내 장소(기본) 3401176 · 한강진 213974309 · 새리스트만들기 253423448 ·
  novy dum 219696274 · 글램핑바베큐 249986982 · 북카페등 187582117 · 삼척 245767501.

## 2) 장소 상세/사진 (로그인 불필요, 공개)
- `GET https://pcmap.place.naver.com/place/{sid}/home`  (타입 무관 동작) → HTML 내 `window.__APOLLO_STATE__` 파싱
- 주요 엔티티:
  - `PlaceDetailBase:{sid}` : name, category(세부: "카페,디저트"/"육류,고기요리"), categoryCodeList, roadAddress, phone, visitorReviewsScore, visitorReviewsTotal, microReviews(한줄평), conveniences(편의), openingHours, coordinate, isGoodStore
  - `PlaceDetailTopPhotoItem:*` : **origin(이미지URL)**, photoType(business=대표/visitor=방문자), title, text, no — 보통 10장
  - `Menu:*` : name, price
  - `VisitorReviewStatsResult:{sid}` : review.totalCount/imageReviewCount, analysis.themes[]{label,count}
  - **PlaceDetailBase 없음(엔티티≤1) ⇒ 폐업/삭제** (예: sid 86717807 굴드)

## 3) 폐업 판정
- 확정: 북마크 mismatch UNAVAILABLE(5) ∪ enrich 시 APOLLO 비어있음
- openingHours 는 home 응답에서 null 인 경우 많음 → 영업시간 정밀치는 별도 처리 필요(추후)

## 4) 분류
- 대분류: mcid 기반 (맛집/카페/술집바/숙박/여행/쇼핑/문화여가/교육/자동차/생활)
- 세부: 네이버 `category` (한식/일식/양식/베이커리 등)
- 지역: address 의 시도/시군구

## 4-1) 장소 검색 (로그인 불필요, 공개) — "즐겨찾기 추가"용 ✦ 2026-08-17 확인
- ✅ `GET https://map.naver.com/p/api/search/instant-search?query={검색어}&coords={위도},{경도}`
  - 헤더: UA + `Referer: https://map.naver.com/` 만 있으면 됨. 쿠키 불필요.
  - 응답 `place[]`: `id`/`sid`(장소ID), `title`, `x`(경도), `y`(위도), `ctg`(카테고리), `cid`,
    `jibunAddress`, `roadAddress`, `shortAddress[]`, `review.count`, `totalScore`, `dist`
  - `ac[]`: 자동완성 후보. `coords`는 거리(dist) 정렬 기준일 뿐 없어도 동작.
  - → sid를 얻으면 2)의 pcmap 상세로 사진/메뉴/평점까지 바로 보강 가능. **추가 기능의 검색 경로는 이걸로 확정.**
- ❌ `GET /p/api/search/allSearch?query=...` : ncaptcha 게이트(`pageId: ncaptcha-all-search-no-result`)로
  `result.place = null` 반환. 서버에서 쓰기 부적합 → 사용하지 않음.

## 5) 이미지 핫링크
- pstatic.net (ldb-phinf=대표, pup-review-phinf/blogfiles=방문자) → 정적 사이트에서 직접 <img src> 로드 가능(레퍼러 제약 거의 없음). 저장공간 부담 없음.
