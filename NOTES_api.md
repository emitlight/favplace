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

## 5) 이미지 핫링크
- pstatic.net (ldb-phinf=대표, pup-review-phinf/blogfiles=방문자) → 정적 사이트에서 직접 <img src> 로드 가능(레퍼러 제약 거의 없음). 저장공간 부담 없음.
