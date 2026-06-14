# -*- coding: utf-8 -*-
import json, os, io, sys, re, time
from collections import Counter
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE = os.path.dirname(os.path.abspath(__file__))
APPDATA = os.path.join(BASE, "app", "data")
os.makedirs(APPDATA, exist_ok=True)

GROUP = {"DINING":"맛집","CAFE":"카페","BAR":"술집바","ACCOMMODATION":"숙박","TRAVEL":"여행",
 "SHOPPING":"쇼핑","LIFE_CULTURE":"문화여가","ENTERTAINMENT":"문화여가","EDUCATION":"교육",
 "CAR":"자동차","SUPERMARKET":"생활","PUBLIC":"생활","GENERAL":"생활","ETC":"생활",
 "GEO_INFO":"생활","ADDRESS":"생활","TRANSPORTATION":"생활"}
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
        "c": GROUP.get(b.get("mcid"), "생활"),
        "nc": (e.get("cat") if e else None) or b.get("mcidName"),
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
