# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See the root `CLAUDE.md` first for monorepo-wide commands and conventions. This file covers `packages/typescript-config`-specific details.

## What this is

`@repo/typescript-config`: shared base `tsconfig.json`s for the monorepo. No source code, no build/lint/test scripts — the package's only content is `base.json` and `react-library.json`, both listed in `package.json` `files`.

## Conventions

Non-browser packages/apps (Workers, Node) extend `@repo/typescript-config/base.json` directly. Browser/React packages/apps (`apps/frontend`, `packages/ui`) extend `react-library.json` instead, which itself extends `base.json` and adds `jsx: "react-jsx"` plus DOM libs (`base.json`'s `lib` is `["ESNext"]` only — no DOM — since it's meant for Workers/Node code). Either way, each consumer adds only what's local to it on top (usually just `compilerOptions.paths` for its own `@repo/<name>/*` subpath imports, and `types` for anything ambient it needs like `vite/client`). When changing a compiler option in `base.json`, it applies repo-wide, browser packages included (since `react-library.json` extends it) — check whether the change should instead be scoped to one config or one package's own `tsconfig.json` override.

Notable options already on in `base.json` beyond plain `strict`: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Code across the repo relies on these being on (e.g. array/index access is treated as possibly-`undefined`) — don't relax them to silence a one-off error in a consuming package.
