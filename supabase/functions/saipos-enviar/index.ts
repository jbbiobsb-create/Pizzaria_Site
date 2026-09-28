// Envia (ou cancela) um pedido do site no PDV Saipos (API de Pedidos).
// Chamada pelo banco (trigger pedidos_saipos_disparar via pg_net) com o header x-internal-key.
// Credenciais no Vault, lidas pela função integracao_segredos() (só service_role).
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

type Segredos = Record<string, string>;
const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json" } });
const n = (v: unknown) => Math.round(Number(v || 0) * 100) / 100;

// "5130776.3803080" -> item 5130776, complemento 3803080
function partes(codigo: string | null | undefined) {
  if (!codigo) return { item: null, choice: null };
  const [item, choice] = String(codigo).split(".");
  return { item: item || null, choice: choice || null };
}

// Cada login novo invalida o token anterior, então o token fica salvo e é reaproveitado.
async function novoToken(s: Segredos) {
  const r = await fetch(`${s.SAIPOS_BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idPartner: s.SAIPOS_ID_PARTNER, secret: s.SAIPOS_SECRET }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw new Error(`Falha no login Saipos (${r.status}): ${JSON.stringify(j)}`);
  await db.from("integracao_tokens").upsert({ nome: "saipos", token: j.token, atualizado_em: new Date().toISOString() });
  return j.token as string;
}

// POST na Saipos com o token salvo; se for recusado, lê o token de novo (outra chamada pode ter renovado) ou renova.
async function saiposPost(s: Segredos, caminho: string, corpo: unknown) {
  const { data } = await db.from("integracao_tokens").select("token").eq("nome", "saipos").maybeSingle();
  let t = data?.token || await novoToken(s);
  for (let tentativa = 1; ; tentativa++) {
    const r = await fetch(`${s.SAIPOS_BASE_URL}${caminho}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: t },
      body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status !== 401 || tentativa >= 3) return { r, j };
    await new Promise((ok) => setTimeout(ok, 300 + Math.random() * 700));
    const { data: atual } = await db.from("integracao_tokens").select("token").eq("nome", "saipos").maybeSingle();
    t = atual?.token && atual.token !== t ? atual.token : await novoToken(s);
  }
}

async function montarItens(itens: any[]) {
  const tamanhos = new Set<string>(), sabores = new Set<string>(), produtos = new Set<string>();
  for (const i of itens) {
    if (i.tipo === "pizza") {
      tamanhos.add(i.detalhes.tamanho);
      (i.detalhes.sabores || []).forEach((s: any) => sabores.add(s.slug));
    } else {
      produtos.add(i.detalhes.slug);
      (i.detalhes.escolhas || []).forEach((e: any) => produtos.add(e.slug));
    }
  }
  const [{ data: tams }, { data: sabs }, { data: prods }] = await Promise.all([
    db.from("tamanhos").select("id, slug, codigo_saipos").in("slug", [...tamanhos]),
    db.from("sabores").select("id, slug, codigo_saipos, sabor_precos(tamanho_id, codigo_saipos)").in("slug", [...sabores]),
    db.from("produtos").select("slug, codigo_saipos").in("slug", [...produtos]),
  ]);
  const tamPorSlug = Object.fromEntries((tams || []).map((t) => [t.slug, t]));
  const sabPorSlug = Object.fromEntries((sabs || []).map((s) => [s.slug, s]));
  const prodPorSlug = Object.fromEntries((prods || []).map((p) => [p.slug, p]));

  return itens.map((i) => {
    const d = i.detalhes || {};
    if (i.tipo === "pizza") {
      const tam = tamPorSlug[d.tamanho];
      const fracao = (d.sabores || []).length > 1 ? `1/${d.sabores.length} ` : "";
      let itemCod: string | null = null;
      const choice_items = (d.sabores || []).map((s: any) => {
        const sab = sabPorSlug[s.slug];
        const cod = sab?.sabor_precos?.find((p: any) => p.tamanho_id === tam?.id)?.codigo_saipos || sab?.codigo_saipos;
        const p = partes(cod);
        itemCod ??= p.item;
        return { integration_code: p.choice || s.slug, desc_item_choice: fracao + s.nome, aditional_price: 0, quantity: 1, notes: "" };
      });
      return {
        integration_code: itemCod || tam?.codigo_saipos || d.tamanho,
        desc_item: i.nome,
        quantity: i.quantidade,
        unit_price: n(i.preco_unitario),
        notes: d.observacao || "",
        choice_items,
      };
    }
    const p = partes(prodPorSlug[d.slug]?.codigo_saipos);
    const choice_items = [
      ...(p.choice ? [{ integration_code: p.choice, desc_item_choice: i.nome, aditional_price: 0, quantity: 1, notes: "" }] : []),
      ...(d.escolhas || []).map((e: any) => ({
        integration_code: prodPorSlug[e.slug]?.codigo_saipos || e.slug,
        desc_item_choice: e.nome, aditional_price: 0, quantity: 1, notes: "",
      })),
    ];
    return {
      integration_code: p.item || d.slug,
      desc_item: i.nome,
      quantity: i.quantidade,
      unit_price: n(i.preco_unitario),
      notes: d.observacao || "",
      choice_items,
    };
  });
}

function pagamento(p: any) {
  const total = n(p.total);
  if (p.pagamento === "dinheiro") return [{ code: "DIN", amount: total, change_for: n(p.troco_para), complement: "", type: "OFFLINE" }];
  if (p.pagamento === "cartao_entrega") return [{ code: "CARD", amount: total, change_for: 0, complement: "", type: "OFFLINE" }];
  // pix (e futuros pagamentos online) já pagos no site
  return [{ code: "PARTNER_PAYMENT", amount: total, change_for: 0, complement: p.pagamento === "pix" ? "pix" : "", type: "ONLINE" }];
}

async function montarPedido(p: any, s: Segredos) {
  const e = p.endereco || {};
  const entrega = p.tipo_entrega === "entrega";
  const previsao = p.agendado_para || new Date(new Date(p.criado_em).getTime() + (p.tempo_max || 60) * 60000).toISOString();
  const notas = [
    p.observacoes,
    p.taxa_a_confirmar ? "ATENÇÃO: taxa de entrega a confirmar (endereço aproximado)." : null,
    p.cupom_codigo ? `Cupom: ${p.cupom_codigo}` : null,
  ].filter(Boolean).join(" | ");
  const pedido: Record<string, unknown> = {
    order_id: p.id,
    display_id: String(p.numero),
    cod_store: s.SAIPOS_COD_STORE,
    created_at: new Date(p.criado_em).toISOString(),
    notes: notas,
    total_increase: 0,
    total_discount: n(p.desconto),
    total_amount: n(p.total),
    customer: {
      id: p.cliente_telefone,
      name: p.cliente_nome,
      phone: p.cliente_telefone,
      ...(p.cliente_email ? { email: p.cliente_email } : {}),
    },
    order_method: {
      mode: entrega ? "DELIVERY" : "TAKEOUT",
      ...(entrega ? { delivery_by: "RESTAURANT", delivery_fee: n(p.taxa_entrega) } : {}),
      scheduled: !!p.agendado_para,
      delivery_date_time: new Date(previsao).toISOString(),
    },
    items: await montarItens(p.pedido_itens || []),
    payment_types: pagamento(p),
  };
  if (entrega) {
    pedido.delivery_address = {
      country: "BR",
      state: e.uf || "",
      city: e.cidade || "",
      district: e.bairro || "",
      street_name: e.rua || "",
      street_number: String(e.numero || ""),
      postal_code: String(e.cep || "").replace(/\D/g, ""),
      reference: e.referencia || "",
      complement: e.complemento || "",
      ...(e.lat && e.lng ? { coordinates: { latitude: Number(e.lat), longitude: Number(e.lng) } } : {}),
    };
  }
  return pedido;
}

async function cancelar(p: any, s: Segredos) {
  try {
    const { r, j } = await saiposPost(s, "/cancel-order", { order_id: p.id, cod_store: s.SAIPOS_COD_STORE });
    if (!r.ok || j.status === false) throw new Error(`Saipos ${r.status}: ${j.errorMessage || JSON.stringify(j)}`);
    await db.from("pedidos").update({ saipos_erro: null }).eq("id", p.id);
    return json({ ok: true, cancelado: true });
  } catch (err) {
    const msg = `Cancelamento na Saipos falhou: ${String((err as Error)?.message || err)}`.slice(0, 1000);
    console.error("saipos-cancelar", p.id, msg);
    await db.from("pedidos").update({ saipos_erro: msg }).eq("id", p.id);
    return json({ ok: false, erro: msg }, 502);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "método" }, 405);
  const { data: s, error: errS } = await db.rpc("integracao_segredos");
  if (errS || !s) return json({ erro: "segredos" }, 500);
  if (!s.SAIPOS_INTERNAL_KEY || req.headers.get("x-internal-key") !== s.SAIPOS_INTERNAL_KEY) return json({ erro: "não autorizado" }, 401);

  const { pedido_id, acao = "enviar" } = await req.json().catch(() => ({}));
  if (!pedido_id) return json({ erro: "pedido_id" }, 400);
  const { data: p, error } = await db.from("pedidos").select("*, pedido_itens(*)").eq("id", pedido_id).single();
  if (error || !p) return json({ erro: "pedido não encontrado" }, 404);
  if (acao === "cancelar") return cancelar(p, s);
  if (p.saipos_status === "enviado") return json({ ok: true, ja_enviado: true });

  const tentativas = (p.saipos_tentativas || 0) + 1;
  let corpo: unknown = null;
  try {
    corpo = await montarPedido(p, s);
    const { r, j } = await saiposPost(s, "/order", corpo);
    if (!r.ok) throw new Error(`Saipos ${r.status}: ${j.errorMessage || JSON.stringify(j)}`);
    await db.from("pedidos").update({
      saipos_status: "enviado",
      saipos_sale_number: j.sale_number != null ? String(j.sale_number) : null,
      saipos_enviado_em: new Date().toISOString(),
      saipos_erro: null,
      saipos_tentativas: tentativas,
    }).eq("id", p.id);
    return json({ ok: true, saipos: j });
  } catch (err) {
    const msg = String((err as Error)?.message || err).slice(0, 1000);
    console.error("saipos-enviar", p.id, msg, JSON.stringify(corpo));
    await db.from("pedidos").update({ saipos_status: "erro", saipos_erro: msg, saipos_tentativas: tentativas }).eq("id", p.id);
    return json({ ok: false, erro: msg }, 502);
  }
});
