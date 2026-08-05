import { cloudflareTest } from "@cloudflare/vitest-pool-workers"
import { config as loadEnv } from "dotenv"
import { defineConfig } from "vitest/config"

loadEnv({ path: ".env.test", quiet: true })

// `wrangler dev`/`deploy` resolve the `@repo/auth/*` and `@repo/auth-kit/*`
// subpath imports from tsconfig `paths`, but Vite does not read those. Mirror
// both mappings in tsconfig.json here; keep them in sync.
// `import.meta.dirname` rather than `fileURLToPath`: this package's tsconfig
// pulls in both the workerd and Node `URL` types, and they are not assignable.
const srcDir = `${import.meta.dirname}/src/`
const authKitSrcDir = `${import.meta.dirname}/../../packages/auth-kit/src/`

export default defineConfig({
	resolve: {
		alias: [
			{ find: /^@repo\/auth\//, replacement: srcDir },
			{ find: /^@repo\/auth-kit\//, replacement: authKitSrcDir },
		],
	},
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			miniflare: {
				bindings: {
					// Hardcoded on purpose: test/routes/me.test.ts hand-signs an expired
					// token, which requires knowing the signing key.
					FREE_POS_JWT_SECRET: "test-jwt-secret-do-not-use-in-production",
					FREE_POS_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
					FREE_POS_FRONTEND_ORIGIN: "https://app.test.invalid",
					// Empty, like local dev: exercises the host-only cookie path rather
					// than pinning assertions to the prod `.yourdomain.com` value.
					FREE_POS_COOKIE_DOMAIN: "",
					// Tests use the capture sender (test/helpers/email.ts) instead of
					// these — the key is deliberately empty, the from is a test address.
					FREE_POS_EMAIL_API_KEY: "",
					FREE_POS_EMAIL_FROM: "Free POS <no-reply@test.invalid>",
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
