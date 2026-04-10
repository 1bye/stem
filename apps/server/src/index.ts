import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { env } from "@stem/env/server";
import { Elysia } from "elysia";
import { z } from "zod";
import { smtpProxyPlugin } from "./smtp-proxy/index.js";

export const app = new Elysia()
	.use(
		cors({
			origin: env.CORS_ORIGIN,
			methods: ["GET", "POST", "OPTIONS"],
		})
	)
	.get("/", () => ({ status: "OK", service: "smtp-proxy" }))
	.use(
		openapi({
			documentation: {
				info: {
					title: "SMTP HTTP Proxy API",
					version: "1.0.0",
					description:
						"A stateless SMTP HTTP proxy supporting multiple providers with automatic failover",
				},
				components: {
					securitySchemes: {
						bearerAuth: {
							type: "http",
							scheme: "bearer",
							bearerFormat: "API Key",
						},
					},
				},
				tags: [
					{
						name: "SMTP Proxy",
						description: "Email sending and health check endpoints",
					},
				],
			},
			mapJsonSchema: {
				zod: z.toJSONSchema,
			},
		})
	)
	.use(smtpProxyPlugin)
	.listen(3000, () => {
		console.log("Server is running on http://localhost:3000");
	});
