// Builds the static site: each page in _src/pages is wrapped in _src/layout.html and written to the folder its
// "<!-- path: ... -->" line names, with sitemap.xml and robots.txt beside them. A page's own "<!-- key: value -->" lines
// fill {{key}}; a page with "<!-- schema: org -->" carries the Organization JSON-LD.
// GitHub Pages serves the repository as it is, and skips _src because of the leading underscore.
// Run: node build.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const origin = "https://faxcorp.dev";
const layout = readFileSync(join(root, "_src", "layout.html"), "utf8");
const today = new Date().toISOString().slice(0, 10);

const orgSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "FAXCORP",
  legalName: "MB Faxcorp",
  url: `${origin}/`,
  logo: `${origin}/img/icon-512.png`,
  email: "office@faxcorp.dev",
  foundingLocation: "Kaunas, Lithuania",
  address: { "@type": "PostalAddress", streetAddress: "Europos pr. 34-47", addressLocality: "Kaunas", postalCode: "LT-46370", addressCountry: "LT" },
  sameAs: [
    "https://github.com/faxlab",
    "https://store.steampowered.com/search/?developer=FAXCORP",
    "https://www.fab.com/sellers/FaxLab3D",
    "https://www.youtube.com/@Cinema-Fax",
    "https://www.artstation.com/faxlab3d",
    "https://sketchfab.com/FaxLab3D",
    "https://x.com/f4xc0rp",
  ],
  brand: ["SysCap", "zoneq", "Spline Architect", "TopoTopo"].map((name) => ({ "@type": "Brand", name })),
});

// When the page's source last changed, for the sitemap; a page not yet committed counts as today.
function lastModified(file) {
  try { return execFileSync("git", ["log", "-1", "--format=%cs", "--", `_src/pages/${file}`], { cwd: root, encoding: "utf8" }).trim() || today; }
  catch { return today; }
}

const pages = [];
for (const file of readdirSync(join(root, "_src", "pages")).filter((f) => f.endsWith(".html"))) {
  const source = readFileSync(join(root, "_src", "pages", file), "utf8");
  const meta = Object.fromEntries([...source.matchAll(/^<!--\s*(\w+):\s*(.*?)\s*-->\r?$/gm)].map((m) => [m[1], m[2]]));
  const body = source.replace(/^<!--\s*\w+:.*?-->\r?\n/gm, "");
  const computed = {
    canonical: origin + meta.path,
    jsonld: meta.schema === "org" ? `<script type="application/ld+json">${orgSchema}</script>` : "",
  };
  let html = layout.replace("{{content}}", body);
  for (const values of [meta, computed]) for (const [key, value] of Object.entries(values)) html = html.replaceAll(`{{${key}}}`, value);
  // The current page's tab is marked; the others are plain.
  html = html.replace(/<li data-nav="([\w-]+)">/g, (_, name) => (name === meta.nav ? '<li class="current">' : "<li>"));
  const missing = html.match(/\{\{\w+\}\}/);
  if (missing) throw new Error(`${file}: nothing fills ${missing[0]}`);
  if (file === "404.html") html = html.replace("<head>", '<head>\n<meta name="robots" content="noindex">');
  const out = meta.path.endsWith("/") ? join(root, meta.path, "index.html") : join(root, meta.path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  if (file !== "404.html") pages.push({ loc: origin + meta.path, lastmod: lastModified(file) });
  console.log("built", meta.path);
}

pages.push({ loc: `${origin}/paperplane/`, lastmod: today });
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
  .map((p) => `  <url><loc>${p.loc}</loc><lastmod>${p.lastmod}</lastmod></url>`)
  .join("\n")}\n</urlset>\n`;
writeFileSync(join(root, "sitemap.xml"), sitemap);
writeFileSync(join(root, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
console.log("built sitemap.xml and robots.txt");
