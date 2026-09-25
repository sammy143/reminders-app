#!/usr/bin/env node
// Mechanical enforcement of docs/ARCHITECTURE.md. Messages tell the agent how to fix.
// Usage: node scripts/check-architecture.mjs [files...]   (no args = whole repo)
//        --hook: read Claude Code PostToolUse JSON from stdin and check that one file
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, extname } from 'node:path';

import { routeExists } from './routes.mjs';

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
// Real-clock reads (PRINCIPLES #8: time is injected). `Date.now()` or an argument-less
// `new Date()` is banned in tests and in src/, except in the files below, which are the
// app's only sources of "now". Keep this list short; document additions in ARCHITECTURE.md.
const REAL_CLOCK = /\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)/;
const REAL_CLOCK_ALLOWLIST = new Set([
  'src/state/clock.ts', // systemClock: the default Clock injected everywhere else
]);
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
// expo-notifications: its package root runs DevicePushTokenAutoRegistration.fx, which throws in
// Expo Go on Android. Only the adapter may import it, and only from build/<file> modules whose
// require graph never reaches the root index or any .fx module (traced below).
const NOTIFICATIONS_ADAPTER = 'src/services/notifications.ts';
const NOTIFICATIONS_PKG = /^expo-notifications(\/|$)/;
const NOTIFICATIONS_DEEP = /^expo-notifications\/build\/[\w.]+$/;
const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm;

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

const PLATFORM_EXTS = ['.js', '.native.js', '.ios.js', '.android.js'];
const COMMENTS = /\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm;
const DEP_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const traced = new Map();

/** Every platform variant a relative specifier can load: file as written, with extensions, or dir/index. */
function resolveVariants(base) {
  const isFile = (f) => existsSync(f) && statSync(f).isFile();
  const stem = base.replace(/\.js$/, '');
  const found = [base, ...PLATFORM_EXTS.map((e) => stem + e)].filter(isFile);
  if (found.length === 0 && existsSync(base) && statSync(base).isDirectory()) {
    return PLATFORM_EXTS.map((e) => join(base, 'index' + e)).filter(isFile);
  }
  return [...new Set(found)];
}

/**
 * Files of expo-notifications that `spec` pulls in, following relative imports (static, dynamic,
 * require) on every platform. A relative import that resolves to no file is reported, never skipped.
 */
function traceNotificationsModule(spec) {
  if (traced.has(spec)) return traced.get(spec);
  const build = join(ROOT, 'node_modules', 'expo-notifications', 'build');
  const seen = new Set();
  const bare = new Set();
  const unresolved = [];
  const stack = resolveVariants(join(build, spec.replace('expo-notifications/build/', '')));
  const missing = stack.length === 0;
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const code = readFileSync(f, 'utf8').replace(COMMENTS, '$1');
    for (const m of code.matchAll(DEP_RE)) {
      const dep = m[1] || m[2] || m[3] || m[4];
      if (!dep.startsWith('.')) {
        bare.add(dep);
        continue;
      }
      const targets = resolveVariants(resolve(dirname(f), dep));
      if (targets.length === 0) unresolved.push(`${relative(build, f)} → '${dep}'`);
      stack.push(...targets);
    }
  }
  const files = [...seen].map((f) => relative(build, f));
  const forbidden = files.filter((f) => /^index\.|\.fx\./.test(f));
  if ([...bare].some((d) => NOTIFICATIONS_PKG.test(d))) forbidden.push('expo-notifications (package root)');
  const result = { missing, files, forbidden, unresolved };
  traced.set(spec, result);
  return result;
}

function checkNotificationsImport(file, rel, spec) {
  if (rel !== NOTIFICATIONS_ADAPTER) {
    fail(file, `imports '${spec}'. Only ${NOTIFICATIONS_ADAPTER} may import expo-notifications; go through the NotificationsPort (docs/ARCHITECTURE.md).`);
    return;
  }
  if (!NOTIFICATIONS_DEEP.test(spec)) {
    fail(file, `imports '${spec}'. Import expo-notifications/build/<file> modules only: the package root runs DevicePushTokenAutoRegistration.fx, which throws in Expo Go on Android (docs/ARCHITECTURE.md).`);
    return;
  }
  const { missing, forbidden, unresolved } = traceNotificationsModule(spec);
  if (missing) fail(file, `imports '${spec}', which doesn't exist in node_modules (did an SDK upgrade move it? see docs/tech-debt.md).`);
  if (unresolved.length) fail(file, `imports '${spec}', whose require graph can't be fully traced: ${unresolved.join('; ')}. Teach resolveVariants that layout, don't skip it (docs/ARCHITECTURE.md).`);
  if (forbidden.length) fail(file, `imports '${spec}', whose require graph reaches ${forbidden.join(', ')}. Pick a module that doesn't (docs/ARCHITECTURE.md).`);
}

// Route literals in src/app/ must name a real route file. `npm run typecheck` ignores Expo's
// generated .expo/types (stale copies broke it), so this is what catches a mistyped or deleted route.
const ROUTE_RE = /(?:\bpathname\s*:\s*|\bhref\s*=\s*\{?\s*|\brouter\.(?:push|replace|navigate|dismissTo)\(\s*)(['"])(\/[^'"?#]*)\1/g;
const APP_DIR = join(SRC, 'app');
function checkRoutes(file, text) {
  for (const m of text.matchAll(ROUTE_RE)) {
    if (!routeExists(APP_DIR, m[2])) {
      fail(file, `navigates to '${m[2]}', but no route file matches it under src/app/. Fix the path or add the route (docs/ARCHITECTURE.md).`);
    }
  }
}

function checkFile(file) {
  const ext = extname(file);
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { return; }

  if (SECRET.test(text) && !file.endsWith('check-architecture.mjs')) {
    fail(file, 'contains what looks like an Anthropic API key. Remove it; keys live only in the serverless proxy env (see AGENTS.md).');
  }
  if (!CODE_EXT.has(ext)) return;

  const rel = relative(ROOT, file);
  if (REAL_CLOCK.test(text)) {
    if (TEST_FILE.test(file)) {
      fail(file, 'reads the real clock (Date.now() / new Date()). Tests must use a fixed time: inject `now` or a Clock (e.g. resetAppointmentsForTests(() => FIXED)), or use jest.useFakeTimers({ now: FIXED }) (docs/PRINCIPLES.md #8).');
    } else if (file.startsWith(SRC) && !REAL_CLOCK_ALLOWLIST.has(rel)) {
      const where = layerOf(file) === 'domain' ? "domain/ must stay pure: take `now: Date` as a parameter." : 'Inject `now` or a Clock (src/state/clock.ts; useNow in UI) instead.';
      fail(file, `reads the real clock (Date.now() / new Date()). ${where} Only ${[...REAL_CLOCK_ALLOWLIST].join(', ')} may (docs/PRINCIPLES.md #8, docs/ARCHITECTURE.md).`);
    }
  }

  const lines = text.split('\n').length;
  if (lines > MAX_LINES && file.startsWith(SRC)) {
    fail(file, `${lines} lines > ${MAX_LINES}. Split it by responsibility (docs/PRINCIPLES.md #10).`);
  }

  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1] || m[2] || m[3] || m[4];
    if (NOTIFICATIONS_PKG.test(spec)) checkNotificationsImport(file, rel, spec);
  }

  const layer = layerOf(file);
  if (!layer) return;
  if (layer === 'app') checkRoutes(file, text);
  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1] || m[2] || m[3] || m[4];
    if (PURE.has(layer) && PLATFORM_PKG.test(spec)) {
      fail(file, `'${layer}/' must stay pure but imports '${spec}'. Move platform code to services/ and pass data in (docs/ARCHITECTURE.md).`);
      continue;
    }
    if (layer === 'ui' && /^expo-router(\/|$)/.test(spec)) {
      fail(file, `ui/ must not import '${spec}': navigation belongs to routes. Take callbacks (onClose, onSaved…) as props and call the router from src/app/ (docs/ARCHITECTURE.md).`);
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
if (process.env.TRACE_NOTIFICATIONS) {
  for (const [spec, { files: graph }] of traced) console.log(`${spec}: ${graph.join(', ')}`);
}
console.log(`architecture ok (${files.length} files)`);
