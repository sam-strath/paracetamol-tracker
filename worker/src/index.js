// Sync API for the paracetamol tracker.
// POST /sync/<code>  body: { doses: [ms...], deleted: [ms...] }
// Merges the body with what is stored under <code>, stores the result and returns it.
// The code is a random secret generated on the first device; anyone holding it can sync.

const WEEK = 7 * 24 * 3600 * 1000;

function merge(a, b) {
  const cut = Date.now() - WEEK;
  const deleted = new Set([...(a.deleted || []), ...(b.deleted || [])]);
  const doses = new Set([...(a.doses || []), ...(b.doses || [])]);
  return {
    doses: [...doses].filter(t => !deleted.has(t) && t > cut).sort((x, y) => y - x),
    deleted: [...deleted].filter(t => t > cut).sort((x, y) => y - x),
  };
}

const validList = l => Array.isArray(l) && l.length < 1000 && l.every(n => Number.isFinite(n));

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': origin === env.ALLOWED_ORIGIN ? origin : env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const m = new URL(req.url).pathname.match(/^\/sync\/([A-Z2-7]{24})$/);
    if (req.method !== 'POST' || !m) return json({ error: 'not found' }, 404);
    if (origin !== env.ALLOWED_ORIGIN) return json({ error: 'forbidden' }, 403);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
    if (!validList(body.doses) || !validList(body.deleted)) return json({ error: 'bad data' }, 400);

    const key = m[1];
    const stored = (await env.SYNC.get(key, 'json')) || { doses: [], deleted: [] };
    const merged = merge(stored, body);
    // Only write when something changed: KV's free tier allows far fewer writes than reads.
    // Expire after 30 days without a change.
    if (JSON.stringify(merged) !== JSON.stringify(stored)) {
      await env.SYNC.put(key, JSON.stringify(merged), { expirationTtl: 30 * 24 * 3600 });
    }
    return json(merged);
  },
};
