// Cloudflare Pages Function — /naver-sync
// favplace의 변경을 네이버 즐겨찾기 "원본"에 반영한다.
//
// ⚠️ 되돌리기 어려운 작업이라 3중 잠금:
//   1) 환경변수 NAVER_COOKIE 없으면 아무것도 안 함(503)
//   2) 쓰기는 NAVER_SYNC_WRITE === "on" 일 때만 허용(403)
//   3) 요청 바디에 confirm:true 가 없으면 실행 안 하고 "무엇을 할 것인지"만 되돌려줌(dry-run)
//
// 2026-08-17 HAR 캡처로 확인된 네이버 API (상세는 저장소 NOTES_api.md):
//   · DELETE /save-pages/api/maps-bookmark/v3/folders/{folderId}/mapping
//       body {"bookmarkIds":[...]} → 그 폴더에서 제거. **토큰 불필요, 쿠키만 필요.**
//       응답 unmappedBookmarkIds(폴더에서 뺌) / removedBookmarkIds(즐겨찾기 자체가 삭제됨) 로 구분됨.
//   · PATCH /save-widget/api/maps-bookmark/bookmarks/{bookmarkId}
//       이름·메모·폴더이동. 바디에 정체불명의 token 이 필요해서 아직 미구현(501).
//
// ⚠️ 경로에 쓰는 값은 sid(장소ID)가 아니라 bookmarkId(즐겨찾기 레코드ID)다.
//    sid → bookmarkId 변환은 action=resolve 로 얻는다.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };
const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const PAGES_ORIGIN = "https://pages.map.naver.com";
const MAX_BATCH = 25;   // 한 번에 건드릴 수 있는 최대 개수

function naverHeaders(cookie, extra = {}) {
  return {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Origin": PAGES_ORIGIN,
    "Referer": PAGES_ORIGIN + "/save-pages/pc/detail-list/",
    "Cookie": cookie,
    ...extra,
  };
}

// 즐겨찾기 전체 동기화 페이로드 (읽기 전용)
async function fetchSync(cookie) {
  const r = await fetch("https://map.naver.com/p/api/bookmark", {
    headers: {
      "User-Agent": UA, "Accept": "application/json", "Accept-Language": "ko-KR,ko;q=0.9",
      "Referer": "https://map.naver.com/", "Cookie": cookie,
    },
  });
  if (!r.ok) throw new Error("bookmark sync 실패: HTTP " + r.status);
  const d = await r.json();
  const bs = ((d.my || {}).bookmarkSync || {}).bookmarks;
  if (!bs) throw new Error("응답에 북마크가 없음 — 쿠키가 만료됐을 수 있음");
  return d;
}

function indexBookmarks(d) {
  const bySid = {}, byId = {};
  for (const e of d.my.bookmarkSync.bookmarks) {
    const b = e.bookmark || {};
    if (!b.bookmarkId) continue;
    const rec = {
      bookmarkId: b.bookmarkId, sid: b.sid, name: b.name, memo: b.memo,
      folderIds: (e.folderMappings || []).map(m => m.folderId),
    };
    byId[b.bookmarkId] = rec;
    if (b.sid) bySid[b.sid] = rec;
  }
  return { bySid, byId };
}

function folderList(d) {
  return (d.my.folderSync.folders || []).map(f => {
    const b = f.folder || f;
    return { folderId: b.folderId, name: b.name, count: b.bookmarkCount, isDefault: !!b.isDefaultFolder };
  });
}

/* ---------- GET: 상태 확인 · sid→bookmarkId 변환 (모두 읽기 전용) ---------- */
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "ping";
  const hasCookie = !!env.NAVER_COOKIE;
  const writeEnabled = hasCookie && env.NAVER_SYNC_WRITE === "on";

  if (action === "ping") {
    return j({
      ok: true, hasCookie, writeEnabled,
      supported: { unmapFolder: true, delete: "unmapFolder로 모든 폴더에서 빼면 삭제됨", createFolder: true, deleteFolder: "빈 리스트만", memo: false, rename: false, moveFolder: false },
      note: writeEnabled ? "쓰기 가능 (단, confirm:true 필요)" : "읽기/상태만 가능",
    });
  }
  if (!hasCookie) return j({ error: "NAVER_COOKIE 미설정 — Cloudflare에 직접 등록해야 동작" }, 503);

  try {
    if (action === "folders") {
      return j({ ok: true, folders: folderList(await fetchSync(env.NAVER_COOKIE)) });
    }
    if (action === "snapshot") {
      // 네이버에 저장된 "지금 이 순간"의 즐겨찾기 전체 — 앱이 로컬 places.json 과 대조하는 용도
      const d = await fetchSync(env.NAVER_COOKIE);
      const { byId } = indexBookmarks(d);
      return j({
        ok: true,
        fetchedAt: Date.now(),
        folders: folderList(d),
        bookmarks: Object.values(byId).map(b => ({
          bookmarkId: b.bookmarkId, sid: b.sid, name: b.name, memo: b.memo || "", folderIds: b.folderIds,
        })),
      });
    }
    if (action === "resolve") {
      const sids = (url.searchParams.get("sids") || "").split(",").map(s => s.trim()).filter(Boolean);
      if (!sids.length) return j({ error: "sids 파라미터 필요 (쉼표 구분)" }, 400);
      const { bySid } = indexBookmarks(await fetchSync(env.NAVER_COOKIE));
      const found = {}, missing = [];
      for (const s of sids) { if (bySid[s]) found[s] = bySid[s]; else missing.push(s); }
      return j({ ok: true, found, missing });
    }
  } catch (e) {
    return j({ error: String(e.message || e) }, 502);
  }
  return j({ error: "지원하지 않는 action", allowed: ["ping", "folders", "resolve", "snapshot"] }, 400);
}

/* ---------- POST: 쓰기 ---------- */
export async function onRequestPost({ request, env }) {
  if (!env.NAVER_COOKIE) return j({ error: "NAVER_COOKIE 미설정" }, 503);
  if (env.NAVER_SYNC_WRITE !== "on") return j({ error: "쓰기 비활성 (NAVER_SYNC_WRITE=on 필요)" }, 403);

  let body; try { body = await request.json(); } catch { return j({ error: "bad json" }, 400); }
  const action = String(body.action || "");
  const cookie = env.NAVER_COOKIE;

  // ── 리스트(폴더) 만들기 — 토큰 불필요 ──
  if (action === "createFolder") {
    const name = String(body.name || "").trim();
    if (!name) return j({ error: "name 필요" }, 400);
    if (name.length > 40) return j({ error: "이름은 40자까지" }, 400);
    if (!body.confirm) return j({ dryRun: true, willCreate: name, note: "실행하려면 confirm:true" });
    const r = await fetch(`${PAGES_ORIGIN}/save-widget/api/maps-bookmark/folders/new?t=${Date.now()}`, {
      method: "POST",
      headers: naverHeaders(cookie, { "content-type": "application/json" }),
      body: JSON.stringify({ name, colorCode: String(body.colorCode || "1"), isPublished: false, isExposed: false }),
    });
    const text = await r.text();
    let out; try { out = JSON.parse(text); } catch { out = { raw: text.slice(0, 400) }; }
    if (!r.ok) return j({ ok: false, status: r.status, response: out }, 502);
    return j({ ok: true, folderId: out.folderId, name: out.name, colorCode: out.colorCode });
  }

  // ── 리스트(폴더) 삭제 — 토큰 불필요 ──
  // ⚠️ 캡처는 빈 폴더 2건뿐이었다. 장소가 든 폴더를 지웠을 때 그 장소들이 살아남는지 검증되지 않아
  //    기본적으로 비어있지 않은 폴더는 거부한다(allowNonEmpty 로만 강제 가능).
  if (action === "deleteFolder") {
    const folderId = Number(body.folderId);
    if (!folderId) return j({ error: "folderId 필요" }, 400);

    let snap; try { snap = await fetchSync(cookie); } catch (e) { return j({ error: String(e.message || e) }, 502); }
    const folder = folderList(snap).find(f => f.folderId === folderId);
    if (!folder) return j({ error: "그런 폴더가 없음", folderId }, 404);
    if (folder.isDefault) return j({ error: "기본 폴더(내 장소)는 삭제할 수 없음" }, 400);

    const { byId } = indexBookmarks(snap);
    const members = Object.values(byId).filter(b => b.folderIds.includes(folderId));
    const onlyHere = members.filter(b => b.folderIds.length <= 1);

    if (members.length && !body.allowNonEmpty) {
      return j({
        error: "비어있지 않은 리스트입니다",
        folderId, name: folder.name, count: members.length, onlyHere: onlyHere.length,
        note: "장소가 든 리스트를 지웠을 때 그 장소들이 남는지 아직 검증되지 않았습니다. " +
              "먼저 unmapFolder 로 장소를 비운 뒤 삭제하세요.",
      }, 409);
    }
    if (!body.confirm) {
      return j({
        dryRun: true, folderId, name: folder.name, count: members.length,
        onlyHere: onlyHere.map(b => b.name).slice(0, 25),
        결과: members.length ? "⚠️ 검증되지 않은 동작" : "빈 리스트 삭제 (장소 영향 없음)",
        note: "실행하려면 confirm:true",
      });
    }
    const r = await fetch(`${PAGES_ORIGIN}/save-pages/api/maps-bookmark/v3/folders/${folderId}`, {
      method: "DELETE",
      headers: naverHeaders(cookie, { "content-type": "application/json" }),
      body: "{}",
    });
    const text = await r.text();
    let out; try { out = JSON.parse(text); } catch { out = { raw: text.slice(0, 400) }; }
    if (!r.ok) return j({ ok: false, status: r.status, response: out }, 502);
    return j({ ok: true, folderId, name: folder.name, response: out });
  }

  if (action !== "unmapFolder") {
    return j({
      error: "아직 구현되지 않은 action",
      requested: action,
      supported: ["unmapFolder", "createFolder", "deleteFolder"],
      note: "메모·이름변경·폴더에 장소 추가는 save-widget 북마크 PATCH가 필요한데 그 바디의 token 출처를 아직 못 찾았음",
    }, 501);
  }

  // ── 폴더에서 빼기 (모든 폴더에서 빠지면 즐겨찾기 자체가 삭제됨) ──
  const folderId = Number(body.folderId);
  if (!folderId) return j({ error: "folderId 필요" }, 400);

  let ids = Array.isArray(body.bookmarkIds) ? body.bookmarkIds.map(Number).filter(Boolean) : [];
  const sids = Array.isArray(body.sids) ? body.sids.map(String) : [];

  let snapshot = null, unresolved = [];
  if (sids.length || !body.confirm) {
    try { snapshot = indexBookmarks(await fetchSync(cookie)); }
    catch (e) { return j({ error: String(e.message || e) }, 502); }
  }
  if (sids.length) {
    for (const s of sids) {
      const rec = snapshot.bySid[s];
      if (rec) ids.push(rec.bookmarkId); else unresolved.push(s);
    }
  }
  ids = [...new Set(ids)];
  if (!ids.length) return j({ error: "대상이 없음 (bookmarkIds 또는 sids 필요)", unresolved }, 400);
  if (ids.length > MAX_BATCH) return j({ error: `한 번에 최대 ${MAX_BATCH}개까지만 가능`, requested: ids.length }, 400);

  // dry-run: confirm 없으면 "무엇이 어떻게 되는지"만 알려주고 끝
  if (!body.confirm) {
    const preview = ids.map(id => {
      const rec = snapshot.byId[id];
      if (!rec) return { bookmarkId: id, warn: "즐겨찾기에 없는 ID" };
      const rest = rec.folderIds.filter(f => f !== folderId);
      return {
        bookmarkId: id, sid: rec.sid, name: rec.name,
        현재폴더: rec.folderIds, 실행후: rest,
        결과: rest.length ? "폴더에서만 제거" : "⚠️ 즐겨찾기 자체가 삭제됨",
      };
    });
    return j({ dryRun: true, folderId, count: ids.length, unresolved, preview, note: "실제로 실행하려면 같은 요청에 confirm:true 추가" });
  }

  const r = await fetch(`${PAGES_ORIGIN}/save-pages/api/maps-bookmark/v3/folders/${folderId}/mapping`, {
    method: "DELETE",
    headers: naverHeaders(cookie, { "content-type": "application/json" }),
    body: JSON.stringify({ bookmarkIds: ids }),
  });
  const text = await r.text();
  let out; try { out = JSON.parse(text); } catch { out = { raw: text.slice(0, 500) }; }
  if (!r.ok) return j({ ok: false, status: r.status, response: out }, 502);

  return j({
    ok: true, folderId, requested: ids, unresolved,
    폴더에서제거됨: out.unmappedBookmarkIds || [],
    완전삭제됨: out.removedBookmarkIds || [],
    존재하지않음: out.nonExistentBookmarkIds || [],
    updateDate: out.updateDate,
  });
}
