import { env } from "@stem/env/server";
import { z } from "zod";
import type { EmailAttachment, EmailPayload } from "./types.js";

const SIZE_REGEX = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/;
const MAX_ATTACHMENT_SIZE_BYTES = parseSize(env.MAX_ATTACHMENT_SIZE);

function parseSize(sizeStr: string): number {
	const units: Record<string, number> = {
		b: 1,
		kb: 1024,
		mb: 1024 * 1024,
		gb: 1024 * 1024 * 1024,
	};

	const trimmed = sizeStr.trim().toLowerCase();
	const match = trimmed.match(SIZE_REGEX);
	if (!match) {
		return 10 * 1024 * 1024;
	}

	const valueStr = match[1];
	const unit = match[2] ?? "b";
	if (!valueStr) {
		return 10 * 1024 * 1024;
	}
	const value = Number.parseFloat(valueStr);
	return value * (units[unit] || 1);
}

const emailAttachmentSchema = z.object({
	filename: z.string().min(1).max(255),
	content: z
		.string()
		.min(1)
		.refine(
			(val) => {
				try {
					const decoded = Buffer.from(val, "base64");
					return decoded.length <= MAX_ATTACHMENT_SIZE_BYTES;
				} catch {
					return false;
				}
			},
			{
				message: `Attachment exceeds maximum size of ${env.MAX_ATTACHMENT_SIZE}`,
			}
		),
	contentType: z.string().optional(),
});

const emailPayloadSchema = z
	.object({
		to: z.union([z.string().email(), z.array(z.string().email())]),
		from: z.string().email().optional(),
		subject: z.string().min(1).max(998),
		text: z.string().optional(),
		html: z.string().optional(),
		cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
		bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
		replyTo: z.string().email().optional(),
		attachments: z.array(emailAttachmentSchema).max(10).optional(),
	})
	.refine((data) => data.text || data.html, {
		message: "Either 'text' or 'html' body must be provided",
	});

export function validateEmailPayload(
	data: unknown
): { success: true; data: EmailPayload } | { success: false; error: string } {
	const result = emailPayloadSchema.safeParse(data);

	if (result.success) {
		return { success: true, data: result.data as EmailPayload };
	}

	const issues = result.error.issues.map(
		(issue) => `${issue.path.join(".")}: ${issue.message}`
	);
	return { success: false, error: issues.join("; ") };
}

export function parseAttachments(
	attachments: EmailAttachment[] | undefined
): Array<{
	filename: string;
	content: Buffer;
	contentType?: string;
}> {
	if (!attachments || attachments.length === 0) {
		return [];
	}

	return attachments.map((att) => ({
		filename: att.filename,
		content: Buffer.from(att.content, "base64"),
		contentType: att.contentType,
	}));
}
