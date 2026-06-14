// 하영의 지도 — AI 추천 코스 Worker (Cloudflare)
// Gemini(무료 티어) 프록시. 비밀키는 wrangler secret(GEMINI_KEY)로 주입.
// 엔드포인트: POST /  { q: "요청문", candidates: [{id,n,c,nc,rg,kw,sc}, ...] }
// 응답: { note, stops: [{id, why}] }

const MODEL = "gemini-2.0-flash";

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (req.method !== "POST") return cors(json({ error: "POST only" }, 405));
    if (!env.GEMINI_KEY) return cors(json({ error: "서버에 GEMINI_KEY 미설정" }, 500));

    let body;
    try { body = await req.json(); } catch { return cors(json({ error: "bad json" }, 400)); }
    const q = String(body.q || "").slice(0, 600);
    const cands = (Array.isArray(body.candidates) ? body.candidates : []).slice(0, 120);
    if (!q || !cands.length) return cors(json({ error: "q/candidates 필요" }, 400));

    const prompt =
`너는 사용자의 '저장된 장소'들로 하루 나들이 코스를 짜주는 한국어 큐레이터야.
사용자 요청: "${q}"

후보 장소(JSON 배열, 이 안에서만 골라야 함):
${JSON.stringify(cands)}

지침:
- 요청의 지역/음식종류/분위기/시간대/동행 맥락을 최대한 반영.
- 후보 중 3~4곳을 자연스러운 동선과 흐름(예: 식사→카페/산책→술 등)으로 순서대로 선정.
- 같은 종류만 나열하지 말고 흐름을 고려. 폐업/무관한 곳 제외.
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
      return cors(json(out));
    } catch (e) {
      return cors(json({ error: String(e) }, 502));
    }
  },
};

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", "*"); // 배포 후 Pages 도메인으로 좁히기 권장
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "content-type");
  return res;
}
