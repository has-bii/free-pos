import { defineConfig } from "vitest/config"

// Mirrors the tsconfig.json `paths` mapping — Vite does not read tsconfig
// paths itself.
const srcDir = `${import.meta.dirname}/src/`

export default defineConfig({
	resolve: {
		alias: [{ find: /^@repo\/hono-utils\//, replacement: srcDir }],
	},
})
