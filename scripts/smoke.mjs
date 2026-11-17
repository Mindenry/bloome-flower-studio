/**
 * Smoke test for the running dev/production server.
 * Usage: node scripts/smoke.mjs [baseUrl]
 */
const base = process.argv[2] ?? "http://localhost:3000";

const checks = [
  { path: "/th", expect: [200] },
  { path: "/en", expect: [200] },
  { path: "/th/shop", expect: [200] },
  { path: "/en/shop?sort=price_asc&stock=1", expect: [200] },
  { path: "/th/category/roses", expect: [200] },
  { path: "/th/occasion/birthday", expect: [200] },
  { path: "/th/product/blush-romance-bouquet", expect: [200] },
  { path: "/th/cart", expect: [200] },
  { path: "/th/checkout", expect: [307, 302, 200] },
  { path: "/th/login", expect: [200] },
  { path: "/th/register", expect: [200] },
  { path: "/th/forgot-password", expect: [200] },
  { path: "/th/about", expect: [200] },
  { path: "/th/contact", expect: [200] },
  { path: "/th/faq", expect: [200] },
  { path: "/th/blog", expect: [200] },
  { path: "/th/blog/how-to-choose-flowers", expect: [200] },
  { path: "/th/care-guide", expect: [200] },
  { path: "/th/flower-finder", expect: [200] },
  { path: "/th/policies/privacy-policy", expect: [200] },
  { path: "/th/order/track", expect: [200] },
  { path: "/en/product/garden-whisper", expect: [200] },
  { path: "/th/admin", expect: [307, 302] },
  { path: "/th/account", expect: [307, 302] },
  { path: "/api/health", expect: [200] },
  { path: "/api/search/suggest?q=rose&locale=en", expect: [200] },
  { path: "/api/finder?occasion=birthday&budget=0-3000&color=Pink&locale=th", expect: [200] },
  { path: "/sitemap.xml", expect: [200] },
  { path: "/robots.txt", expect: [200] },
  { path: "/th/nonexistent-page-xyz", expect: [404] },
];

let failures = 0;

for (const check of checks) {
  try {
    const response = await fetch(`${base}${check.path}`, { redirect: "manual" });
    const ok = check.expect.includes(response.status);
    if (!ok) failures += 1;
    console.log(`${ok ? "PASS" : "FAIL"} ${response.status} ${check.path}`);
    if (check.path === "/api/health" && ok) {
      console.log("      ", await response.text());
    }
  } catch (error) {
    failures += 1;
    console.log(`FAIL ERR ${check.path} — ${error.message}`);
  }
}

console.log(`\n${checks.length - failures}/${checks.length} passed`);
process.exit(failures === 0 ? 0 : 1);
