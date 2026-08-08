import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// tsc resolves the workspace source aliases from tsconfig `paths`, but Vite
// does not read those. Mirror the mappings here; keep both files in sync.
const srcDir = `${import.meta.dirname}/src/`
const uiSrcDir = `${import.meta.dirname}/../../packages/ui/src/`
const authSrcDir = `${import.meta.dirname}/../auth/src/`
const honoUtilsSrcDir = `${import.meta.dirname}/../../packages/hono-utils/src/`
const shopSrcDir = `${import.meta.dirname}/../shop/src/`

export default defineConfig({
	plugins: [
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		react(),
		babel({ presets: [reactCompilerPreset()] }),
		tailwindcss(),
	],
	resolve: {
		alias: [
			{ find: /^@repo\/frontend\//, replacement: srcDir },
			{ find: /^@repo\/ui\//, replacement: uiSrcDir },
			{ find: /^@repo\/auth\//, replacement: authSrcDir },
			{ find: /^@repo\/hono-utils\//, replacement: honoUtilsSrcDir },
			{ find: /^@repo\/shop\//, replacement: shopSrcDir },
		],
	},
})
