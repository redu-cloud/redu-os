import { createServer } from "http";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

// Parse .env manually — no dependencies needed
function loadEnv() {
  try {
    const lines = readFileSync(resolve(__dir, ".env"), "utf8").split("\n");
    for (const line of lines) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();

const PORT           = process.env.PORT           || "8090";
const UMAMI_URL      = process.env.UMAMI_URL      || "http://127.0.0.1:3002";
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID || "";
const REDUOS_URL     = process.env.REDUOS_URL     || "http://127.0.0.1:3006";

const html = readFileSync(resolve(__dir, "index.html"), "utf8")
  .replaceAll("__UMAMI_URL__",        UMAMI_URL)
  .replaceAll("__UMAMI_WEBSITE_ID__", UMAMI_WEBSITE_ID)
  .replaceAll("__REDUOS_URL__",       REDUOS_URL);

createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}).listen(Number(PORT), "127.0.0.1", () => {
  console.log(`Demo website → http://127.0.0.1:${PORT}`);
  console.log(`  Umami:   ${UMAMI_URL}  (id: ${UMAMI_WEBSITE_ID || "NOT SET"})`);
  console.log(`  reduOS:  ${REDUOS_URL}`);
});
