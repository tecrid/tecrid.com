import { env } from "cloudflare:workers";
import { processStripeEvent } from "../../../../lib/tec";

function runtimeSecret() {
  return (env as unknown as Record<string, string | undefined>).STRIPE_WEBHOOK_SECRET ?? "";
}

function foundingPaymentLinkId() {
  return (env as unknown as Record<string, string | undefined>).STRIPE_FOUNDING_PAYMENT_LINK_ID ?? "";
}

function parseSignature(header: string) {
  const parts = header.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) ?? "";
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));
  return { timestamp, signatures };
}

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function POST(request: Request) {
  const secret = runtimeSecret();
  if (!secret) return new Response("Webhook is not configured.", { status: 503 });
  const signatureHeader = request.headers.get("stripe-signature") ?? "";
  const { timestamp, signatures } = parseSignature(signatureHeader);
  const timestampNumber = Number(timestamp);
  if (!timestamp || !Number.isFinite(timestampNumber) || signatures.length === 0) {
    return new Response("Invalid signature header.", { status: 400 });
  }
  if (Math.abs(Date.now() / 1000 - timestampNumber) > 300) {
    return new Response("Signature timestamp is outside the tolerance window.", { status: 400 });
  }

  const body = await request.text();
  const expected = await hmacHex(secret, `${timestamp}.${body}`);
  if (!signatures.some((signature) => constantTimeEqual(signature, expected))) {
    return new Response("Invalid webhook signature.", { status: 400 });
  }

  try {
    const event = JSON.parse(body);
    if (
      event.type === "checkout.session.completed" &&
      event.data?.object?.payment_link !== foundingPaymentLinkId()
    ) {
      return Response.json({ received: true, ignored: true });
    }
    await processStripeEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed." },
      { status: 500 },
    );
  }
}
