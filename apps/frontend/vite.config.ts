import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// tsc resolves `@repo/frontend/*` and `@repo/ui/*` from tsconfig `paths`,
// but Vite does not read those. Mirror both mappings here; keep them in
// sync with tsconfig.json.
const srcDir = `${import.meta.dirname}/src/`
const uiSrcDir = `${import.meta.dirname}/../../packages/ui/src/`

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
		],
	},
})
