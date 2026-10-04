# typescript-7-transformers-demo

One tiny project, one `tsconfig.json`, two compilers. TypeScript 6 with
[ts-patch](https://github.com/nonara/ts-patch) applies the custom transformer
declared in that config file. TypeScript 7 builds the same project, exits 0,
prints nothing, and emits the untransformed code.

Companion to
[Before you move a build to TypeScript 7, check it for custom transformers](https://gdhami.net/blog/check-for-custom-transformers-before-moving-to-typescript-7).

## What it proves

`src/app.ts` has two calls to a `debug()` helper. `transformer.cjs` is a custom
transformer that deletes statements which are nothing but a `debug(...)` call —
the sort of job build-time transformers get used for. It is declared in
`tsconfig.json` under `compilerOptions.plugins`, which is where ts-patch looks
for it.

| | exit code | output | `debug()` calls left |
| --- | --- | --- | --- |
| TypeScript 6.0.3 + ts-patch 4.0.1 | 0 | nothing printed | 0 of 2 |
| TypeScript 7.0.2 | 0 | nothing printed | 2 of 2 |

Both builds succeed. Only one of them ran the transformer.

The same run also checks the control: TypeScript 7 *does* read `tsconfig.json`
and *does* reject a compiler option it has never heard of, with
`error TS5023`. It just has nothing to say about `plugins`.

## How to run it

```
npm run setup     # installs TypeScript 6 + ts-patch, and TypeScript 7, side by side
npm run check     # builds both lanes and asserts every claim above
```

`npm run setup` runs `ts-patch install` in the TypeScript 6 lane only, which is
what makes that lane's `tsc` honour the `plugins` entry. The two compilers live
in `compilers/ts6/` and `compilers/ts7/` so neither install can disturb the
other.

Individual lanes, if you want to look at the emitted files yourself:

```
npm run build:ts6     # writes out/ts6/app.js
npm run build:ts7     # writes out/ts7/app.js
```

## Versions used

- TypeScript 6.0.3 and TypeScript 7.0.2 (`latest` on npm on 2026-10-04)
- ts-patch 4.0.1 (v4 supports TypeScript 6 and later; TypeScript 5 needs v3)
- Node.js 26.1.0, Windows 11. Nothing here is platform-specific, but that is
  where the numbers above were produced.

## Why TypeScript 7 cannot run a transformer

A custom transformer is a JavaScript function handed to the compiler's own
emit. Every way of wiring one up — ts-patch, `ts-loader`'s
`getCustomTransformers`, `rollup-plugin-typescript2`'s `transformers`, a
hand-written script calling `ts.createProgram` — needs the compiler's
JavaScript API.

TypeScript 7.0 ships without one. The `typescript` package's main entry point
now resolves to `lib/version.cjs`, whose whole contents are a version string:

```
> node -e "import('typescript').then(m => console.log(Object.keys(m).sort().join(',')))"
default,module.exports,version,versionMajorMinor
```

The same probe against TypeScript 6.0.3 reports `createProgram` and `transform`
as functions. `check.mjs` asserts both.

TypeScript 7.0 does expose a new API under `typescript/unstable/*`, but its
`Emitter` class has exactly one method, `printNode`. There is no transformer
hook in it. A stable API is expected in 7.1, which was still a dev nightly on
2026-10-04.

## Loud failures and quiet ones

How you find out depends on how the transformer was wired up.

- **`tspc`** (ts-patch's live compiler wrapper) crashes on startup against
  TypeScript 7: `TypeError: Cannot read properties of undefined (reading
  'LineFeed')`, because it loads the JavaScript API that is no longer there.
  Loud, and that is the good case.
- **`ts-patch install` in a `postinstall` or `prepare` hook** crashes the same
  way, which fails the whole `npm install`. Also loud.
- **The quiet case is the version bump itself.** `npm install typescript@7.0.2`
  with a package name on the command line exits 0 without a word, replaces
  `node_modules/typescript` with the Go package, and takes the patch with it.
  Your next `tsc` is the native compiler, your build is green, and the
  transformation is gone. A later bare `npm install` re-runs the hook and does
  fail — but by then the output has already shipped.
- **`ts-loader`** has an open draft PR for the TypeScript 7.1 API
  ([#1704](https://github.com/TypeStrong/ts-loader/pull/1704)), whose own notes
  say `getCustomTransformers`, `resolveModuleName` and
  `resolveTypeReferenceDirective` "are still accepted for backwards
  compatibility but are now inert — the native API doesn't expose equivalent
  extension points".

## Angular

Angular 22 declares a TypeScript peer range of `>=6.0.0 <6.1.0`
([angular.dev/reference/versions](https://angular.dev/reference/versions)), so
an Angular 22 app cannot move to TypeScript 7 regardless of transformers.

## A note on `plugins`

`compilerOptions.plugins` is documented as a
[list of language service plugins to run inside the editor](https://www.typescriptlang.org/tsconfig/#plugins).
Plain `tsc` has never applied it at emit time, in any version. ts-patch
repurposes the field by patching `tsc` to read it. That is why the entry
survives a move to TypeScript 7 untouched and unremarked: as far as the
compiler is concerned it was always an editor setting.

## Licence

MIT. See [LICENSE](LICENSE).
