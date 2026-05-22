# AGENTS.md

Guidance for AI coding agents working in this repository. Kept short because this file is loaded into the agent's context on every turn.

## What SignStamp is

A desktop "fill & sign" tool for PDFs. Tauri 2 (Rust) shell, React 18 + TypeScript renderer, [pdf.js](https://github.com/mozilla/pdf.js) for rendering, [pdf-lib](https://pdf-lib.js.org/) for export. **No network calls** — everything is local-only by design.

## Run / Test / Build

```bash
npm run tauri dev       # launch the desktop app (auto-reload)
npm test                # vitest one-shot
npm run test:watch      # vitest watch
npm run tauri build     # production bundles (deb/rpm/msi/exe/dmg/app)
npx tsc --noEmit        # type-check only
```

The release workflow (`.github/workflows/release.yml`) fires on `v*` tags and produces a draft GitHub release with platform bundles.

## Architecture at a glance

- **`src/App.tsx`** — top-level UI (toolbar, sidebar, page rendering, drag/resize state). Large file but most logic is delegated to hooks.
- **`src/hooks/`** — focused single-purpose hooks:
  - `usePdfDocument` — pdf.js lifecycle (load, render loop, viewports)
  - `useFormFields` — discovers AcroForm widgets (text/checkbox/radio/choice/button/sig)
  - `useDragMachine` — pure drag/resize/draw state machine over items
  - `usePersistentState` + `storageAdapters` — Tauri-first persistence with localStorage fallback
  - `useImageAssets` + `useSignatures` / `useParaphAssets` — gallery storage (signatures, paraphs)
  - `useSnippets`, `useTextStyle` — domain wrappers
- **`src/components/items/`** — one overlay component per `Item` type, dispatched by `ItemOverlay`.
- **`src/components/FormFieldOverlay.tsx`** — renders the AcroForm widget controls.
- **`src/pdf/`** — `coords.ts` (PDF↔CSS conversions), `exportPdf.ts` (pdf-lib flattening), tests.
- **`src/i18n/`** — one file per locale, all typed against `Translations` derived from `en.ts` (strict — missing key = compile error).
- **`src-tauri/src/main.rs`** — Tauri commands (file I/O, signature/paraph/snippet storage).

## Conventions

### State & data
- **Discriminated unions** for `Item`, `FieldDescriptor`, `FieldPlacement`. Narrow with `kind` / `type`, never `as`.
- **No `any`** outside of explicit boundaries (pdf.js annotations, JSON I/O).
- **Single source of truth**: the paraph lives outside `items[]` because it's one logical entity rendered on every page. Don't duplicate per-page when you can project.
- **Persistent state** uses the adapter pattern : declare a `StorageAdapter` (Tauri / localStorage / dual / tauriOnly) and feed it to `usePersistentState`. Don't reach for `localStorage` directly.

### Components & files
- Hooks return tuples / objects, never classes.
- One overlay component per item type, dispatched in `ItemOverlay.tsx`. Adding a new item kind ⇒ add to `types.ts` union, render component, add to dispatcher, handle in `exportPdf.ts`.
- Test files sit next to the file they test : `useFoo.ts` ↔ `useFoo.test.tsx`.

### Style
- **Minimal comments**. Only the WHY when non-obvious. Never describe WHAT the code does, never reference current commit/PR/caller.
- No emojis in code or commit messages.
- Don't add error handling for impossible states. Trust framework guarantees ; validate at system boundaries (file paths, user input).
- Don't add backwards-compat shims unless explicitly needed.

### Tests
- Run with `vitest` + `@testing-library/react` (jsdom). Setup polyfills in `src/setupTests.ts`.
- Tests are colocated. Snapshot-style export tests round-trip through `pdf-lib` to verify pages count / field values.
- 113 tests at time of writing — they should stay green.

### i18n
- Add a key to `en.ts` first ; TypeScript will fail every other locale until they translate it. Always cover all 8 locales (en, fr, de, es, zh, ja, ar, uk).

### Tauri commands
- Frontend uses `invoke<T>("name", args)` ; backend defines `#[tauri::command]` handlers in `src-tauri/src/main.rs` and registers them in the `invoke_handler!` macro.
- Storage commands follow a pair: `load_<thing>` + `save_<thing>` writing to a JSON file under `app_data_dir()`. Mirror the pattern when adding a new persisted resource.

## Security posture
- **No network** — never introduce a `fetch` / Tauri HTTP client / telemetry without explicit user approval. The "local-only" promise is a product feature.
- pdf.js is loaded with `isEvalSupported: false`, `enableXfa: false`, `disableAutoFetch: true`, `disableStream: true` ([usePdfDocument.ts](src/hooks/usePdfDocument.ts)). Don't relax these.
- Tauri commands that take a `path` from the frontend must validate it (see `save_pdf_to_path` rejecting non-`.pdf` targets).
- Frontend should only feed `save_pdf_to_path` paths obtained from the OS save dialog.

## Commit / release flow
- **No `Co-Authored-By` trailer** in commits.
- One commit per logical change. Version bump = its own commit (`Bump version to X.Y.Z`).
- Tag `v<version>` triggers the release workflow.
- Version lives in 4 places — keep them in sync: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the `fill-sign-pdf` entry in `src-tauri/Cargo.lock`.

## Where in-flight feature plans live
- `docs/plans/v<version>-<feature>.md` — work-in-progress designs that we iterate on before coding. Archive or delete after the feature ships.
