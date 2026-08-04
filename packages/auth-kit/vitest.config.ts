import { defineConfig } from "vitest/config"

// Mirrors the tsconfig.json `paths` mapping — Vite does not read tsconfig
// paths itself. See apps/auth/vitest.config.ts for the same pattern.
const srcDir = `${import.meta.dirname}/src/`

export default defineConfig({
	resolve: {
		alias: [{ find: /^@repo\/auth-kit\//, replacement: srcDir }],
	},
})
