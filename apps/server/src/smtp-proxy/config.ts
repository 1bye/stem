import { env } from "@stem/env/server";
import type { SmtpProvider } from "./types.js";

let cachedProviders: SmtpProvider[] | null = null;

export function getSmtpProviders(): SmtpProvider[] {
	if (cachedProviders) {
		return cachedProviders;
	}

	try {
		const parsed = JSON.parse(env.SMTP_PROVIDERS) as SmtpProvider[];
		if (!Array.isArray(parsed) || parsed.length === 0) {
			throw new Error("SMTP_PROVIDERS must be a non-empty array");
		}
		cachedProviders = parsed;
		return parsed;
	} catch (error) {
		throw new Error(
			`Invalid SMTP_PROVIDERS configuration: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

export function clearProviderCache(): void {
	cachedProviders = null;
}

export function getPrimaryProvider(): SmtpProvider {
	const providers = getSmtpProviders();
	const primary = providers[0];
	if (!primary) {
		throw new Error("No SMTP providers configured");
	}
	return primary;
}

export function getProviderByName(name: string): SmtpProvider | undefined {
	const providers = getSmtpProviders();
	return providers.find((p) => p.name === name);
}
