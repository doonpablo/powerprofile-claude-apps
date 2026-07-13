import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const marketplacePath = path.join(root, ".claude-plugin", "marketplace.json");
const selected = new Set([
  "gmail", "google-drive", "google-agenda", "outlook", "microsoft-teams",
  "slack", "notion", "github", "trello", "hubspot", "salesforce",
  "dropbox", "canva", "shopify", "jira"
]);
const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
const byName = new Map(marketplace.plugins.map((plugin) => [plugin.name, plugin]));
const missing = [...selected].filter((name) => !byName.has(name));
if (missing.length) throw new Error(`Missing curated plugins: ${missing.join(", ")}`);
marketplace.name = "powerprofile-connectors";
marketplace.description = "Conectores PowerProfile reais e instalaveis para os aplicativos mais usados.";
marketplace.plugins = [...selected].map((name) => byName.get(name));
for (const plugin of marketplace.plugins) {
  const source = path.resolve(root, String(plugin.source).replace(/^\.\//, ""));
  if (!source.startsWith(path.join(root, "plugins") + path.sep)) throw new Error(`Unsafe plugin source: ${plugin.source}`);
  if (!fs.existsSync(path.join(source, ".mcp.json"))) throw new Error(`Connector config missing: ${plugin.name}`);
  const manifestPath = path.join(source, ".claude-plugin", "plugin.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.version ||= "1.0.0";
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  plugin.version = manifest.version;
  plugin.defaultEnabled = false;
  plugin.keywords = [...new Set([...(plugin.keywords || []), "conector-real", "mcp", "oauth"] )];
}
fs.writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, connectors: marketplace.plugins.map(({ name }) => name) }));
