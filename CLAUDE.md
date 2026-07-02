# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SSH Config Manager is an Electron + Vue 3 desktop app that provides a GUI for the
user's `~/.ssh/config` file (CRUD, drag-to-reorder, copy, and one-click terminal
launch). It also has a LAN peer-to-peer feature for discovering other instances on
the local network and sharing/importing host entries between them.

## Commands

The package manager is **pnpm** (see README). Scripts:

- `pnpm dev` — Runs Vite (`:5173`) and Electron concurrently with hot-reload.
- `pnpm build` — `vite build` → outputs the renderer to `dist/`.
- `pnpm icon` — Regenerate app icons from `electron/assets/icon.jpeg` into `build/icons/`.
- `pnpm pack:test` — Unpacked build for local testing (`--dir`).
- `pnpm pack:win` / `pack:win:portable` / `pack:mac` / `pack:linux` — electron-builder packaging; artifacts go to `release/`.

There is no test suite, linter, or typechecker configured.

pnpm v11 note: build-script approvals live in `pnpm-workspace.yaml` (only `electron`
is approved — its postinstall downloads the binary; ssh2/cpu-features intentionally
skip native builds and fall back to pure JS). The `pnpm` field in package.json is no
longer read.

## Architecture

Standard Electron two-process split. The two processes talk **only** over IPC —
there is no shared module state.

- **Main process** (`electron/`, ESM, Node APIs): `main.js` is the entry
  (`package.json` `main` field). It owns the `BrowserWindow`, registers all
  `ipcMain.handle(...)` handlers, and drives auto-update via `electron-updater`.
- **Preload** (`electron/preload.js`): the only bridge. Exposes three frozen APIs
  on `window` via `contextBridge` — `sshApi`, `updaterApi`, `networkApi`. Renderer
  code must never assume Node access; everything routes through these.
- **Renderer** (`src/`, Vue 3 `<script setup>` SFCs, Tailwind v4): `App.vue` is the
  root and holds nearly all app state; `components/` are presentational. Access the
  backend only through the `window.*Api` objects (e.g. `window.sshApi.getAll()`).

**IPC channel convention:** channels are namespaced `ssh:*`, `network:*`, `updater:*`.
When adding a feature you must touch three files in lockstep: add the
`ipcMain.handle` in `main.js`, expose it in `preload.js`, and call
`window.<api>.<method>` in the renderer. Missing any one silently breaks the chain.

### SSH config editing (`electron/ssh-service.js`)

Reads/writes `~/.ssh/config` using the `ssh-config` library, preserving the raw
AST so user formatting/comments survive round-trips. Key details to respect:

- SSH directive keys are case-insensitive on disk but normalized to canonical
  casing for the frontend via `KEY_MAPPING` (e.g. `hostname` → `HostName`). The
  managed prop set is `HostName, User, Port, IdentityFile, Remark`.
- `Remark` is a **custom** (non-standard) directive. The file is bootstrapped with
  an `IgnoreUnknown Remark` block (`INIT_CONTENT`) so `ssh` itself ignores it;
  `getAll()` auto-injects this block if missing.
- New/copied host blocks are built by string concatenation and re-parsed (rather
  than the library's `append`) to control indentation; deletes run a regex pass to
  collapse excess blank lines. Preserve this approach when editing write paths.
- **UI order is the reverse of file order** ("newest first"): `getAll()` reverses
  the parsed Host list before returning, and `reorderHosts()` takes display order
  and reverses it back before rewriting the file. New/copied/imported hosts still
  append toward the file end, which lands them at the top of the UI. Keep these
  two reversals paired.

### Copy ID (`electron/services/CopyIdService.js`)

`ssh-copy-id` equivalent implemented over the pure-JS `ssh2` library (spawning the
real `ssh-copy-id` can't take a password non-interactively — ssh reads it from the
TTY). Password-authenticates, then appends the public key to the remote
`authorized_keys` via exec-stdin with client-side dedup. Always returns a result
object (`{success, ...}`) instead of throwing, so renderer error messages stay clean
of IPC prefixes. The password arrives from the New Host dialog's Copy ID button,
lives only in that one IPC call, and must never be logged or persisted.

### i18n (`src/i18n/`)

vue-i18n (`legacy: false`, `globalInjection: true`), zh-CN + en-US. Rules:

- **All renderer copy lives in `src/i18n/locales/{zh-CN,en-US}.js`** — never hardcode
  user-visible strings in components. The two files must stay structurally identical.
  Templates use `$t(...)`; scripts use `useI18n()`.
- Locale preference persists in `localStorage['scm-locale']`; default follows the
  system language. The header button next to the version toggles it via `setLocale()`.
- For live language switching, persistent error state stores **i18n keys** (or
  code objects), not translated strings — e.g. HostEditor validation errors hold
  keys rendered with `$t(errors.X)`.
- **Main-process user-visible failures return `{ success: false, code, params, message }`**
  (message is the Chinese fallback). The renderer maps `code` via the `errors.*`
  namespace using `translateError()` from `src/i18n/index.js`. When adding a new
  failure branch, register its code in both locale files.

### LAN sharing (`electron/services/`)

Composed by `NetworkManager`, which orchestrates two services and persists state to
`~/.ssh/.ssh-config-share.json` (separate from the SSH config):

- **`DiscoveryService`** — UDP broadcast on port `8888` (5s interval) to find peers;
  marks peers offline after 15s, removes after 30s.
- **`ShareService`** — HTTP server on an auto-selected port in `8889–8999` serving
  `/api/nodes`, `/api/node/:id`, `/api/health`. `filterSensitiveData()` whitelists
  which fields leave the machine — keep that allowlist tight when changing shared data.

The services use their own hand-rolled `on`/`emit` event mini-emitter (not Node's
`EventEmitter`). `NetworkManager` re-emits their events, and `main.js` forwards them
to the renderer over `network:*` channels. Sharing is **off by default**; enabling it
restores previously shared nodes from the persisted config.

## Notes

- Dev-mode detection everywhere keys off `isDev` in `main.js` (`!app.isPackaged` or
  `NODE_ENV`/`ELECTRON_IS_DEV`). Auto-update only runs automatically in production;
  in dev it needs `dev-app-update.yml` and must be triggered manually.
- Publishing targets the GitHub repo `lazyatwell/ssh-config-manager` (see the
  `build.publish` block) — that owner drives where `electron-updater` looks for releases.
- Much of the inline commentary is in Chinese; match the surrounding language when
  editing a given file. User-facing strings go through i18n (see the i18n section) —
  do not add hardcoded copy.
