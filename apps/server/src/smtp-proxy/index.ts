import { openapi } from "@elysiajs/openapi";
import { env } from "@stem/env/server";
import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { initLogger } from "evlog";
import { evlog } from "evlog/elysia";
import { z } from "zod";
import { extractBearerToken, validateApiKey } from "./auth.js";
import { checkProviderHealth, sendEmail } from "./sender.js";
import { validateEmailPayload } from "./validation.js";

initLogger({
	env: { service: "smtp-proxy" },
});

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
	.use(evlog())
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
	.onBeforeHandle(({ headers, set, log }) => {
		const authHeader = headers.authorization;
		const token = extractBearerToken(authHeader);

		log.set({ auth: { hasToken: !!token } });

		if (!(token && validateApiKey(token))) {
			log.set({ auth: { valid: false } });
			set.status = 401;
			return {
				success: false,
				error: "Unauthorized: Invalid or missing API key",
			};
		}

		log.set({ auth: { valid: true } });
	})
	.post(
		"/send",
		async ({ body, log }) => {
			log.set({ email: { to: body.to, subject: body.subject } });

			const validation = validateEmailPayload(body);

			if (!validation.success) {
				log.set({ validation: { success: false, error: validation.error } });
				return { success: false, error: validation.error };
			}

			log.set({ validation: { success: true } });

			const result = await sendEmail(validation.data);

			log.set({
				email: {
					sent: result.success,
					provider: result.success ? result.provider : undefined,
					messageId: result.success ? result.messageId : undefined,
				},
			});

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
		async ({ log }) => {
			const providers = await checkProviderHealth();
			const allHealthy = providers.every((p) => p.healthy);

			log.set({
				health: {
					status: allHealthy ? "healthy" : "degraded",
					providers: providers.map((p) => ({
						name: p.name,
						healthy: p.healthy,
					})),
				},
			});

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
