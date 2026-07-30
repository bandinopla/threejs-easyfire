import { defineConfig } from "vite";
import path from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
	plugins: [
		dts({
			tsconfigPath: path.resolve(__dirname, "tsconfig.lib.json"),
			insertTypesEntry: true,
		}),
	],
	build: {
		lib: {
			entry: path.resolve(__dirname, "src/index.ts"),
			name: "ThreejsEasyFire",
			fileName: "threejs-easyfire",
			formats: ["es", "umd"],
		},
		rollupOptions: {
			// Ensure peer dependencies are not bundled
			//external: ["three", "three/webgpu", "three/tsl", "three/examples"],
			external: [/^three($|\/)/],
			output: {
				globals: {
					three: "THREE",
				},
			},
		},
		outDir: path.resolve(__dirname, "dist"),
		minify: true,
	},
});
