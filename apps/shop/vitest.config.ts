import { cloudflareTest } from "@cloudflare/vitest-pool-workers"
import { config as loadEnv } from "dotenv"
import { defineConfig } from "vitest/config"

loadEnv({ path: ".env.test", quiet: true })

const srcDir = `${import.meta.dirname}/src/`
const authKitSrcDir = `${import.meta.dirname}/../../packages/auth-kit/src/`
const honoUtilsSrcDir = `${import.meta.dirname}/../../packages/hono-utils/src/`

export default defineConfig({
	resolve: {
		alias: [
			{ find: /^@repo\/shop\//, replacement: srcDir },
			{ find: /^@repo\/auth-kit\//, replacement: authKitSrcDir },
			{ find: /^@repo\/hono-utils\//, replacement: honoUtilsSrcDir },
		],
	},
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			miniflare: {
				bindings: {
					FREE_POS_JWT_SECRET: "test-jwt-secret-do-not-use-in-production",
					FREE_POS_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
					FREE_POS_FRONTEND_ORIGIN: "https://app.test.invalid",
				},
			},
		}),
	],
	test: {
		setupFiles: ["./test/setup.ts"],
		testTimeout: 20_000,
		hookTimeout: 20_000,
	},
})
