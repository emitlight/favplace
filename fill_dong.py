# -*- coding: utf-8 -*-
"""동 정보가 없는 장소만 네이버 place API의 지번주소(address)를 수집해 sid->동 매핑 생성.
비파괴적: enriched.jsonl 은 건드리지 않고 dong_map.json 만 갱신. 재개(resume) 가능, 429 백오프."""
import urllib.request, urllib.error, json, sys, io, re, time, os, random
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = os.path.dirname(os.path.abspath(__file__))
MAP = os.path.join(BASE, "dong_map.json")
PROG = os.path.join(BASE, "fill_dong_progress.txt")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
BASE_DELAY = 1.3

def apollo(html):
    m = re.search(r"__APOLLO_STATE__\s*=\s*", html)
    if not m: return None
    i = html.index("{", m.end()); depth = 0; instr = False; esc = False
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
                if depth == 0: return json.loads(html[i:j+1])
    return None

def parse_dong(jibun):
    """지번주소에서 동/읍/면/리 토큰 추출. 예: '경기 화성시 동탄구 송동 703-4' -> '송동'"""
    if not jibun: return ""
    for tok in jibun.split():
        if re.search(r'(시|군|구|도)$', tok):  # 시도/시군구는 건너뜀
            continue
        if re.search(r'.+(동|읍|면|리)$', tok) and not tok[0].isdigit():
            return tok
    return ""

def fetch_dong(sid):
    req = urllib.request.Request("https://pcmap.place.naver.com/place/%s/home" % sid,
        headers={"User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9", "Referer": "https://map.naver.com/"})
    with urllib.request.urlopen(req, timeout=25) as r:
        html = r.read().decode("utf-8", "replace")
    st = apollo(html)
    if not st: return None, None
    for k, v in st.items():
        if k.startswith("PlaceDetailBase:") and isinstance(v, dict) and v.get("name"):
            addr = v.get("address") or ""
            return parse_dong(addr), addr
    return None, None

def fetch_with_backoff(sid):
    attempt = 0
    while True:
        try:
            return fetch_dong(sid)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                attempt += 1
                if attempt > 6: return None, "429x6"
                cd = min(120, 12 * attempt + random.random() * 8)
                print("  429 cooldown %ds (try %d)" % (int(cd), attempt)); sys.stdout.flush()
                time.sleep(cd)
            else:
                return None, "HTTP%d" % e.code
        except Exception as ex:
            attempt += 1
            if attempt > 3: return None, str(ex)[:60]
            time.sleep(4)

def main():
    P = json.load(open(os.path.join(BASE, "app", "data", "places.json"), encoding="utf-8"))
    dmap = {}
    if os.path.exists(MAP):
        try: dmap = json.load(open(MAP, encoding="utf-8"))
        except: dmap = {}
    todo = [p for p in P if p.get("map") and not p.get("dong") and str(p["id"]) not in dmap]
    total = len(todo)
    print("dong_map 보유=%d, 수집 대상 todo=%d" % (len(dmap), total)); sys.stdout.flush()
    ok = miss = err = 0
    for idx, p in enumerate(todo, 1):
        sid = str(p["id"])
        dong, addr = fetch_with_backoff(sid)
        if dong:
            dmap[sid] = dong; ok += 1
        elif dong == "" and addr is not None and not str(addr).startswith(("429", "HTTP")):
            dmap[sid] = ""  # 지번에 동이 없음(도로명만) — 재시도 방지 위해 빈값 기록
            miss += 1
        else:
            err += 1
        if idx % 8 == 0 or idx == total:
            json.dump(dmap, open(MAP, "w", encoding="utf-8"), ensure_ascii=False)
            msg = "%d/%d ok=%d nodong=%d err=%d last=%s->%s" % (idx, total, ok, miss, err, p["n"][:16], dmap.get(sid, "?"))
            open(PROG, "w", encoding="utf-8").write(msg); print(msg); sys.stdout.flush()
        time.sleep(BASE_DELAY + random.random() * 0.7)
    json.dump(dmap, open(MAP, "w", encoding="utf-8"), ensure_ascii=False)
    print("DONE ok=%d nodong=%d err=%d total_map=%d" % (ok, miss, err, len(dmap)))

main()
