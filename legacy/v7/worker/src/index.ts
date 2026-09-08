interface Env {
  DB: D1Database;
  APP_ORIGIN: string;
  API_TOKEN: string;
}

const json = (data: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
});

function cors(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('origin') ?? '';
  return origin.startsWith(env.APP_ORIGIN) ? {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type, x-user-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'vary': 'Origin',
  } : {};
}

function authorised(request: Request, env: Env): boolean {
  return request.headers.get('authorization') === `Bearer ${env.API_TOKEN}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = cors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname === '/health') return json({ ok: true, service: 'quotidien-api' }, 200, headers);
    if (!authorised(request, env)) return json({ error: 'unauthorised' }, 401, headers);

    const userId = request.headers.get('x-user-id');
    if (!userId) return json({ error: 'missing_user' }, 400, headers);

    if (url.pathname === '/api/sync' && request.method === 'GET') {
      const since = url.searchParams.get('since') ?? '1970-01-01T00:00:00.000Z';
      const result = await env.DB.prepare('SELECT entity_id, entity_type, revision, updated_at, deleted_at, payload FROM entities WHERE user_id = ? AND updated_at > ? ORDER BY updated_at').bind(userId, since).all();
      return json({ changes: result.results }, 200, headers);
    }

    if (url.pathname === '/api/sync' && request.method === 'POST') {
      const body = await request.json<{ changes?: Array<{ id:string; kind:string; revision:number; updatedAt:string; deletedAt:string|null }> }>();
      const changes = body.changes ?? [];
      const statements = changes.map(entity => env.DB.prepare(`INSERT INTO entities (user_id, entity_id, entity_type, revision, updated_at, deleted_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, entity_id) DO UPDATE SET entity_type=excluded.entity_type, revision=excluded.revision, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, payload=excluded.payload WHERE excluded.revision >= entities.revision`).bind(userId, entity.id, entity.kind, entity.revision, entity.updatedAt, entity.deletedAt, JSON.stringify(entity)));
      if (statements.length) await env.DB.batch(statements);
      return json({ accepted: changes.length, serverTime: new Date().toISOString() }, 200, headers);
    }

    return json({ error: 'not_found' }, 404, headers);
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const now = new Date().toISOString();
    const due = await env.DB.prepare("SELECT id FROM reminders WHERE status = 'scheduled' AND notify_at <= ? LIMIT 100").bind(now).all<{id:string}>();
    if (due.results.length) await env.DB.batch(due.results.map(item => env.DB.prepare("UPDATE reminders SET status = 'pending' WHERE id = ?").bind(item.id)));
    // L’envoi Web Push sera branché ici après génération des clés VAPID.
  },
};
