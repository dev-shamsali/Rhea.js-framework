// Audits the monorepo and every workspace with the real `npm audit`, prints one line per target, and exits 1 on any finding.
// Usage: node scripts/audit-all.mjs [--json-out <file>]. Generated projects are audited by `npm run test:security`.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";
const out = process.argv.includes("--json-out") ? process.argv[process.argv.indexOf("--json-out") + 1] : null;
const workspaces = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).workspaces.flatMap((g) => {
  const base = g.replace(/\/\*$/, "");
  return readdirSync(join(root, base), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => `${base}/${d.name}`);
});

const targets = [
  { dir: ".", args: [] },
  { dir: ".", args: ["--omit=dev"] },
];
for (const w of workspaces) {
  try {
    JSON.parse(readFileSync(join(root, w, "package.json"), "utf8"));
  } catch {
    continue; // not a workspace (for example a build folder)
  }
  targets.push({ dir: w, args: ["-w", w] }, { dir: w, args: ["-w", w, "--omit=dev"] });
}

let failed = false;
const evidence = [];
for (const t of targets) {
  const command = ["npm", "audit", "--audit-level=low", "--json", ...t.args];
  const r = spawnSync(command[0], command.slice(1), { cwd: root, encoding: "utf8", shell: win, maxBuffer: 64 * 1024 * 1024 });
  let counts = null;
  try {
    counts = JSON.parse(r.stdout).metadata.vulnerabilities;
  } catch {
    /* no report */
  }
  const ok = r.status === 0 && counts !== null && counts.total === 0;
  if (!ok) failed = true;
  evidence.push({ directory: t.dir, command: ["npm", "audit", "--audit-level=low", ...t.args].join(" "), exitCode: r.status, vulnerabilities: counts });
  console.log(`${ok ? "PASS" : "FAIL"}  ${t.dir.padEnd(18)} npm audit ${t.args.join(" ").padEnd(24)} ${counts ? JSON.stringify(counts) : "no report"}`);
}
if (out) writeFileSync(out, JSON.stringify(evidence, null, 2) + "\n");
process.exit(failed ? 1 : 0);
