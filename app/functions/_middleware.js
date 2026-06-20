// Cloudflare Pages 엣지 인증 — 사이트 전체(정적+함수+데이터)를 비밀번호로 보호.
// 환경변수 SITE_PASS 미설정 시 전부 차단(노출 방지). 설정 시 Basic Auth(아이디: favplace).
export async function onRequest(context) {
  const { request, next, env } = context;
  const pass = env.SITE_PASS;
  if (!pass) {
    return new Response("이 사이트는 SITE_PASS 환경변수 설정 후 열립니다.", { status: 503 });
  }
  const expected = "Basic " + btoa("favplace:" + pass);
  const got = request.headers.get("Authorization") || "";
  if (got !== expected) {
    return new Response("인증이 필요합니다.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="하영의 지도", charset="UTF-8"' },
    });
  }
  return next();
}
