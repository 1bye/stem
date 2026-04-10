import { openapi } from "@elysiajs/openapi";
import { env } from "@stem/env/server";
import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { z } from "zod";
import { extractBearerToken, validateApiKey } from "./auth.js";
import { checkProviderHealth, sendEmail } from "./sender.js";
import { validateEmailPayload } from "./validation.js";

const emailRequestSchema = t.Object({
	to: t.Union([t.String(), t.Array(t.String())]),
	from: t.Optional(t.String()),
	subject: t.String(),
	text: t.Optional(t.String()),
	html: t.Optional(t.String()),
	cc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
	bcc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
	replyTo: t.Optional(t.String()),
	attachments: t.Optional(
		t.Array(
			t.Object({
				filename: t.String(),
				content: t.String(),
				contentType: t.Optional(t.String()),
			})
		)
	),
});

const emailSuccessResponse = t.Object({
	success: t.Literal(true),
	messageId: t.String(),
	provider: t.String(),
	accepted: t.Array(t.String()),
	rejected: t.Array(t.String()),
});

const emailErrorResponse = t.Object({
	success: t.Literal(false),
	error: t.String(),
	details: t.Optional(t.String()),
});

const emailResponse = t.Union([emailSuccessResponse, emailErrorResponse]);

const providerHealthSchema = t.Object({
	name: t.String(),
	healthy: t.Boolean(),
	error: t.Optional(t.String()),
});

const healthResponse = t.Object({
	status: t.String(),
	providers: t.Array(providerHealthSchema),
});

export const smtpProxyPlugin = new Elysia({
	prefix: "/v1",
	detail: {
		tags: ["SMTP Proxy"],
		security: [{ bearerAuth: [] }],
	},
})
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
	.use(
		rateLimit({
			max: env.RATE_LIMIT_PER_MINUTE,
			duration: 60_000,
			generator: (req) => {
				const authHeader = req.headers.get("authorization");
				const token = extractBearerToken(authHeader ?? undefined);
				return token ?? req.headers.get("x-forwarded-for") ?? "anonymous";
			},
			scoping: "global",
		})
	)
	.onBeforeHandle(({ headers, set }) => {
		const authHeader = headers.authorization;
		const token = extractBearerToken(authHeader);

		if (!(token && validateApiKey(token))) {
			set.status = 401;
			return {
				success: false,
				error: "Unauthorized: Invalid or missing API key",
			};
		}
	})
	.post(
		"/send",
		async ({ body }) => {
			const validation = validateEmailPayload(body);

			if (!validation.success) {
				return { success: false, error: validation.error };
			}

			const result = await sendEmail(validation.data);
			return result;
		},
		{
			body: emailRequestSchema,
			response: {
				200: emailResponse,
				401: emailErrorResponse,
				429: emailErrorResponse,
				500: emailErrorResponse,
			},
			detail: {
				summary: "Send email",
				description:
					"Send an email through configured SMTP providers with automatic failover",
				tags: ["SMTP Proxy"],
			},
		}
	)
	.get(
		"/health",
		async () => {
			const providers = await checkProviderHealth();
			const allHealthy = providers.every((p) => p.healthy);

			return {
				status: allHealthy ? "healthy" : "degraded",
				providers,
			};
		},
		{
			response: {
				200: healthResponse,
				401: emailErrorResponse,
			},
			detail: {
				summary: "Health check",
				description: "Check the health status of all configured SMTP providers",
				tags: ["SMTP Proxy"],
			},
		}
	);
