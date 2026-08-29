import type { MetadataRoute } from "next";

const origin = "https://tecrid.com";
const lastModified = new Date("2026-08-29T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${origin}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/what-is-a-tecrid`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${origin}/for-laboratories`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/laboratory-pilot`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${origin}/for-brands`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/for-certifiers-retailers`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/why`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/standard`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/verify`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/issuers`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${origin}/participants`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${origin}/badge`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${origin}/submit-report`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${origin}/join`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${origin}/pricing`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${origin}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.5 },
    { url: `${origin}/developers`, lastModified, changeFrequency: "monthly", priority: 0.6 },
  ];
}
