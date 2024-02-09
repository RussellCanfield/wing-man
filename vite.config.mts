import path, { resolve } from "path";
import { defineConfig } from "vite";

/** @type {import('vite').UserConfig} */
const config = defineConfig({
	assetsInclude: ["**/*.ttf"],
	publicDir: "./src/webview-ui/public",
	resolve: {
		alias: {
			"@node-llama": path.resolve(__dirname, "./node-llama-cpp/dist"),
		},
	},
	build: {
		lib: {
			entry: "./src/extension.ts",
		},
		rollupOptions: {
			external: ["vscode", 'typescript'],
			input: {
				extension: resolve(__dirname, "src/extension.ts"),
				index: resolve(__dirname, "src/webview-ui/index.tsx"),
			},
			output: [
				{
					format: "cjs",
					entryFileNames: "[name].js",
				},
				{
					format: "es",
					entryFileNames: "[name].[format].js",
				},
			],
		},
		sourcemap: true,
		outDir: "out",
	},
	define: {
		"process.env": process.env,
	},
	plugins: [
		// viteStaticCopy({
		// 	targets: [
		// 		{
		// 			src: resolve(__dirname, "./src/media"),
		// 			dest: ".",
		// 		},
		// 	],
		// }),
	],
});

export default config;
