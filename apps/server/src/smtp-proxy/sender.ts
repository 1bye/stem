import type { SentMessageInfo, Transporter } from "nodemailer";
import { createTransport } from "nodemailer";
import { getSmtpProviders } from "./config.js";
import type { EmailPayload, SendEmailResult, SmtpProvider } from "./types.js";
import { extractMessageId, extractRecipients } from "./types.js";
import { parseAttachments } from "./validation.js";

const transportCache = new Map<string, Transporter<SentMessageInfo>>();

function getTransporter(provider: SmtpProvider): Transporter<SentMessageInfo> {
	const cacheKey = `${provider.host}:${provider.port}:${provider.name}`;

	const cached = transportCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const auth = provider.auth.apiKey
		? { user: "apikey", pass: provider.auth.apiKey }
		: { user: provider.auth.user, pass: provider.auth.pass };

	const transporter = createTransport({
		host: provider.host,
		port: provider.port,
		secure: provider.secure,
		auth,
		pool: true,
		maxConnections: 5,
		maxMessages: 100,
	});

	transportCache.set(cacheKey, transporter);
	return transporter;
}

export function clearTransportCache(): void {
	for (const transporter of transportCache.values()) {
		transporter.close();
	}
	transportCache.clear();
}

function normalizeRecipients(
	recipients: string | string[] | undefined
): string[] {
	if (!recipients) {
		return [];
	}
	return Array.isArray(recipients) ? recipients : [recipients];
}

export async function sendEmail(email: EmailPayload): Promise<SendEmailResult> {
	const providers = getSmtpProviders();
	const lastError: Error[] = [];

	for (const provider of providers) {
		try {
			const transporter = getTransporter(provider);

			const mailOptions = {
				from: email.from,
				to: normalizeRecipients(email.to),
				cc: normalizeRecipients(email.cc),
				bcc: normalizeRecipients(email.bcc),
				subject: email.subject,
				text: email.text,
				html: email.html,
				replyTo: email.replyTo,
				attachments: parseAttachments(email.attachments),
			};

			const info = await transporter.sendMail(mailOptions);
			const { accepted, rejected } = extractRecipients(info);

			return {
				success: true,
				messageId: extractMessageId(info),
				provider: provider.name,
				accepted,
				rejected,
			};
		} catch (error) {
			lastError.push(error instanceof Error ? error : new Error(String(error)));
		}
	}

	return {
		success: false,
		error: "Failed to send email through all configured providers",
		details: lastError.map((e) => e.message).join("; "),
	};
}

export async function checkProviderHealth(): Promise<
	Array<{ name: string; healthy: boolean; error?: string }>
> {
	const providers = getSmtpProviders();
	const results: Array<{ name: string; healthy: boolean; error?: string }> = [];

	for (const provider of providers) {
		try {
			const transporter = getTransporter(provider);
			await transporter.verify();
			results.push({ name: provider.name, healthy: true });
		} catch (error) {
			results.push({
				name: provider.name,
				healthy: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return results;
}
