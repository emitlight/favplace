# -*- coding: utf-8 -*-
import json, os, io, sys, re, time
from collections import Counter
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE = os.path.dirname(os.path.abspath(__file__))
APPDATA = os.path.join(BASE, "app", "data")
os.makedirs(APPDATA, exist_ok=True)

_MCIDFALL = {"DINING":("음식점","한식"),"CAFE":("카페","커피"),"BAR":("술집바","술집·바"),
 "ACCOMMODATION":("숙박","호텔"),"TRAVEL":("명소","관광명소"),"SHOPPING":("쇼핑","마트"),
 "LIFE_CULTURE":("문화","복합문화시설"),"ENTERTAINMENT":("문화","복합문화시설"),
 "EDUCATION":("생활","교육"),"CAR":("생활","자동차")}
# 트리 분류: nc(네이버 세부카테고리) 키워드 -> (대분류, 세부). 위에서부터 먼저 매칭.
_RULES = [
 (("아파트",), ("주거","아파트")),
 (("오피스텔","주상복합","빌라","사택","기숙사"), ("주거","오피스텔·기타")),
 (("부동산","중개","분양"), ("생활","부동산")),
 (("북카페",), ("문화","서점·책방")),
 (("베이커리","빵","제과","도넛","베이글","크루아상"), ("카페","베이커리·빵")),
 (("디저트","케이크","떡카페","아이스크림","빙수","마카롱","젤라또","와플"), ("카페","디저트")),
 (("브런치",), ("카페","브런치")),
 (("전통찻집","찻집"), ("카페","전통찻집")),
 (("카페","커피"), ("카페","커피")),
 (("요리주점","이자카야","포차","호프","술집","와인","펍","라운지","칵테일","위스키","맥주"), ("술집바","술집·바")),
 (("생선회","물회","해산물","수산","횟집","대게","랍스터"), ("음식점","일식·회")),
 (("일식","일본","스시","초밥","라멘","라면","돈카츠","우동","오마카세","덮밥","텐동"), ("음식점","일식·회")),
 (("중식","중국","마라","딤섬","양꼬치","훠궈"), ("음식점","중식")),
 (("고기","삼겹","갈비","곱창","막창","대창","육류","구이","스테이크","족발","보쌈","한우","오리","장어","바베큐","닭갈비"), ("음식점","고기·구이")),
 (("이탈리","파스타","스파게티","피자","햄버거","버거","멕시","타코","브라질","베트남","쌀국수","태국","인도","양식","아시안"), ("음식점","양식·아시안")),
 (("치킨","닭강정","통닭","후라이드","닭강정","호프치킨"), ("음식점","치킨")),
 (("분식","떡볶이","김밥","순대","만두","핫도그","토스트","라볶이","우동"), ("음식점","분식")),
 (("한식","한정식","국밥","백반","찌개","냉면","칼국수","백숙","삼계탕","곰탕","설렁탕","해장국","쌈밥","두부","죽","비빔밥","감자탕","찜","탕","면","식당","뷔페"), ("음식점","한식")),
 (("미술관","갤러리","전시"), ("문화","미술관·전시")),
 (("공연","극장","공연장","씨어터","시어터"), ("문화","공연·극장")),
 (("박물관",), ("문화","박물관")),
 (("도서관",), ("문화","도서관")),
 (("서점","책방"), ("문화","서점·책방")),
 (("복합문화","문화시설","아트센터","아트홀"), ("문화","복합문화시설")),
 (("골프",), ("레저","골프")),
 (("수영장","스포츠","피트니스","헬스","클라이밍","볼링","테니스","스크린","당구"), ("레저","스포츠")),
 (("공방","체험","도예","원데이","공예"), ("레저","체험·공방")),
 (("글램핑","캠핑","카라반"), ("레저","캠핑·글램핑")),
 (("장소대여","파티룸","스터디"), ("레저","기타")),
 (("해수욕장","해변","바다","해상","포구","방파제","등대"), ("자연","바다·해변")),
 (("수목원","계곡","폭포","자연휴양림","숲","산림","등산"), ("자연","산·숲")),
 (("공원","호수","정원","식물원","연못"), ("자연","공원·정원")),
 (("온천","스파","사우나","찜질"), ("자연","온천·스파")),
 (("관광","명소","유적","고궁","민속마을","전망","케이블카","유원지","테마파크","랜드마크","타워"), ("명소","관광명소")),
 (("시장","전통시장"), ("명소","시장")),
 (("호텔",), ("숙박","호텔")),
 (("펜션","리조트","모텔","게스트","민박","콘도"), ("숙박","펜션·리조트")),
 (("백화점","아울렛"), ("쇼핑","백화점·아울렛")),
 (("마트","편의점","슈퍼","하나로"), ("쇼핑","마트")),
 (("쇼핑","편집샵","소품","쇼룸","서핑샵"), ("쇼핑","편집샵")),
 (("병원","의원","약국","치과","한의원","산부인과","동물병원","메디컬","클리닉","의료"), ("생활","병원·의료")),
 (("미용","헤어","네일","피부","살롱","마사지","왁싱","뷰티","에스테틱"), ("생활","미용")),
 (("교육","학원","교습","음악교육","어학","공부방"), ("생활","교육")),
 (("자동차","정비","주유","세차","카센터","모터스"), ("생활","자동차")),
 (("주차","공영주차"), ("생활","주차")),
 (("관공서","주민센터","구청","시청","군청","우체국","은행"), ("생활","공공·금융")),
]
_CAFE_SUB = [("베이글","베이글"),("소금빵","소금빵"),("도넛","도넛"),("크로플","크로플"),("스콘","스콘"),
 ("케이크","케이크"),("타르트","타르트"),("마카롱","마카롱"),("젤라또","젤라또"),("빙수","빙수"),
 ("와플","와플"),("휘낭시에","휘낭시에"),("크루아상","크루아상"),("약과","약과")]
def _match(text):
    s = text or ""
    for kws, ct in _RULES:
        if any(w in s for w in kws): return ct
    return None
def classify(nc, mcid, name="", micro=""):
    ct = _match(nc)
    if not ct:
        ct = _match((name or "") + " " + (micro or ""))   # nc로 못 잡으면 이름+설명으로
    if not ct:
        return _MCIDFALL.get(mcid, ("생활", "기타"))
    if ct[0] == "카페":   # 카페 세부: 이름/설명 기반 보정 (예: 베이글 맛집)
        t = (name or "") + " " + (micro or "")
        for kw, sub in _CAFE_SUB:
            if kw in t: return ("카페", sub)
    return ct
SIDO = {"서울특별시":"서울","경기도":"경기","대전광역시":"대전","부산광역시":"부산","강원도":"강원",
 "강원특별자치도":"강원","경상남도":"경남","경상북도":"경북","충청남도":"충남","충청북도":"충북",
 "전라남도":"전남","전라북도":"전북","전북특별자치도":"전북","광주광역시":"광주","인천광역시":"인천",
 "울산광역시":"울산","대구광역시":"대구","제주특별자치도":"제주","세종특별자치시":"세종"}
KW_SET = ["룸","단체","주차","발렛","예약","포장","배달","반려","오션뷰","바다","테라스","루프탑",
 "콜키지","야외","브런치","오마카세","코스","와인","칵테일","뷰맛집","뷰","노키즈","키즈","24시",
 "노포","웨이팅","데이트","혼밥","가성비","야장","조용","분위기","신상","숨은","프라이빗","야경"]

def sido_norm(s): return SIDO.get(s, s)

def region(addr):
    a = (addr or "").split()
    if not a: return "", "", ""
    sido = sido_norm(a[0])
    sigungu = a[1] if len(a) > 1 else ""
    didx = 2
    if len(a) > 2 and re.search(r'구$', a[2]):   # 예: 용인시 처인구
        sigungu = a[1] + " " + a[2]; didx = 3
    dong = a[didx] if len(a) > didx and re.search(r'(동|읍|면|리)$', a[didx]) else ""
    return sido, sigungu, dong

# 1) 즐겨찾기 로드
data = json.load(open(os.path.join(BASE, "naver_bookmarks_full.json"), encoding="utf-8"))
fid2name = {f["folderId"]: f["name"] for f in data["my"]["folderSync"]["folders"]}

# 2) enrich 로드 (sid -> rec)
enr = {}
ep = os.path.join(BASE, "enriched.jsonl")
if os.path.exists(ep):
    for line in open(ep, encoding="utf-8"):
        try: r = json.loads(line)
        except: continue
        if r.get("ok") or r.get("closed"):
            enr[r["sid"]] = r

# 동 보강 매핑 (fill_dong.py 가 지번주소에서 추출한 sid->동)
dmap = {}
dp = os.path.join(BASE, "dong_map.json")
if os.path.exists(dp):
    try: dmap = json.load(open(dp, encoding="utf-8"))
    except: dmap = {}

def derive_kw(e, name=""):
    parts = [name or ""]
    if e:
        parts += [
            " ".join(e.get("micro") or []) if isinstance(e.get("micro"), list) else (e.get("micro") or ""),
            e.get("cat") or "",
            " ".join(m.get("name", "") for m in (e.get("menus") or [])),
            json.dumps(e.get("conv") or "", ensure_ascii=False),
        ]
    hay = " ".join(filter(None, parts))
    out = []
    for w in KW_SET:
        if w in hay and w not in out: out.append(w)
    if ("바다" in out or "오션뷰" in out) and "바다뷰" not in out: out.append("바다뷰")
    return out

places, seen = [], set()
for ent in data["my"]["bookmarkSync"]["bookmarks"]:
    b = ent["bookmark"]
    key = b.get("sid") or ("bm" + str(b.get("bookmarkId")))
    if key in seen: continue          # 중복 제거
    seen.add(key)
    e = enr.get(b.get("sid"))
    ncv = (e.get("cat") if e else None) or b.get("mcidName")
    micro_list = e.get("micro") if e else None
    micro_str = " ".join(micro_list) if isinstance(micro_list, list) else (micro_list or "")
    sido, sigungu, dong = region(b.get("address"))
    if not dong:
        dong = dmap.get(str(b.get("sid")), "") or ""
    c1, c2 = classify(ncv, b.get("mcid"), b.get("name"), micro_str)
    mm = b.get("bookmarkMismatchInfo") or {}
    closed = ("UNAVAILABLE" in (mm.get("details") or [])) or bool(e and e.get("closed"))
    micro = e.get("micro") if e else None
    if isinstance(micro, list): micro = micro[0] if micro else None
    photos = [p["url"] for p in (e.get("photos") or [])] if e else []
    p = {
        "id": b.get("sid") or key,
        "n": b.get("name"),
        "la": round(b.get("py") or 0, 5),
        "lo": round(b.get("px") or 0, 5),
        "c1": c1, "c2": c2,
        "nc": ncv,
        "tel": (e.get("phone") if e else None),
        "sido": sido, "gu": sigungu, "dong": dong,
        "rg": (sido + (" " + sigungu if sigungu else "")).strip(),
        "rcode": b.get("rcode") or "",
        "f": [fid2name.get(i, "") for i in [m.get("folderId") for m in (ent.get("folderMappings") or [])]],
        "memo": b.get("memo") or "",
        "mc": micro,
        "sc": (e.get("score") if e else None),
        "rv": (e.get("reviewCount") if e else None),
        "ph": photos[:12],
        "mn": [{"n": m.get("name"), "p": m.get("price")} for m in (e.get("menus") or [])][:10] if e else [],
        "kw": derive_kw(e, b.get("name")),
        "x": 1 if closed else 0,
        "en": 1 if e and e.get("ok") else 0,
    }
    places.append(p)

# 좌표 유효한 것만 지도용. 전부 보존하되 잘못된 좌표는 표시 제외 플래그
for p in places:
    p["map"] = 1 if (33 < p["la"] < 39 and 124 < p["lo"] < 132) else 0

tree = {}
for p in places:
    tree.setdefault(p["c1"], {}).setdefault(p["c2"], 0)
    tree[p["c1"]][p["c2"]] += 1
regions = {}
for p in places:
    if p["sido"]:
        regions.setdefault(p["sido"], {}).setdefault(p["gu"] or "기타", 0)
        regions[p["sido"]][p["gu"] or "기타"] += 1
meta = {
    "total": len(places),
    "withPhoto": sum(1 for p in places if p["ph"]),
    "closed": sum(p["x"] for p in places),
    "enriched": sum(p["en"] for p in places),
    "withDong": sum(1 for p in places if p["dong"]),
    "cats": dict(Counter(p["c1"] for p in places)),
    "tree": tree,
    "regions": regions,
    "updated": time.strftime("%Y-%m-%d %H:%M"),
}
json.dump(places, open(os.path.join(APPDATA, "places.json"), "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
json.dump(meta, open(os.path.join(APPDATA, "meta.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("총", meta["total"], "| 사진", meta["withPhoto"], "| 폐업", meta["closed"], "| 동추출", meta["withDong"])
print("대분류:", meta["cats"])
print("시도:", {k: sum(v.values()) for k, v in regions.items()})
print("트리 예시(음식점):", tree.get("음식점"))
