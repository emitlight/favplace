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
`너는 사용자가 '저장해 둔 장소'만으로 나들이 코스를 설계하는 한국어 로컬 큐레이터야.
사용자 요청: "${q}"

후보 장소(JSON, 반드시 이 안에서만 선택):
${JSON.stringify(cands)}

작성 지침:
- 요청의 지역·음식종류·분위기·시간대·동행·날씨 맥락을 해석해서 반영.
- 후보 중 3~5곳을 자연스러운 동선/흐름(식사→카페·산책→술 등)으로 순서대로 선정. 같은 종류만 나열 금지, 무관한 곳 제외.
- intro: 요청을 어떻게 이해했고 왜 이 코스인지 2~3문장의 짧은 큐레이션 노트(친근하게).
- 각 stop.why: 그 장소를 고른 이유 + 작은 팁을 한두 문장.
- tips: 동선·시간·주차·날씨 등 실용 팁 한 줄(없으면 빈 문자열 "").
- 후보에 마땅한 곳이 없으면 stops는 빈 배열로 두고 intro로 솔직히 이유를 설명.
반드시 아래 JSON만 출력:
{"title":"코스 제목","intro":"큐레이션 노트","stops":[{"id":"후보의 id","why":"이유+팁"}],"tips":"실용 팁"}`;

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
    let out; try { out = JSON.parse(txt); } catch { out = {}; }
    out = out || {};
    if (!Array.isArray(out.stops)) out.stops = [];
    out.title = typeof out.title === "string" ? out.title : "";
    out.intro = typeof out.intro === "string" ? out.intro : (typeof out.note === "string" ? out.note : "");
    out.tips = typeof out.tips === "string" ? out.tips : "";
    return j(out);
  } catch (e) {
    return j({ error: String(e) }, 502);
  }
}
