import { cloudflareTest } from "@cloudflare/vitest-pool-workers"
import { config as loadEnv } from "dotenv"
import { defineConfig } from "vitest/config"

loadEnv({ path: ".env.test", quiet: true })

// `wrangler dev`/`deploy` resolve the `@repo/auth/*` subpath imports from
// tsconfig `paths`, but Vite does not read those. Mirror the single mapping in
// tsconfig.json here; keep the two in sync.
// `import.meta.dirname` rather than `fileURLToPath`: this package's tsconfig
// pulls in both the workerd and Node `URL` types, and they are not assignable.
const srcDir = `${import.meta.dirname}/src/`

export default defineConfig({
	resolve: {
		alias: [{ find: /^@repo\/auth\//, replacement: srcDir }],
	},
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			miniflare: {
				bindings: {
					// Hardcoded on purpose: test/routes/me.test.ts hand-signs an expired
					// token, which requires knowing the signing key.
					SERO_POS_JWT_SECRET: "test-jwt-secret-do-not-use-in-production",
					SERO_POS_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
				},
			},
		}),
	],
	test: {
		setupFiles: ["./test/setup.ts"],
		// Every fixture pays a real 50,000-iteration PBKDF2 hash plus TiDB
		// round-trips, so Vitest's 5s default is not enough.
		testTimeout: 20_000,
		hookTimeout: 20_000,
	},
})
