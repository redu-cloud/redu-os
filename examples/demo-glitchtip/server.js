import { createServer } from "http";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

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

const PORT         = process.env.PORT         || "8091";
const GLITCHTIP_DSN = process.env.GLITCHTIP_DSN || "";

const html = readFileSync(resolve(__dir, "index.html"), "utf8")
  .replaceAll("__GLITCHTIP_DSN__", GLITCHTIP_DSN);

createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}).listen(Number(PORT), "127.0.0.1", () => {
  console.log(`Demo GlitchTip app → http://127.0.0.1:${PORT}`);
  console.log(`  DSN: ${GLITCHTIP_DSN || "NOT SET"}`);
});
