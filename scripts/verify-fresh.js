#!/usr/bin/env node
import { accessSync, constants, existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
let failures = 0;
let warnings = 0;

function ok(label, detail = "") {
  console.log(`  ${label.padEnd(34)} ok    ${detail}`);
}

function warn(label, detail) {
  warnings += 1;
  console.log(`  ${label.padEnd(34)} warn  ${detail}`);
}

function fail(label, detail) {
  failures += 1;
  console.log(`  ${label.padEnd(34)} fail  ${detail}`);
}

function info(label, detail) {
  console.log(`  ${label.padEnd(34)} info  ${detail}`);
}

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function requireFile(relativePath) {
  if (existsSync(path.join(root, relativePath))) {
    ok(relativePath, "present");
  } else {
    fail(relativePath, "missing");
  }
}

function commandExists(command) {
  try {
    execFileSync("bash", ["-lc", `command -v ${command}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function run(command, args, label) {
  try {
    execFileSync(command, args, {
      cwd: root,
      stdio: "pipe",
      env: process.env
    });
    ok(label);
    return true;
  } catch (error) {
    const output = [
      error.stdout?.toString(),
      error.stderr?.toString()
    ].filter(Boolean).join("\n").trim();

    fail(label, output.split("\n").slice(0, 8).join(" | ") || String(error.message));
    return false;
  }
}

function trackedFiles() {
  try {
    return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function extractNpmScriptsFromDocs(files) {
  const scripts = new Set();
  const pattern = /npm run ([a-zA-Z0-9:_-]+)/g;

  for (const file of files) {
    if (!existsSync(path.join(root, file))) continue;
    const content = read(file);
    let match;
    while ((match = pattern.exec(content))) {
      scripts.add(match[1]);
    }
  }

  return [...scripts].sort();
}

function envKeys(file) {
  return read(file)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.split("=")[0]);
}

function checkExecutable(relativePath) {
  const fullPath = path.join(root, relativePath);
  try {
    accessSync(fullPath, constants.X_OK);
    ok(relativePath, "executable");
  } catch {
    fail(relativePath, "not executable");
  }
}

function checkNoTrackedRuntimeFiles(files) {
  const blocked = files.filter((file) =>
    file === ".env" ||
    file.startsWith(".local/") ||
    file.startsWith("node_modules/") ||
    file.startsWith("dist/") ||
    file.endsWith(".log") ||
    file.endsWith(".pid")
  );

  if (blocked.length === 0) {
    ok("tracked runtime files", "none");
  } else {
    fail("tracked runtime files", blocked.slice(0, 12).join(", "));
  }
}

function checkEnvExamples() {
  const required = [
    "PORT",
    "DASHBOARD_PORT",
    "DASHBOARD_AUTH_EMAIL",
    "DASHBOARD_AUTH_PASSWORD",
    "COLLECTOR_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "QDRANT_URL",
    "QDRANT_COLLECTION",
    "AI_ENABLED",
    "OLLAMA_URL",
    "OLLAMA_MODEL",
    "OLLAMA_EMBED_MODEL",
    "AUTOMATION_WEBHOOK_URL",
    "AUTOMATION_WEBHOOK_URLS",
    "AUTOMATION_WEBHOOK_API_KEY",
    "ACTIVEPIECES_PORT",
    "AP_FRONTEND_URL",
    "AP_ENCRYPTION_KEY",
    "AP_JWT_SECRET",
    "ACTIVEPIECES_EVENT_API_KEY"
  ];

  for (const file of [".env.example", ".env.modular.example"]) {
    const keys = new Set(envKeys(file));
    const missing = required.filter((key) => !keys.has(key));
    if (missing.length === 0) {
      ok(file, "required keys present");
    } else {
      fail(file, `missing ${missing.join(", ")}`);
    }
  }
}

function checkDocScripts(packageJson) {
  const docFiles = [
    "README.md",
    "SECURITY.md",
    "docs/README.md",
    "docs/activepieces.md",
    "docs/deployment-modes.md",
    "docs/local-stack-and-use-cases.md",
    "docs/modular-vm-walkthrough.md"
  ];
  const referenced = extractNpmScriptsFromDocs(docFiles);
  const missing = referenced.filter((script) => !packageJson.scripts?.[script]);

  if (missing.length === 0) {
    ok("documented npm scripts", `${referenced.length} found`);
  } else {
    fail("documented npm scripts", `missing ${missing.join(", ")}`);
  }
}

function checkPackageScripts(packageJson) {
  const required = [
    "check",
    "lint:scripts",
    "doctor",
    "status",
    "stack:up",
    "stack:down",
    "modular:local:up",
    "modular:activepieces:up",
    "modular:uptime:up",
    "activepieces:setup",
    "dashboard",
    "dashboard:auth:setup",
    "demo:full",
    "demo:listmonk",
    "verify:fresh"
  ];
  const missing = required.filter((script) => !packageJson.scripts?.[script]);

  if (missing.length === 0) {
    ok("package scripts", "required scripts present");
  } else {
    fail("package scripts", `missing ${missing.join(", ")}`);
  }
}

function checkComposeFiles() {
  const composeFiles = [
    "podman-compose.yml",
    "compose/collector.yml",
    "compose/collector.same-machine.yml",
    "compose/qdrant.yml",
    "compose/ollama.yml",
    "compose/activepieces.yml",
    "compose/uptime.yml"
  ];

  for (const file of composeFiles) requireFile(file);

  if (!commandExists("podman-compose")) {
    warn("podman-compose config", "podman-compose not installed; skipped compose parsing");
    return;
  }

  for (const file of composeFiles) {
    if (!existsSync(path.join(root, file))) continue;
    run("podman-compose", ["-f", file, "config"], `compose config ${file}`);
  }
}

function checkSecretPatterns(files) {
  const textFiles = files.filter((file) =>
    /\.(md|ts|js|json|yml|yaml|sh|sql|example)$/.test(file) ||
    ["Containerfile", "podman-compose.yml", ".gitignore"].includes(file)
  );

  const allowed = [
    /API_KEY=\s*\n/,
    /ChangeMeStrong123!?/,
    /CHANGE_ME_[A-Z_]+/,
    /PASTE_[A-Z_]+/,
    /change-me-please/,
    /replace-with-/,
    /YOUR_[A-Z_]+_HERE/,
    /AUTO_GENERATE/,
    /\$\{?[A-Z0-9_]+\}?/,
    /local-demo-key/,
    /admin@example\.com/,
    /founder@example\.com/,
    /beta@example\.com/,
    /ops-lead@example\.com/
  ];

  const suspicious = [];
  const patterns = [
    /discord(?:app)?\.com\/api\/webhooks\/[^\s"')]+/i,
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
    /(?:api[_-]?key|secret|password|token)\s*=\s*["']?(?!$|[A-Z0-9_]+$|replace-|your-|change-me|CHANGE_ME|PASTE_|AUTO_GENERATE|\$\{?)[A-Za-z0-9_./+=:-]{32,}/i
  ];

  for (const file of textFiles) {
    const content = read(file);
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (!matches) continue;
      if (allowed.some((allowedPattern) => allowedPattern.test(matches[0]))) continue;
      suspicious.push(`${file}: ${matches[0].slice(0, 100)}`);
    }
  }

  if (suspicious.length === 0) {
    ok("tracked secret scan", "no obvious secrets");
  } else {
    fail("tracked secret scan", suspicious.slice(0, 10).join(" | "));
  }
}

function checkGitignore() {
  const content = read(".gitignore");
  const required = [".env", ".local/", "node_modules/", "dist/", "*.log", "*.pid"];
  const missing = required.filter((entry) => !content.split("\n").includes(entry));

  if (missing.length === 0) {
    ok(".gitignore", "runtime patterns present");
  } else {
    fail(".gitignore", `missing ${missing.join(", ")}`);
  }
}

console.log("reduOS fresh clone verifier\n");

console.log("Required Files:");
for (const file of [
  "README.md",
  "SECURITY.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "Containerfile",
  ".env.example",
  ".env.modular.example",
  "sql/schema.sql"
]) {
  requireFile(file);
}

console.log("\nScripts:");
const packageJson = JSON.parse(read("package.json"));
checkPackageScripts(packageJson);
checkDocScripts(packageJson);

for (const file of trackedFiles().filter((file) => file.startsWith("scripts/") && file.endsWith(".sh"))) {
  checkExecutable(file);
}

run("npm", ["run", "lint:scripts"], "npm run lint:scripts");
run("npm", ["run", "check"], "npm run check");

console.log("\nEnvironment:");
checkEnvExamples();
checkGitignore();

console.log("\nCompose:");
checkComposeFiles();

console.log("\nRepository Hygiene:");
const files = trackedFiles();
if (files.length === 0) {
  warn("git tracked files", "not a git checkout or no tracked files");
} else {
  info("git tracked files", String(files.length));
  checkNoTrackedRuntimeFiles(files);
  checkSecretPatterns(files);
}

console.log();
if (failures === 0) {
  console.log(`Fresh verifier passed with ${warnings} warning(s).`);
  process.exit(0);
}

console.log(`Fresh verifier found ${failures} failure(s) and ${warnings} warning(s).`);
process.exit(1);
