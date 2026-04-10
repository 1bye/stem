# SMTP HTTP Proxy

A lightweight, stateless SMTP HTTP proxy built with Bun/TypeScript/ElysiaJS.

## Features

- **Multiple SMTP providers** with automatic failover
- **API key authentication** via Bearer tokens
- **Full email support**: text, HTML, CC, BCC, attachments
- **Rate limiting** per API key
- **Stateless**: No database required
- **Docker-ready**: Easy self-hosting

## Quick Start

### Environment Variables

```bash
# Required
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgres://localhost:5432/dummy  # Required by @stem/env, can be dummy
API_KEYS=sk-key-1,sk-key-2                     # Comma-separated API keys

# SMTP providers (JSON array)
SMTP_PROVIDERS=[{
  "name": "gmail",
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "your-email@gmail.com",
    "pass": "your-app-password"
  }
}]

# Optional
MAX_ATTACHMENT_SIZE=10MB    # Default: 10MB
RATE_LIMIT_PER_MINUTE=60    # Default: 60 requests/minute
```

### Docker Deployment

```bash
docker-compose up -d
```

### API Usage

**Send Email:**
```bash
curl -X POST http://localhost:3000/v1/send \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Hello",
    "text": "Plain text body",
    "html": "<h1>HTML body</h1>"
  }'
```

**Health Check:**
```bash
curl http://localhost:3000/v1/health \
  -H "Authorization: Bearer your-api-key"
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service status |
| `/v1/send` | POST | Send email |
| `/v1/health` | GET | Provider health status |

## Email Payload Schema

```typescript
{
  to: string | string[];           // Required
  from?: string;                   // Optional
  subject: string;                 // Required
  text?: string;                   // Plain text body
  html?: string;                   // HTML body
  cc?: string | string[];          // CC recipients
  bcc?: string | string[];         // BCC recipients
  replyTo?: string;                // Reply-to address
  attachments?: Array<{            // Base64 encoded attachments
    filename: string;
    content: string;                // Base64
    contentType?: string;
  }>;
}
```

## Response Format

**Success (200):**
```json
{
  "success": true,
  "messageId": "<...>",
  "provider": "gmail",
  "accepted": ["recipient@example.com"],
  "rejected": []
}
```

**Error (400/401/429/500):**
```json
{
  "success": false,
  "error": "Error description"
}
```
