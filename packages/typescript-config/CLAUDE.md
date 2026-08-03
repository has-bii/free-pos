# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See the root `CLAUDE.md` first for monorepo-wide commands and conventions. This file covers `packages/typescript-config`-specific details.

## What this is

`@repo/typescript-config`: shared base `tsconfig.json` for the monorepo. No source code, no build/lint/test scripts — the package's only content is `base.json`, listed in `package.json` `files`.

## Conventions

Every other package/app extends `@repo/typescript-config/base.json` and adds only what's local to it (usually just `compilerOptions.paths` for its own `@repo/<name>/*` subpath imports). When changing a compiler option here (target, strictness flags, etc.), it applies repo-wide — check whether the change should instead be scoped to one package's own `tsconfig.json` via an override.

Notable options already on in `base.json` beyond plain `strict`: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Code across the repo relies on these being on (e.g. array/index access is treated as possibly-`undefined`) — don't relax them to silence a one-off error in a consuming package.
