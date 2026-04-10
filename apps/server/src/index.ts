import { cors } from "@elysiajs/cors";
import { env } from "@stem/env/server";
import { Elysia } from "elysia";
import { smtpProxyPlugin } from "./smtp-proxy/index.js";

export const app = new Elysia()
	.use(
		cors({
			origin: env.CORS_ORIGIN,
			methods: ["GET", "POST", "OPTIONS"],
		})
	)
	.get("/", () => ({ status: "OK", service: "smtp-proxy" }))
	.use(smtpProxyPlugin)
	.listen(3000, () => {
		console.log("Server is running on http://localhost:3000");
	});
