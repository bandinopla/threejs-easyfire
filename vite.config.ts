import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
	base: "/threejs-easyfire/",
	root: path.resolve(__dirname, "demo"),
	resolve: {
		preserveSymlinks: false,
		alias: {
			"threejs-easyfire": path.resolve(__dirname, "src/index.ts"),
		},
	},
	build: {
		outDir: path.resolve(__dirname, "dist-demo"),
		emptyOutDir: true,
	},
	server: {
		port: 3000,
		open: false,
	},
});
