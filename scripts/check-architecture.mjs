#!/usr/bin/env node
// Mechanical enforcement of docs/ARCHITECTURE.md. Messages tell the agent how to fix.
// Usage: node scripts/check-architecture.mjs [files...]   (no args = whole repo)
//        --hook: read Claude Code PostToolUse JSON from stdin and check that one file
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, extname } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const SRC = join(ROOT, 'src');
const MAX_LINES = 300;
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', 'dist', 'build', '.serena', 'ios', 'android']);

const LAYERS = ['types', 'domain', 'services', 'state', 'ui', 'app'];
const ALLOWED = {
  types: [],
  domain: ['types'],
  services: ['types', 'domain'],
  state: ['types', 'domain', 'services'],
  ui: ['types', 'domain', 'state'],
  app: ['types', 'domain', 'state', 'ui'],
};
const PURE = new Set(['types', 'domain']);
const PLATFORM_PKG = /^(react|react-native|expo)(-[\w-]+)?(\/|$)|^@react-native|^@expo\//;
const SECRET = /sk-ant-[A-Za-z0-9_-]{10,}/;
const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

const errors = [];
const fail = (file, msg) => errors.push(`${relative(ROOT, file)}: ${msg}`);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function layerOf(absPath) {
  const rel = relative(SRC, absPath);
  if (rel.startsWith('..')) return null;
  const top = rel.split('/')[0];
  return LAYERS.includes(top) ? top : null;
}

function resolveImport(file, spec) {
  if (spec.startsWith('@/')) return join(SRC, spec.slice(2));
  if (spec.startsWith('.')) return resolve(dirname(file), spec);
  return null; // package import
}

function checkFile(file) {
  const ext = extname(file);
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { return; }

  if (SECRET.test(text) && !file.endsWith('check-architecture.mjs')) {
    fail(file, 'contains what looks like an Anthropic API key. Remove it; keys live only in the serverless proxy env (see AGENTS.md).');
  }
  if (!CODE_EXT.has(ext)) return;

  const lines = text.split('\n').length;
  if (lines > MAX_LINES && file.startsWith(SRC)) {
    fail(file, `${lines} lines > ${MAX_LINES}. Split it by responsibility (docs/PRINCIPLES.md #10).`);
  }

  const layer = layerOf(file);
  if (!layer) return;
  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1] || m[2] || m[3];
    if (PURE.has(layer) && PLATFORM_PKG.test(spec)) {
      fail(file, `'${layer}/' must stay pure but imports '${spec}'. Move platform code to services/ and pass data in (docs/ARCHITECTURE.md).`);
      continue;
    }
    const target = resolveImport(file, spec);
    if (!target) continue;
    const tLayer = layerOf(target);
    if (!tLayer || tLayer === layer) continue;
    if (!ALLOWED[layer].includes(tLayer)) {
      const hint = layer === 'ui' && tLayer === 'services'
        ? 'Expose it through a hook in state/ instead.'
        : `Allowed from ${layer}/: ${ALLOWED[layer].join(', ') || 'nothing in src/'}. Move the shared code down a layer.`;
      fail(file, `${layer}/ may not import ${tLayer}/ ('${spec}'). ${hint}`);
    }
  }
}

let argv = process.argv.slice(2);
if (argv[0] === '--hook') {
  let input = {};
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch {}
  const f = input.tool_input?.file_path;
  if (!f) process.exit(0);
  argv = [f];
}
const args = argv.map((f) => resolve(f));
const files = args.length ? args.filter(existsSync) : walk(ROOT);
files.forEach(checkFile);

if (errors.length) {
  console.error(`Architecture check failed (${errors.length}):\n` + errors.map((e) => `  ✗ ${e}`).join('\n'));
  process.exit(args.length ? 2 : 1); // exit 2 = feed back to agent when run from a hook
}
console.log(`architecture ok (${files.length} files)`);
