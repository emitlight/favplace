// Cloudflare Pages Function — POST /recommend
// app/ 을 프로젝트 루트로 배포 → 이 함수가 /recommend 로 노출됨.
// 환경변수(암호화) GEMINI_KEY 필요.
// 요청: { q, candidates:[{id,n,c,nc,rg,kw,sc}] }  →  응답: { note, stops:[{id,why}] }

const MODEL = "gemini-2.0-flash";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_KEY) return j({ error: "서버에 GEMINI_KEY 미설정" }, 500);
  let body;
  try { body = await request.json(); } catch { return j({ error: "bad json" }, 400); }
  const q = String(body.q || "").slice(0, 600);
  const cands = (Array.isArray(body.candidates) ? body.candidates : []).slice(0, 120);
  if (!q || !cands.length) return j({ error: "q/candidates 필요" }, 400);

  const prompt =
`너는 사용자의 '저장된 장소'들로 하루 나들이 코스를 짜주는 한국어 큐레이터야.
사용자 요청: "${q}"

후보 장소(JSON 배열, 이 안에서만 골라야 함):
${JSON.stringify(cands)}

지침:
- 요청의 지역/음식종류/분위기/시간대/동행 맥락을 최대한 반영.
- 후보 중 3~4곳을 자연스러운 동선과 흐름(예: 식사→카페/산책→술)으로 순서대로 선정.
- 같은 종류만 나열하지 말 것. 무관한 곳 제외.
- 각 장소에 한 줄 추천 이유(why)를 친근하게.
반드시 아래 JSON만 출력:
{"note":"코스 한 줄 요약","stops":[{"id":"후보의 id","why":"추천 이유 한 줄"}]}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
        }),
      }
    );
    const data = await r.json();
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let out; try { out = JSON.parse(txt); } catch { out = { note: "", stops: [] }; }
    if (!Array.isArray(out.stops)) out.stops = [];
    return j(out);
  } catch (e) {
    return j({ error: String(e) }, 502);
  }
}
