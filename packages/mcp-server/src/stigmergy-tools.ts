import { randomUUID } from 'node:crypto';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6334';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const COLLECTION = 'pheromone_trails';

async function qdrantFetch(path: string, opts: RequestInit = {}): Promise<Record<string, unknown>> {
  const headers = new Headers(opts.headers || {});
  if (QDRANT_API_KEY) headers.set('api-key', QDRANT_API_KEY);
  if (opts.body) headers.set('content-type', 'application/json');
  const resp = await fetch(`${QDRANT_URL}${path}`, { ...opts, headers });
  if (!resp.ok) throw new Error(`Qdrant ${resp.status}: ${await resp.text()}`);
  return resp.json() as Promise<Record<string, unknown>>;
}

async function embed(text: string): Promise<number[]> {
  const ollamaUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const model = process.env.EMBED_MODEL || process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
  const resp = await fetch(`${ollamaUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt: text }),
  });
  if (!resp.ok) throw new Error(`Ollama embed ${resp.status}`);
  const data = await resp.json() as { embedding: number[] };
  return data.embedding;
}

export async function stigmergyDeposit(args: {
  trace_type: string;
  content: string;
  strength?: number;
  tags?: string[];
  ttl_hours?: number;
}): Promise<{ trace_id: string; deposited_at: string }> {
  const traceId = randomUUID();
  const depositedAt = new Date().toISOString();
  const ttlHours = args.ttl_hours || 24;
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  const vector = await embed(args.content);

  await qdrantFetch(`/collections/${COLLECTION}/points`, {
    method: 'PUT',
    body: JSON.stringify({
      points: [{
        id: traceId,
        vector,
        payload: {
          trace_type: args.trace_type,
          content: args.content,
          strength: args.strength ?? 1.0,
          tags: args.tags || [],
          deposited_at: depositedAt,
          expires_at: expiresAt,
        },
      }],
    }),
  });

  return { trace_id: traceId, deposited_at: depositedAt };
}

export async function stigmergySense(args: {
  query: string;
  min_strength?: number;
  max_age_hours?: number;
  limit?: number;
}): Promise<Array<{ trace_id: string; content: string; trace_type: string; strength: number; score: number; deposited_at: string; tags: string[] }>> {
  const vector = await embed(args.query);
  const limit = args.limit || 10;
  const minStrength = args.min_strength || 0.1;
  const maxAgeHours = args.max_age_hours || 168;
  const minDepositedAt = new Date(Date.now() - maxAgeHours * 3600 * 1000).toISOString();

  const filter: Record<string, unknown> = {
    must: [
      { key: 'strength', range: { gte: minStrength } },
      { key: 'deposited_at', range: { gte: minDepositedAt } },
    ],
  };

  const result = await qdrantFetch(`/collections/${COLLECTION}/points/search`, {
    method: 'POST',
    body: JSON.stringify({ vector, limit, filter, with_payload: true }),
  });

  const results = (result.result as Array<{ id: string; score: number; payload: Record<string, unknown> }>) || [];
  return results.map(r => ({
    trace_id: r.id,
    content: r.payload.content as string,
    trace_type: r.payload.trace_type as string,
    strength: r.payload.strength as number,
    score: r.score,
    deposited_at: r.payload.deposited_at as string,
    tags: (r.payload.tags as string[]) || [],
  }));
}

export async function stigmergyDecay(args: { decay_rate: number }): Promise<{ traces_decayed: number; traces_removed: number }> {
  const rate = Math.max(0, Math.min(1, args.decay_rate));
  const scrollResult = await qdrantFetch(`/collections/${COLLECTION}/points/scroll`, {
    method: 'POST',
    body: JSON.stringify({ limit: 1000, with_payload: true, with_vector: false }),
  });

  const points = ((scrollResult.result as { points: Array<{ id: string; payload: Record<string, unknown> }> })?.points) || [];
  const toDelete: string[] = [];
  const toUpdate: Array<{ id: string; payload: Record<string, unknown> }> = [];

  for (const p of points) {
    const currentStrength = (p.payload.strength as number) || 1.0;
    const newStrength = currentStrength * (1 - rate);
    if (newStrength < 0.1) {
      toDelete.push(p.id);
    } else {
      toUpdate.push({ id: p.id, payload: { ...p.payload, strength: newStrength } });
    }
  }

  for (const u of toUpdate) {
    await qdrantFetch(`/collections/${COLLECTION}/points/payload`, {
      method: 'POST',
      body: JSON.stringify({ payload: u.payload, points: [u.id] }),
    });
  }

  if (toDelete.length > 0) {
    await qdrantFetch(`/collections/${COLLECTION}/points/delete`, {
      method: 'POST',
      body: JSON.stringify({ points: toDelete }),
    });
  }

  return { traces_decayed: toUpdate.length, traces_removed: toDelete.length };
}
