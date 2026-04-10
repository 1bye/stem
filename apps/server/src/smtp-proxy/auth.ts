import { env } from "@stem/env/server";

let cachedApiKeys: Set<string> | null = null;

export function getApiKeys(): Set<string> {
	if (cachedApiKeys) {
		return cachedApiKeys;
	}

	try {
		const rawKeys = env.API_KEYS;
		const keys = rawKeys
			.split(",")
			.map((k) => k.trim())
			.filter(Boolean);
		if (keys.length === 0) {
			throw new Error("API_KEYS must contain at least one key");
		}
		cachedApiKeys = new Set(keys);
		return cachedApiKeys;
	} catch (error) {
		throw new Error(
			`Invalid API_KEYS configuration: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

export function clearApiKeyCache(): void {
	cachedApiKeys = null;
}

export function validateApiKey(key: string | undefined): boolean {
	if (!key) {
		return false;
	}
	const keys = getApiKeys();
	return keys.has(key);
}

export function extractBearerToken(
	authHeader: string | undefined
): string | undefined {
	if (!authHeader) {
		return undefined;
	}
	const parts = authHeader.split(" ");
	if (parts.length !== 2) {
		return undefined;
	}
	const scheme = parts[0];
	const token = parts[1];
	if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
		return undefined;
	}
	return token;
}
