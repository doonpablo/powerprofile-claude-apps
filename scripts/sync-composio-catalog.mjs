import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiKey = process.env.COMPOSIO_API_KEY;
if (!apiKey) throw new Error("COMPOSIO_API_KEY is required");

const generatedRoot = path.join(root, "plugins", "catalog");
if (!generatedRoot.startsWith(path.join(root, "plugins") + path.sep)) throw new Error("Unsafe generated path");

async function fetchCatalog() {
  const items = [];
  let cursor = null;
  for (let page = 0; page < 100; page += 1) {
    const url = new URL("https://backend.composio.dev/api/v3.1/toolkits");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, { headers: { "x-api-key": apiKey } });
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    const payload = await response.json();
    items.push(...(payload.items || []));
    cursor = payload.next_cursor || null;
    if (!cursor) return items;
  }
  throw new Error("Catalog pagination exceeded safety limit");
}

function safeSlug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
}

function category(item) {
  const first = item.meta?.categories?.[0];
  const value = typeof first === "string" ? first : first?.name || first?.id;
  return safeSlug(value || "productivity") || "productivity";
}

const existingToolkitSlugs = new Set(["gmail", "googledrive", "googlecalendar", "notion", "slack", "canva"]);
const catalog = (await fetchCatalog())
  .filter((item) => item?.slug && item?.name && !existingToolkitSlugs.has(item.slug))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

fs.rmSync(generatedRoot, { recursive: true, force: true });
fs.mkdirSync(generatedRoot, { recursive: true });

const generatedEntries = [];
for (const item of catalog) {
  const slug = safeSlug(item.slug);
  if (!slug) continue;
  const pluginRoot = path.join(generatedRoot, slug);
  const manifestDir = path.join(pluginRoot, ".claude-plugin");
  const skillDir = path.join(pluginRoot, "skills", slug);
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.mkdirSync(skillDir, { recursive: true });

  const description = String(item.meta?.description || `Integração PowerProfile para ${item.name}.`).slice(0, 500);
  const manifest = {
    "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
    name: slug,
    displayName: item.name,
    description,
    author: { name: "PowerProfile" },
    homepage: item.meta?.app_url || "https://powerprofile.com.br",
    license: "Proprietary",
    keywords: ["powerprofile", "connector", "composio", slug, category(item)]
  };
  fs.writeFileSync(path.join(manifestDir, "plugin.json"), JSON.stringify(manifest, null, 2) + "\n");

  const skill = `---\nname: ${slug}\ndescription: Use ${item.name} through the PowerProfile Apps connector when the user requests actions or data from this service.\n---\n\n# ${item.name}\n\nUse the managed MCP server \`PowerProfile Apps\`.\n\n1. Search for tools relevant to the user's request and constrain discovery to toolkit \`${item.slug}\`.\n2. If the account is not connected, use the connection-management tool, present the returned secure link, and wait for completion.\n3. Load only the schemas needed for the current task.\n4. Prefer read-only operations unless the user explicitly requests a change.\n5. Before sending messages, publishing content, deleting data, changing campaigns, making purchases, or performing another consequential external action, ask for confirmation.\n`;
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), skill);

  generatedEntries.push({
    name: slug,
    displayName: item.name,
    description,
    author: { name: "PowerProfile" },
    homepage: item.meta?.app_url || "https://powerprofile.com.br",
    category: category(item),
    keywords: ["powerprofile", "connector", "composio", slug],
    source: `./plugins/catalog/${slug}`
  });
}

const marketplacePath = path.join(root, ".claude-plugin", "marketplace.json");
const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
const handBuilt = marketplace.plugins.filter((entry) => !String(entry.source || "").startsWith("./plugins/catalog/"));
marketplace.plugins = [...handBuilt, ...generatedEntries];
marketplace.description = `Marketplace PowerProfile com ${marketplace.plugins.length} conectores para Claude.`;
fs.writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + "\n");
fs.writeFileSync(path.join(root, "catalog-summary.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalFromComposio: catalog.length + existingToolkitSlugs.size,
  generatedPlugins: generatedEntries.length,
  marketplacePlugins: marketplace.plugins.length
}, null, 2) + "\n");

console.log(JSON.stringify({ ok: true, generated: generatedEntries.length, marketplace: marketplace.plugins.length }));
