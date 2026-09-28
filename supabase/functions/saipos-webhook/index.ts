// Recebe os avisos da Saipos (CONFIRMED, DISPATCHED, CONCLUDED, CANCELLED) e atualiza o status do pedido.
// URL cadastrada no Saipos Developer: .../functions/v1/saipos-webhook?key=<SAIPOS_WEBHOOK_KEY>
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json" } });

// ordem do fluxo: nunca voltar o status para trás
const ORDEM = ["recebido", "confirmado", "preparando", "no_forno", "saiu_entrega", "pronto_retirada", "entregue"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function novoStatus(evento: string, pedido: { status: string; tipo_entrega: string }) {
  switch (evento) {
    case "CONFIRMED": return "confirmado";
    case "DISPATCHED": return pedido.tipo_entrega === "entrega" ? "saiu_entrega" : "pronto_retirada";
    case "CONCLUDED": return "entregue";
    case "CANCELLED": return "cancelado";
    default: return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  const { data: s } = await db.rpc("integracao_segredos");
  const key = new URL(req.url).searchParams.get("key");
  if (!s?.SAIPOS_WEBHOOK_KEY || key !== s.SAIPOS_WEBHOOK_KEY) return json({ erro: "não autorizado" }, 401);

  const payload = await req.json().catch(() => null);
  const evento = String(payload?.event || "").toUpperCase();
  const orderId = String(payload?.order_id || "");
  const pedidoId = UUID.test(orderId) ? orderId : null;
  let resultado = "ignorado";

  if (pedidoId) {
    const { data: p } = await db.from("pedidos").select("id, status, tipo_entrega").eq("id", pedidoId).maybeSingle();
    if (!p) resultado = "pedido não encontrado";
    else {
      const alvo = novoStatus(evento, p);
      if (!alvo) resultado = "evento desconhecido";
      else if (p.status === "cancelado" || p.status === alvo) resultado = "sem mudança";
      else if (alvo !== "cancelado" && ORDEM.indexOf(alvo) < ORDEM.indexOf(p.status)) resultado = `mantido em ${p.status}`;
      else {
        const { error } = await db.from("pedidos").update({ status: alvo }).eq("id", p.id);
        resultado = error ? `erro: ${error.message}` : `${p.status} -> ${alvo}`;
      }
    }
  } else resultado = "order_id fora do site";

  await db.from("saipos_eventos").insert({ evento, pedido_id: pedidoId, payload, resultado });
  return json({ ok: true, resultado });
});
