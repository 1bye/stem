import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/index.ts",
	format: "esm",
	outDir: "./dist",
	clean: true,
	noExternal: [
		/@stem\/.*/,
		/@elysiajs\/.*/,
		"elysia",
		"elysia-rate-limit",
		"nodemailer",
		"zod",
		"dotenv",
		"evlog",
		"evlog/elysia",
	],
});
