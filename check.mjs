// Builds src/app.ts twice from one tsconfig.json and checks what came out.
//
//   npm run check
//
// Lane one is TypeScript 6 with ts-patch installed, so tsc honours the
// plugins entry in tsconfig.json. Lane two is TypeScript 7, the native
// compiler. Every assertion below is printed as PASS or FAIL; the script
// exits 1 on the first failure count above zero.
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const tsc = (lane) => join(root, 'compilers', lane, 'node_modules', 'typescript', 'bin', 'tsc');

let failures = 0;
function assert(ok, label, detail) {
  if (!ok) failures++;
  const line = `${ok ? 'PASS' : 'FAIL'}  ${label}`;
  console.log(detail ? `${line}\n        ${detail}` : line);
}

function run(args, options = {}) {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', ...options });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

function version(lane) {
  return run([tsc(lane), '--version']).out.replace(/^Version\s+/, '');
}

rmSync(join(root, 'out'), { recursive: true, force: true });

// --- the two compilers ------------------------------------------------------
const v6 = version('ts6');
const v7 = version('ts7');
assert(v6.startsWith('6.'), `lane ts6 is TypeScript ${v6}`);
assert(v7.startsWith('7.'), `lane ts7 is TypeScript ${v7}`);

// --- TypeScript 6 with ts-patch: the transformer runs -----------------------
const build6 = run([tsc('ts6'), '-p', 'tsconfig.json', '--outDir', 'out/ts6']);
assert(build6.code === 0, `TypeScript ${v6} + ts-patch exited ${build6.code}`, build6.out || undefined);

const emitted6 = readFileSync(join(root, 'out', 'ts6', 'app.js'), 'utf8');
const calls6 = (emitted6.match(/debug\('/g) ?? []).length;
assert(calls6 === 0, `TypeScript ${v6} output: ${calls6} debug() calls left of 2 (the transformer ran)`);
assert(emitted6.includes('largestOrder'), `TypeScript ${v6} output still has the function the file exports`);

// --- TypeScript 7: the same project, the same tsconfig ----------------------
const build7 = run([tsc('ts7'), '-p', 'tsconfig.json', '--outDir', 'out/ts7']);
assert(build7.code === 0, `TypeScript ${v7} exited ${build7.code}`, build7.out || undefined);
assert(build7.out === '', `TypeScript ${v7} printed nothing: no error, no warning about the plugins entry`,
  build7.out ? `it printed: ${build7.out}` : undefined);

const emitted7 = readFileSync(join(root, 'out', 'ts7', 'app.js'), 'utf8');
const calls7 = (emitted7.match(/debug\('/g) ?? []).length;
assert(calls7 === 2, `TypeScript ${v7} output: ${calls7} debug() calls left of 2 (the transformer never ran)`);

// --- the control: TypeScript 7 does read tsconfig.json ----------------------
const bad7 = run([tsc('ts7'), '-p', 'tsconfig.unknown-option.json']);
assert(bad7.code !== 0 && bad7.out.includes('TS5023') && bad7.out.includes('notARealCompilerOption'),
  `TypeScript ${v7} rejects an option it does not know (TS5023), so the silence about plugins is specific`,
  bad7.out.split('\n')[0]);
assert(!bad7.out.toLowerCase().includes('plugin'),
  `TypeScript ${v7} says nothing about plugins even while rejecting that file`);

// --- why no transformer can run: the old JavaScript API is gone -------------
const api7 = run(['-e', "import('typescript').then(m => console.log(Object.keys(m).sort().join(',')))"],
  { cwd: join(root, 'compilers', 'ts7') });
const api6 = run(['-e', "import('typescript').then(m => console.log(typeof m.default.createProgram, typeof m.default.transform))"],
  { cwd: join(root, 'compilers', 'ts6') });
assert(!api7.out.includes('createProgram'),
  `the typescript@${v7} package's main entry point exports only: ${api7.out}`);
assert(api6.out === 'function function',
  `the typescript@${v6} package's main entry point still exports createProgram and transform`);

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
