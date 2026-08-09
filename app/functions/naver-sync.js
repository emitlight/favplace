// Cloudflare Pages Function — /naver-sync
// favplace의 변경(삭제·폴더·메모)을 네이버 즐겨찾기 "원본"에 반영하기 위한 스캐폴드.
//
// ⚠️ 안전장치 (되돌리기 어려운 작업이라 이중 잠금):
//   1) 환경변수 NAVER_COOKIE 가 없으면 아무것도 안 함(503).
//   2) 쓰기(삭제/수정)는 환경변수 NAVER_SYNC_WRITE === "on" 일 때만 허용.
//   3) 아직 네이버 "쓰기 API 형식"을 캡처하지 않았으므로, 쓰기는 501(미구현)로 막혀 있음.
//      → 아래 TODO에 캡처한 요청(메서드/URL/헤더/바디)을 채우면 그때 실제로 동작.
//
// 필요한 것(하영이 제공):
//   A) NAVER_COOKIE  : 네이버 로그인 세션 쿠키. Cloudflare 대시보드에서 "본인이 직접" 시크릿으로 등록.
//                      (Chrome에서 map.naver.com 로그인 → DevTools > Application > Cookies →
//                       NID_AUT, NID_SES 값 → "NID_AUT=...; NID_SES=..." 형태로 저장)
//   B) 쓰기 API 캡처 : 네이버 지도에서 즐겨찾기 삭제/메모수정/폴더이동을 실제로 하면서
//                      DevTools > Network 에서 그 요청의 [Method, Request URL, Request Headers(쿠키는 가림),
//                      Request Payload(Body)] 와 응답을 캡처해서 전달. → 아래 TODO 채움.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };
const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
function naverHeaders(cookie, extra = {}) {
  return { "User-Agent": UA, "Accept": "application/json, text/plain, */*", "Accept-Language": "ko-KR,ko;q=0.9", "Referer": "https://map.naver.com/", "Cookie": cookie, ...extra };
}

// 상태 확인 (읽기 전용, 안전)
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "ping";
  const hasCookie = !!env.NAVER_COOKIE;
  const writeEnabled = hasCookie && env.NAVER_SYNC_WRITE === "on";
  if (action === "ping") return j({ ok: true, hasCookie, writeEnabled, note: writeEnabled ? "쓰기 준비됨(단, 쓰기 API 형식 구현 필요)" : "읽기/상태만 가능" });
  if (!hasCookie) return j({ error: "NAVER_COOKIE 미설정 — 하영이 Cloudflare에 직접 등록해야 동작" }, 503);
  return j({ error: "지원하지 않는 action", allowed: ["ping"] }, 400);
}

// 쓰기(삭제/메모/폴더) — 이중 잠금 + 캡처 전까지 501
export async function onRequestPost({ request, env }) {
  if (!env.NAVER_COOKIE) return j({ error: "NAVER_COOKIE 미설정" }, 503);
  if (env.NAVER_SYNC_WRITE !== "on") return j({ error: "쓰기 비활성(NAVER_SYNC_WRITE=on 필요)" }, 403);

  let body; try { body = await request.json(); } catch { return j({ error: "bad json" }, 400); }
  const action = String(body.action || "");
  const cookie = env.NAVER_COOKIE;

  // ── TODO: 캡처한 네이버 쓰기 API를 여기에 구현 ──────────────────────────
  // 예) 즐겨찾기 삭제:
  //   const r = await fetch("https://<캡처한 URL>", {
  //     method: "<캡처한 METHOD>",
  //     headers: naverHeaders(cookie, { "content-type": "application/json" }),
  //     body: JSON.stringify({ /* 캡처한 payload 형식 (body.sid 등 사용) */ }),
  //   });
  //   return j({ ok: r.ok, status: r.status });
  // ────────────────────────────────────────────────────────────────────
  return j({ error: "쓰기 API 미구현 — 네이버 요청 형식을 캡처해 이 함수에 채워야 실제 반영됨", requested: action }, 501);
}
