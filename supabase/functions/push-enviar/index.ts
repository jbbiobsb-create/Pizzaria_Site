// Envia Web Push aos aparelhos que acompanham um pedido (tabela push_assinaturas).
// Chamada pelo banco (trigger pedidos_push_disparar → push_disparar via pg_net) com o header x-internal-key.
// Chaves VAPID no Vault (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, formato base64url raw do `web-push`),
// lidas por integracao_segredos() (só service_role) e convertidas para JWK para o @negrel/webpush
// (biblioteca 100% WebCrypto/fetch — sem Node-compat — recomendada para o Supabase Edge Runtime).
import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });

const CONTATO = "mailto:contato@sesconettos.com.br";
const ICON = "/img/icons/icon-192.png";
const BADGE = "/img/icons/badge-96.png";

// Textos por status (PT-BR). `p.lojas?.nome` = loja do pedido.
const TEXTOS: Record<string, (p: any) => { title: string; body: string }> = {
  confirmado:      (p) => ({ title: `Pedido #${p.numero} confirmado!`,      body: "Já vamos preparar." }),
  preparando:      (p) => ({ title: `Pedido #${p.numero} em preparo`,       body: "Estamos abrindo a massa e montando sua pizza." }),
  no_forno:        (p) => ({ title: `Pedido #${p.numero} no forno`,         body: "Sua pizza está no forno 🔥" }),
  saiu_entrega:    (p) => ({ title: `Pedido #${p.numero}: saiu para entrega!`, body: "Seu pedido está a caminho." }),
  pronto_retirada: (p) => ({ title: `Pedido #${p.numero} pronto`,           body: `Pronto para retirar na loja ${p.lojas?.nome ?? "Sesconetto's"}.` }),
  entregue:        (p) => ({ title: `Pedido #${p.numero} concluído`,        body: "Bom apetite! Obrigado por pedir na Sesconetto's." }),
  cancelado:       (p) => ({ title: `Pedido #${p.numero} cancelado`,        body: "Fale com a gente pelo WhatsApp se tiver dúvida." }),
};

// base64url (raw) → bytes
function b64urlParaBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function bytesParaB64url(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Chaves VAPID do `web-push` (pública 65 bytes 0x04||X||Y, privada 32 bytes) → JWK {kty:EC, crv:P-256, x, y, d}
function vapidParaJwk(pub: string, priv: string): webpush.ExportedVapidKeys {
  const p = b64urlParaBytes(pub.trim());
  const d = b64urlParaBytes(priv.trim());
  if (p.length !== 65 || p[0] !== 0x04) throw new Error(`VAPID_PUBLIC_KEY inválida (${p.length} bytes)`);
  if (d.length !== 32) throw new Error(`VAPID_PRIVATE_KEY inválida (${d.length} bytes)`);
  const x = bytesParaB64url(p.slice(1, 33)), y = bytesParaB64url(p.slice(33, 65));
  return {
    publicKey: { kty: "EC", crv: "P-256", x, y },
    privateKey: { kty: "EC", crv: "P-256", x, y, d: bytesParaB64url(d) },
  };
}

// comparação em tempo constante: SHA-256 dos dois lados e igualdade byte a byte (sem short-circuit)
async function chaveConfere(recebida: string | null, esperada: string): Promise<boolean> {
  if (!recebida || !esperada) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(recebida)),
    crypto.subtle.digest("SHA-256", enc.encode(esperada)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

let appServer: webpush.ApplicationServer | null = null;
async function servidor(pub: string, priv: string) {
  if (appServer) return appServer;
  const vapidKeys = await webpush.importVapidKeys(vapidParaJwk(pub, priv), { extractable: false });
  appServer = await webpush.ApplicationServer.new({ contactInformation: CONTATO, vapidKeys });
  return appServer;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "método" }, 405);
  const { data: s, error: errS } = await db.rpc("integracao_segredos");
  if (errS || !s) return json({ erro: "segredos" }, 500);
  if (!s.SAIPOS_INTERNAL_KEY || !(await chaveConfere(req.headers.get("x-internal-key"), s.SAIPOS_INTERNAL_KEY))) return json({ erro: "não autorizado" }, 401);
  if (!s.VAPID_PUBLIC_KEY || !s.VAPID_PRIVATE_KEY) return json({ erro: "VAPID não configurado" }, 500);

  const { pedido_id, status } = await req.json().catch(() => ({}));
  if (!pedido_id || !TEXTOS[status]) return json({ erro: "payload" }, 400);
  const { data: p } = await db.from("pedidos").select("id, numero, status, tipo_entrega, lojas(nome)").eq("id", pedido_id).single();
  if (!p) return json({ erro: "pedido" }, 404);
  const { data: subs } = await db.from("push_assinaturas").select("id, subscription").eq("pedido_id", pedido_id);
  if (!subs?.length) return json({ ok: true, enviados: 0 });

  let app: webpush.ApplicationServer;
  try { app = await servidor(s.VAPID_PUBLIC_KEY, s.VAPID_PRIVATE_KEY); }
  catch (err) { console.error("push-enviar vapid", String(err)); return json({ erro: "VAPID: " + String((err as Error)?.message || err) }, 500); }

  const t = TEXTOS[status](p);
  const payload = JSON.stringify({
    title: t.title, body: t.body, icon: ICON, badge: BADGE, tag: `pedido-${p.id}`, renotify: true, lang: "pt-BR",
    data: { url: `/pedido.html?id=${p.id}`, pedido: p.id, status },
  });
  const urgencia = ["saiu_entrega", "pronto_retirada", "cancelado"].includes(status) ? webpush.Urgency.High : webpush.Urgency.Normal;
  let enviados = 0, removidos = 0, erros = 0;
  await Promise.all(subs.map(async (a) => {
    try {
      const sub = a.subscription as webpush.PushSubscription;
      await app.subscribe(sub).pushTextMessage(payload, { ttl: 3600, urgency: urgencia, topic: "pedido" });
      await db.from("push_assinaturas").update({ ultimo_envio: new Date().toISOString(), ultimo_erro: null }).eq("id", a.id);
      enviados++;
    } catch (err) {
      const code = err instanceof webpush.PushMessageError ? err.response.status : undefined;
      if (code === 404 || code === 410) {
        // assinatura expirada/cancelada no navegador: some
        await db.from("push_assinaturas").delete().eq("id", a.id); removidos++;
      } else {
        const corpo = err instanceof webpush.PushMessageError ? await err.response.text().catch(() => "") : "";
        const msg = `${code ?? ""} ${String((err as Error)?.message || err)} ${corpo}`.trim().slice(0, 500);
        // detalhe do erro fica só na tabela (ultimo_erro); o log tem apenas contagens
        await db.from("push_assinaturas").update({ ultimo_erro: msg }).eq("id", a.id); erros++;
      }
    }
  }));
  // último aviso do pedido: solta as assinaturas
  if (status === "entregue" || status === "cancelado") await db.from("push_assinaturas").delete().eq("pedido_id", pedido_id);
  console.info("push-enviar", JSON.stringify({ status, assinaturas: subs.length, enviados, removidos, erros }));
  return json({ ok: true, enviados, removidos, erros });
});
