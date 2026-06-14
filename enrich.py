# -*- coding: utf-8 -*-
import urllib.request, urllib.error, json, sys, io, re, time, os, random
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(BASE, "enriched.jsonl")
PROG = os.path.join(BASE, "enrich_progress.txt")
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 0

UAS = [
 "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
 "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
 "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
]
BASE_DELAY = 1.4   # 요청 간 기본 간격(초)

def fetch(sid):
    url = "https://pcmap.place.naver.com/place/%s/home" % sid
    req = urllib.request.Request(url, headers={
        "User-Agent": random.choice(UAS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": "https://map.naver.com/",
    })
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", "replace")

def extract_apollo(html):
    m = re.search(r"__APOLLO_STATE__\s*=\s*", html)
    if not m: return None
    i = html.index("{", m.end())
    depth, instr, esc = 0, False, False
    for j in range(i, len(html)):
        ch = html[j]
        if instr:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == '"': instr = False
        else:
            if ch == '"': instr = True
            elif ch == "{": depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return json.loads(html[i:j+1])
    return None

def parse(sid, name):
    st = extract_apollo(fetch(sid))
    rec = {"sid": sid, "name": name, "ok": False, "closed": False}
    base = None
    if st:
        for k, v in st.items():
            if k.startswith("PlaceDetailBase:") and isinstance(v, dict) and v.get("name"):
                base = v; break
    if not base:
        rec["closed"] = True
        return rec
    rec["ok"] = True
    rec["cat"] = base.get("category")
    rec["catCodes"] = base.get("categoryCodeList")
    rec["road"] = base.get("roadAddress")
    rec["phone"] = base.get("phone")
    rec["score"] = base.get("visitorReviewsScore")
    rec["reviewCount"] = base.get("visitorReviewsTotal")
    rec["micro"] = base.get("microReviews")
    rec["conv"] = base.get("conveniences")
    rec["openingHours"] = base.get("openingHours")
    rec["isGoodStore"] = base.get("isGoodStore")
    photos = []
    for k, v in st.items():
        if k.startswith("PlaceDetailTopPhotoItem") and isinstance(v, dict):
            u = v.get("origin")
            if u:
                photos.append({"t": v.get("photoType"), "title": v.get("title"),
                               "text": v.get("text"), "no": v.get("no"), "url": u})
    photos.sort(key=lambda p: (0 if p["t"] == "business" else 1, p.get("no") or 99))
    rec["photos"] = photos
    menus = []
    for k, v in st.items():
        if k.startswith("Menu:") and isinstance(v, dict) and v.get("name"):
            menus.append({"name": v.get("name"), "price": v.get("price")})
    rec["menus"] = menus[:15]
    for k, v in st.items():
        if k.startswith("VisitorReviewStatsResult") and isinstance(v, dict):
            an = (v.get("analysis") or {}).get("themes") or []
            rec["themes"] = [{"label": t.get("label"), "count": t.get("count")} for t in an]
            break
    return rec

def fetch_with_backoff(sid, name):
    attempt = 0
    while True:
        try:
            return parse(sid, name)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                attempt += 1
                if attempt > 6:
                    return {"sid": sid, "name": name, "ok": False, "err": "429x6"}
                cd = min(120, 12 * attempt + random.random() * 8)
                print("  429 cooldown %ds (try %d) %s" % (int(cd), attempt, name)); sys.stdout.flush()
                time.sleep(cd)
            else:
                return {"sid": sid, "name": name, "ok": False, "err": "HTTP %d" % e.code}
        except Exception as ex:
            attempt += 1
            if attempt > 3:
                return {"sid": sid, "name": name, "ok": False, "err": str(ex)[:120]}
            time.sleep(4)

def main():
    data = json.load(open(os.path.join(BASE, "naver_bookmarks_full.json"), encoding="utf-8"))
    seen, items = set(), []
    for e in data["my"]["bookmarkSync"]["bookmarks"]:
        b = e["bookmark"]
        sid = b.get("sid")
        if not sid or b.get("type") != "place" or sid in seen: continue
        seen.add(sid); items.append((sid, b.get("name")))

    # 기존 파일 compact: 성공(ok)/폐업(closed) 기록만 보존, 에러는 버리고 재시도
    good = {}
    if os.path.exists(OUT):
        for line in open(OUT, encoding="utf-8"):
            try: r = json.loads(line)
            except: continue
            if r.get("ok") or r.get("closed"):
                if r["sid"] not in good or r.get("ok"):
                    good[r["sid"]] = r
    with open(OUT, "w", encoding="utf-8") as f:
        for r in good.values():
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    done = set(good)
    todo = [it for it in items if it[0] not in done]
    if LIMIT: todo = todo[:LIMIT]
    total = len(todo)
    print("보존 good=%d, 재시도/신규 todo=%d" % (len(done), total)); sys.stdout.flush()

    f = open(OUT, "a", encoding="utf-8")
    ok = closed = err = 0
    for idx, (sid, name) in enumerate(todo, 1):
        rec = fetch_with_backoff(sid, name)
        if rec.get("ok"): ok += 1
        elif rec.get("closed"): closed += 1
        else: err += 1
        f.write(json.dumps(rec, ensure_ascii=False) + "\n"); f.flush()
        if idx % 10 == 0 or idx == total:
            msg = "%d/%d ok=%d closed=%d err=%d last=%s" % (idx, total, ok, closed, err, name)
            open(PROG, "w", encoding="utf-8").write(msg); print(msg); sys.stdout.flush()
        time.sleep(BASE_DELAY + random.random() * 0.8)
    f.close()
    print("DONE ok=%d closed=%d err=%d" % (ok, closed, err))

main()
