# Repository Guidelines

## Project Structure & Module Organization
This service is a single TypeScript entry point at `src/index.ts` that wires the MCP server, handles Vertex AI requests, and encapsulates tool implementations. Build artefacts land in `build/` (gitignored). Shared documentation lives under `docs/`. Runtime configs rely on shell exports; no separate config directory is tracked. Keep new modules inside `src/` and export them from `index.ts` to maintain the CLI bundle produced by `tsc`.

## Build, Test, and Development Commands
Run `npm install` once to restore dependencies. `npm run dev` starts the server with tsx for rapid reloads; include `DEBUG=1` when you need verbose logging. `npm run build` compiles TypeScript to the distributable `build/` folder. `npm start` bootstraps the compiled server for smoke tests that mirror production behaviour.

## Coding Style & Naming Conventions
Follow the existing two-space indentation and ES module syntax. Use TypeScript’s strict typing—never suppress errors with `any` unless accompanied by a TODO explaining the debt. Prefer camelCase for functions and variables, PascalCase for types, and ALL_CAPS for environment keyed constants (see `GOOGLE_IMAGEN_MODEL`). Run `npm run build` before sending PRs; the TypeScript compiler doubles as the lint gate.

## Testing Guidelines
There is no automated test suite yet. When you add features, create focused integration scripts in `docs/` or `examples/` that exercise the MCP tools end-to-end. At a minimum, validate `generate_image` and `generate_and_upscale_image` flows against Vertex AI sandbox credentials. Document manual steps in your PR description until a formal test harness exists.

## Commit & Pull Request Guidelines
Recent commits mix semantic tags (`0.1.4`) with imperative summaries (“Rename server…”). Follow that pattern: start with a lowercase imperative clause or a version bump tag, keep subjects under 72 characters, and explain the why in the body when needed. PRs should link issues, list verification steps (commands run, sample prompts), and include screenshots or data URLs when the change affects generated assets.

## Security & Configuration Tips
Never commit service account keys; `.gitignore` already assumes they stay outside the repo. Load `GOOGLE_APPLICATION_CREDENTIALS` via absolute paths and restrict files with `chmod 600`. Avoid logging raw tokens when DEBUG is enabled, and scrub prompts before sharing trouble reports.
