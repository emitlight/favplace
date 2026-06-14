# -*- coding: utf-8 -*-
# 네이버 즐겨찾기 목록 수집 (로그인 쿠키 필요). GitHub Actions / 로컬 공용.
# 환경변수 NAVER_COOKIE = "NID_AUT=...; NID_SES=..." (브라우저 쿠키 문자열)
import urllib.request, json, os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.abspath(__file__))
COOKIE = os.environ.get("NAVER_COOKIE", "").strip()
if not COOKIE:
    print("ERROR: NAVER_COOKIE 환경변수가 필요합니다."); sys.exit(1)
req = urllib.request.Request("https://map.naver.com/p/api/bookmark", headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "application/json", "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": "https://map.naver.com/", "Cookie": COOKIE,
})
data = json.loads(urllib.request.urlopen(req, timeout=30).read().decode("utf-8"))
if not (data.get("my") or {}).get("bookmarkSync"):
    print("ERROR: 응답에 북마크가 없습니다. 쿠키가 만료됐을 수 있어요."); sys.exit(2)
json.dump(data, open(os.path.join(BASE, "naver_bookmarks_full.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("폴더:", data["my"]["folderSync"]["count"], "북마크:", data["my"]["bookmarkSync"]["count"])
