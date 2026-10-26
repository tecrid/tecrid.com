import { getEmailUser } from "../lib/email-auth";
import { isIcsAdmin } from "../lib/tec";
import { deliverIssuerReviewMail } from "../lib/issuer-review-notices";
/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { prepareContentSecurityPolicy, applyContentSecurityPolicy } from "../lib/content-security-policy";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  ICS_ADMIN_EMAILS?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async scheduled() { await deliverIssuerReviewMail(); },
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === "www.tecrid.com") {
      url.protocol = "https:";
      url.hostname = "tecrid.com";
      url.port = "";
      return Response.redirect(url.href, 308);
    }

    if (url.pathname === "/pricing" || url.pathname === "/pricing/") {
      return new Response(request.method === "HEAD" ? null : "Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" },
      });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const security = prepareContentSecurityPolicy(request);
    if(url.pathname === "/admin/issuers" || url.pathname.startsWith("/admin/issuers/")) {
      const user=await getEmailUser(request.headers);
      if(!user || !isIcsAdmin(user)) return applyContentSecurityPolicy(new Response("ICS approver access required.",{status:403,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"}}),security.policy);
    }
    const response = await handler.fetch(security.request, env, ctx);
    const secured=applyContentSecurityPolicy(response, security.policy);
    if(url.pathname === "/admin/issuers" || url.pathname.startsWith("/admin/issuers/") || url.pathname === "/account/passkeys" || url.pathname === "/dashboard/team") {
      const headers=new Headers(secured.headers);headers.set("Cache-Control","private, no-store, max-age=0");headers.set("Vary","Cookie");headers.set("X-Robots-Tag","noindex, nofollow");return new Response(secured.body,{status:secured.status,headers});
    }
    return secured;
  },
};

export default worker;
