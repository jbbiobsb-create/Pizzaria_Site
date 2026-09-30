// Cliente mínimo do Supabase para o site público: só RPC (fetch direto em /rest/v1/rpc/<fn>).
// Mesma interface que o site usa do supabase-js: supabase.rpc(fn, args) → { data, error }.
// O painel da equipe (admin/) precisa de auth/from/channel e carrega o supabase-js real em admin/supabase.js.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

async function rpc(fn, args = {}, { signal } = {}) {
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify(args),
    });
  } catch (e) {
    return { data: null, error: { message: e?.message || 'Failed to fetch', code: 'rede' } };
  }
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) return { data: null, error: { message: data?.message || data?.hint || `HTTP ${r.status}`, code: data?.code, status: r.status } };
  return { data, error: null };
}

export const supabase = { rpc };
