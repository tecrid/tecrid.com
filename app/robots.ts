import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/certify/", "/confirm/", "/dashboard/", "/join/success"],
    }],
    sitemap: "https://tecrid.com/sitemap.xml",
    host: "https://tecrid.com",
  };
}
