import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		CORS_ORIGIN: z.url(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		SMTP_PROVIDERS: z.string().min(1),
		API_KEYS: z.string().min(1),
		MAX_ATTACHMENT_SIZE: z.string().default("10MB"),
		RATE_LIMIT_PER_MINUTE: z.coerce.number().default(60),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
