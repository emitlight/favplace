# -*- coding: utf-8 -*-
import urllib.request, json, sys, io, re
from collections import Counter
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

def fetch(sid):
    url = "https://pcmap.place.naver.com/place/%s/home" % sid
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko"})
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

for sid, tag in [("11871325","성심당(영업중?)"), ("86717807","굴드(UNAVAILABLE)")]:
    print("="*70)
    print("SID", sid, tag)
    try:
        st = extract_apollo(fetch(sid))
    except Exception as e:
        print("  FETCH/PARSE ERR:", e); continue
    if not st:
        print("  APOLLO_STATE 없음"); continue
    print("  엔티티 수:", len(st))
    prefixes = Counter(k.split(":")[0] for k in st.keys() if ":" in k)
    print("  키 prefix 분포:", dict(prefixes.most_common(20)))
    # 루트 place 엔티티 찾기
    root = None
    for k,v in st.items():
        if k.startswith("PlaceDetailBase") or k.startswith("RestaurantBase") or k.startswith("PlaceBase") or (isinstance(v,dict) and str(v.get("id"))==sid):
            root = (k,v); break
    if root:
        k,v = root
        print("  [ROOT]", k)
        for fk in ["name","category","categoryCode","categoryCodeList","businessCategory","fullAddress","roadAddress","virtualPhone","phone","permanentlyClosed","temporaryClosed","bizhourInfo","businessHours","conveniences","keywords","microReview","description","imageCount","visitorReviewCount","visitorReviewScore","reviewSettings","menus","naverBookingUrl"]:
            if fk in v: print("      %s = %s" % (fk, json.dumps(v[fk], ensure_ascii=False)[:160]))
    # 이미지/사진 엔티티
    imgkeys = [k for k in st if re.search(r"[Ii]mage|[Pp]hoto", k)]
    print("  이미지관련 엔티티 수:", len(imgkeys), "예시키:", imgkeys[:5])
    urls=[]
    for k in imgkeys[:60]:
        v=st[k]
        if isinstance(v,dict):
            for cand in ("url","imageUrl","origin","src"):
                if isinstance(v.get(cand),str) and "phinf" in v[cand]:
                    urls.append(v[cand]); break
    print("  사진 URL 예시:", urls[:4])
    # 영업시간/편의 키워드 탐색
    flat = json.dumps(st, ensure_ascii=False)
    for kw in ["룸","주차","바다","오션","뷰","포장","예약","반려"]:
        if kw in flat: print("    편의/키워드 포함:", kw)
