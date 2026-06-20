# -*- coding: utf-8 -*-
import json, os, io, sys, re, time
from collections import Counter
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE = os.path.dirname(os.path.abspath(__file__))
APPDATA = os.path.join(BASE, "app", "data")
os.makedirs(APPDATA, exist_ok=True)

_MCIDFALL = {"DINING":"한식","CAFE":"카페","BAR":"술집바","ACCOMMODATION":"숙박여행","TRAVEL":"숙박여행",
 "SHOPPING":"생활","LIFE_CULTURE":"문화여가","ENTERTAINMENT":"문화여가","EDUCATION":"생활","CAR":"생활"}
def theme(nc, mcid):
    s = nc or ""
    def has(*ws): return any(w in s for w in ws)
    if has("아파트","오피스텔","주상복합","빌라","빌딩","부동산","중개","분양","사택","주택"): return "주거"
    if has("카페","디저트","베이커리","브런치","빵","도넛","아이스크림","빙수","떡카페","케이크","제과","차,"): return "카페"
    if has("요리주점","술집","와인","이자카야","포차","호프","펍","칵테일","위스키","바,라운지","맥주"): return "술집바"
    if has("일식","일본","스시","초밥","생선회","물회","사시미","라멘","라면","돈카츠","우동","오마카세","덮밥","해산물","수산"): return "일식"
    if has("중식","중국","마라","딤섬","양꼬치"): return "중식"
    if has("고기","삼겹","갈비","곱창","막창","대창","육류","구이","스테이크","바베큐","닭갈비","족발","보쌈","한우","오리","장어"): return "고기"
    if has("양식","이탈리","파스타","스파게티","피자","햄버거","버거","멕시","타코","브라질","아시안","베트남","쌀국수","태국","인도"): return "양식"
    if has("한식","한정식","국밥","백반","찌개","냉면","칼국수","만두","김밥","분식","떡볶이","치킨","닭","백숙","삼계탕","곰탕","설렁탕","순대","해장국","쌈밥","두부","죽","국수","수제비","비빔밥","감자탕","찜","탕","뷔페","식당"): return "한식"
    if has("호텔","펜션","리조트","모텔","글램핑","캠핑","숙박","게스트","관광","명소","해수욕장","해변","유원지","온천","민속마을","케이블카","전망"): return "숙박여행"
    if has("미술관","갤러리","전시","공연","박물관","공원","수목원","체험","공방","도서관","영화","수영장","스포츠","골프","스파","장소대여","시장","마을","관람","서점","책방","문화","아트"): return "문화여가"
    return _MCIDFALL.get(mcid, "생활")
SIDO = {"서울특별시":"서울","경기도":"경기","대전광역시":"대전","부산광역시":"부산","강원도":"강원",
 "강원특별자치도":"강원","경상남도":"경남","경상북도":"경북","충청남도":"충남","충청북도":"충북",
 "전라남도":"전남","전라북도":"전북","전북특별자치도":"전북","광주광역시":"광주","인천광역시":"인천",
 "울산광역시":"울산","대구광역시":"대구","제주특별자치도":"제주","세종특별자치시":"세종"}
KW_SET = ["룸","단체","주차","발렛","예약","포장","배달","반려","오션뷰","바다","테라스","루프탑",
 "콜키지","야외","브런치","오마카세","코스","와인","칵테일","뷰맛집","뷰","노키즈","키즈","24시"]

def sido_norm(s): return SIDO.get(s, s)

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

def derive_kw(e):
    if not e: return []
    hay = " ".join(filter(None, [
        " ".join(e.get("micro") or []) if isinstance(e.get("micro"), list) else (e.get("micro") or ""),
        e.get("cat") or "",
        " ".join(m.get("name","") for m in (e.get("menus") or [])),
        json.dumps(e.get("conv") or "", ensure_ascii=False),
    ]))
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
    addr = (b.get("address") or "").split()
    sido = sido_norm(addr[0]) if addr else ""
    gu = addr[1] if len(addr) > 1 else ""
    e = enr.get(b.get("sid"))
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
        "c": theme((e.get("cat") if e else None) or b.get("mcidName"), b.get("mcid")),
        "nc": (e.get("cat") if e else None) or b.get("mcidName"),
        "tel": (e.get("phone") if e else None),
        "rg": (sido + (" " + gu if gu else "")).strip(),
        "sido": sido, "gu": gu,
        "f": [fid2name.get(i, "") for i in [m.get("folderId") for m in (ent.get("folderMappings") or [])]],
        "memo": b.get("memo") or "",
        "mc": micro,
        "sc": (e.get("score") if e else None),
        "rv": (e.get("reviewCount") if e else None),
        "ph": photos[:12],
        "mn": [{"n": m.get("name"), "p": m.get("price")} for m in (e.get("menus") or [])][:10] if e else [],
        "kw": derive_kw(e),
        "x": 1 if closed else 0,
        "en": 1 if e and e.get("ok") else 0,
    }
    places.append(p)

# 좌표 유효한 것만 지도용. 전부 보존하되 잘못된 좌표는 표시 제외 플래그
for p in places:
    p["map"] = 1 if (33 < p["la"] < 39 and 124 < p["lo"] < 132) else 0

cats = Counter(p["c"] for p in places)
meta = {
    "total": len(places),
    "withPhoto": sum(1 for p in places if p["ph"]),
    "closed": sum(p["x"] for p in places),
    "enriched": sum(p["en"] for p in places),
    "cats": dict(cats),
    "updated": time.strftime("%Y-%m-%d %H:%M"),
}
json.dump(places, open(os.path.join(APPDATA, "places.json"), "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
json.dump(meta, open(os.path.join(APPDATA, "meta.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("places.json:", meta)
