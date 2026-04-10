export interface SentMessageInfo {
	accepted: unknown[];
	messageId?: string;
	rejected: unknown[];
}

export interface SmtpProvider {
	auth: {
		user?: string;
		pass?: string;
		apiKey?: string;
	};
	host: string;
	name: string;
	port: number;
	secure: boolean;
}

export interface EmailAttachment {
	content: string;
	contentType?: string;
	filename: string;
}

export interface EmailPayload {
	attachments?: EmailAttachment[];
	bcc?: string | string[];
	cc?: string | string[];
	from?: string;
	html?: string;
	replyTo?: string;
	subject: string;
	text?: string;
	to: string | string[];
}

export interface SendEmailSuccess {
	accepted: string[];
	messageId: string;
	provider: string;
	rejected: string[];
	success: true;
}

export interface SendEmailError {
	details?: string;
	error: string;
	success: false;
}

export type SendEmailResult = SendEmailSuccess | SendEmailError;

export interface SmtpSender {
	send(email: EmailPayload): Promise<SendEmailResult>;
}

export function extractMessageId(info: SentMessageInfo): string {
	if (typeof info.messageId === "string") {
		return info.messageId;
	}
	return `<${Date.now()}.${Math.random().toString(36).slice(2)}@smtp-proxy>`;
}

export function extractRecipients(info: SentMessageInfo): {
	accepted: string[];
	rejected: string[];
} {
	const accepted = Array.isArray(info.accepted)
		? info.accepted.filter((item): item is string => typeof item === "string")
		: [];
	const rejected = Array.isArray(info.rejected)
		? info.rejected.filter((item): item is string => typeof item === "string")
		: [];
	return { accepted, rejected };
}
