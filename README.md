# NotifyKit SDK

Official Node.js/TypeScript SDK for NotifyKit — send emails and webhooks with automatic retries and delivery tracking.

## Installation

```bash
npm install @notifykit/sdk
```

**Requirements:** Node.js 18+

## Quick Start

```typescript
import { NotifyKitClient } from "@notifykit/sdk";

const client = new NotifyKitClient({
  apiKey: process.env.NOTIFYKIT_API_KEY!, // nh_...
});

// Send an email
const emailJob = await client.sendEmail({
  to: "user@example.com",
  subject: "Welcome!",
  body: "<h1>Hello World</h1>",
  idempotencyKey: "welcome-user-123",
});

// Send a webhook
const webhookJob = await client.sendWebhook({
  url: "https://your-app.com/webhooks/events",
  payload: { event: "user.created", userId: "123" },
});
```

---

## Sending Emails

Emails are queued immediately (HTTP 202 Accepted) and delivered asynchronously. Use [getJob](#tracking-jobs) to confirm delivery.

> **Note:** On the **Free plan**, emails send from NotifyKit's shared SendGrid account (`noreply@notifykit.dev`). On **Indie/Startup plans**, connect your own SendGrid, Resend, or Postmark API key in the dashboard before sending emails.

### Basic Email

```typescript
await client.sendEmail({
  to: "user@example.com",
  subject: "Order Confirmed",
  body: "<h1>Thanks for your order!</h1>",
});
```

### Custom From Address (Paid Plans)

```typescript
await client.sendEmail({
  to: "user@example.com",
  subject: "Welcome",
  body: "<h1>Hello</h1>",
  from: "hello@em.yourapp.com", // Must be a verified sending domain
});
```

### High Priority

```typescript
await client.sendEmail({
  to: "user@example.com",
  subject: "Password Reset",
  body: "<p>Click here to reset your password.</p>",
  priority: 1, // 1=high, 5=normal (default), 10=low
});
```

### Per-Message Provider Routing (Paid Plans)

By default, NotifyKit picks the email provider based on your configured priority order and falls back through all of them on failure. To pin a specific provider per message, pass `provider`. To narrow the failover to one alternative, pass `fallback`.

```typescript
// Force this email through SendGrid; if it fails, the job fails.
await client.sendEmail({
  to: "user@example.com",
  subject: "Receipt",
  body: "<h1>Thanks</h1>",
  provider: "SENDGRID",
});

// Force Postmark first, then Resend if Postmark fails. No other providers tried.
await client.sendEmail({
  to: "user@example.com",
  subject: "Receipt",
  body: "<h1>Thanks</h1>",
  provider: "POSTMARK",
  fallback: "RESEND",
});
```

Valid provider values: `"SENDGRID"` | `"RESEND"` | `"POSTMARK"`

**Validation:**

| Case                                                               | Outcome           |
| ------------------------------------------------------------------ | ----------------- |
| `fallback` set without `provider`                                  | `400 Bad Request` |
| `provider` equals `fallback`                                       | `400 Bad Request` |
| Requested `provider` or `fallback` not configured for your account | `400 Bad Request` |
| Either provider used on Free plan                                  | `400 Bad Request` |

Forced routing is a contract: NotifyKit does **not** retry through providers you didn't authorize. The routing fields persist with the job, so manual or automatic retries replay the same attempt set.

To inspect which provider actually delivered (or which one was last attempted on failure), see [Tracking Jobs](#tracking-jobs) — `getJob(id)` returns a `deliveryLogs[]` array with a `usedProvider` field on each entry.

### Prevent Duplicate Sends

```typescript
await client.sendEmail({
  to: "user@example.com",
  subject: "Welcome",
  body: "<h1>Hello</h1>",
  idempotencyKey: "user-123-welcome", // Prevents duplicate sends on retry
});
```

**How idempotency works:**

- Same key → Request rejected with `409 Conflict`, original job returned
- Different key → New email sent
- No key → Always sends (not recommended for critical transactional emails)

---

## Sending Webhooks

Webhooks are queued immediately (HTTP 202 Accepted) and delivered asynchronously with automatic retries on failure. Payloads are capped at **10kb**.

### Basic Webhook

```typescript
await client.sendWebhook({
  url: "https://yourapp.com/webhooks/order",
  payload: {
    orderId: "12345",
    status: "completed",
  },
});
```

### With Custom Headers and Method

```typescript
await client.sendWebhook({
  url: "https://yourapp.com/webhooks/order",
  method: "POST",
  payload: { orderId: "12345" },
  headers: {
    "X-Event-Type": "order.created",
  },
  idempotencyKey: "order-12345-webhook",
});
```

**Retry behavior:**

- Max 3 attempts, exponential backoff (~2s, ~4s, ~8s)
- Retried on 5xx errors, network failures, timeouts
- Not retried on 4xx errors

---

## Webhook Signing

When a webhook signing secret is configured in your dashboard, NotifyKit signs every outgoing webhook delivery with HMAC-SHA256. Your receiving endpoint can verify this signature to confirm the request is genuine and hasn't been replayed.

**Headers sent with each delivery:**

| Header                  | Value                          |
| ----------------------- | ------------------------------ |
| `X-Webhook-Timestamp`   | Unix timestamp (seconds)       |
| `X-Webhook-Signature`   | `t=<timestamp>,v1=<hex>`       |

### Verifying Signatures

```typescript
import { verifyWebhookSignature } from "@notifykit/sdk";

app.post("/webhooks/notifykit", (req, res) => {
  const valid = verifyWebhookSignature({
    payload: req.rawBody,                              // raw string — NOT parsed JSON
    timestamp: req.headers["x-webhook-timestamp"],
    signature: req.headers["x-webhook-signature"],
    secret: process.env.NOTIFYKIT_WEBHOOK_SECRET!,
    tolerance: 300,                                    // optional, default 300s (5 min)
  });

  if (!valid) return res.status(401).send("Invalid signature");

  const event = req.body;
  // handle event...
  res.sendStatus(200);
});
```

> **Important:** Always use the **raw body string** (`req.rawBody`), not the parsed JSON object. Re-serializing a parsed object can produce a different byte sequence and will cause verification to fail.

The `tolerance` option rejects requests older than N seconds, protecting against replay attacks. Set it to `0` to disable the time check entirely.

**`verifyWebhookSignature` returns `false` (never throws) when:**
- The signature header is missing or malformed
- The timestamp is outside the tolerance window
- The HMAC digest does not match

---

## Tracking Jobs

Every notification returns a job ID you can use to track delivery status.

### Check Job Status

```typescript
const job = await client.sendEmail({
  to: "user@example.com",
  subject: "Test",
  body: "<h1>Test</h1>",
});

console.log(`Job ID: ${job.jobId}`);

// Check status later
const status = await client.getJob(job.jobId);

console.log(status.status); // 'pending' | 'processing' | 'completed' | 'failed'

if (status.status === "completed") {
  console.log("Delivered successfully!");
} else if (status.status === "failed") {
  console.error("Failed:", status.errorMessage);
}
```

### Inspect Delivery Attempts

`getJob(id)` returns a `deliveryLogs[]` array — one entry per delivery attempt — with the provider that was used:

```typescript
const status = await client.getJob(job.jobId);

for (const log of status.deliveryLogs) {
  console.log(
    `attempt ${log.attempt} via ${log.usedProvider ?? "unknown"}: ${log.status}`,
  );
  if (log.errorMessage) console.log(`  error: ${log.errorMessage}`);
}
```

For successful sends, the last entry's `usedProvider` is the provider that delivered. For failures, it's the last provider attempted. Webhook jobs and Free plan jobs return `null` for `usedProvider`.

### List Jobs with Filters

```typescript
const result = await client.listJobs({
  page: 1,
  limit: 20,
  type: "email",   // 'email' | 'webhook'
  status: "failed", // 'pending' | 'processing' | 'completed' | 'failed'
});

console.log(`Total: ${result.pagination.total} jobs`);

result.data.forEach((job) => {
  console.log(`${job.id}: ${job.status} (${job.attempts} attempts)`);
});
```

### Retry Failed Jobs

```typescript
const status = await client.getJob(job.jobId);

if (status.status === "failed") {
  const result = await client.retryJob(job.jobId);
  console.log(result.message); // "Job has been re-queued for processing"
}
```

Only jobs with `failed` status can be retried.

---

## Domain Management

Domain verification is managed through the **NotifyKit dashboard** (Settings → Domain). Verified domains let you send emails from your own address (e.g., `support@em.yourapp.com`) instead of `noreply@notifykit.dev`.

See [Domain Verification](https://docs.notifykit.dev/docs/guides/domain-verification) for setup instructions.

**Available on Indie and Startup plans only.**

---

## Error Handling

```typescript
import { NotifyKitClient, NotifyKitError } from "@notifykit/sdk";

try {
  await client.sendEmail({ to: "bad-email", subject: "Test", body: "Hello" });
} catch (error) {
  if (error instanceof NotifyKitError) {
    console.error(error.getFullMessage());

    if (error.isStatus(400)) console.error("Bad request:", error.message);
    if (error.isStatus(401)) console.error("Invalid API key");
    if (error.isStatus(403)) console.error("Quota or permission error:", error.message);
    if (error.isStatus(409)) console.error("Duplicate idempotency key");
    if (error.isStatus(429)) {
      console.error("Rate limit exceeded");
      if (error.retryAfter) console.log(`Retry after ${error.retryAfter}s`);
    }
  }
}
```

### Automatic Retries & Timeouts

The SDK retries transient failures automatically:

- Retries up to **2 times** (3 attempts total) on **5xx**, **429**, and network errors, with backoff (~200ms → ~500ms).
- On **429**, it waits for the server's `retryAfter` (capped at 10s) before retrying.
- **Other 4xx errors** (e.g. 400, 401, 409) fail immediately — they are never retried.
- Non-idempotent requests (`sendEmail`, `sendWebhook`, `retryJob`) are **not** retried on a timeout or dropped connection, to avoid duplicate sends.
- Every request times out after **10 seconds**.

> This is distinct from NotifyKit's server-side **webhook delivery** retries (see [Sending Webhooks](#sending-webhooks)), which control how delivery to your endpoint is re-attempted.

---

## API Reference

### `NotifyKitClient` methods

| Method                          | Description                     | Returns                         |
| ------------------------------- | ------------------------------- | ------------------------------- |
| `sendEmail(options)`            | Send an email notification      | `Promise<JobResponse>`          |
| `sendWebhook(options)`          | Send a webhook notification     | `Promise<JobResponse>`          |
| `getJob(jobId)`                 | Get job status and delivery logs | `Promise<JobStatus>`            |
| `listJobs(options?)`            | List jobs with optional filters | `Promise<{ data, pagination }>` |
| `retryJob(jobId)`               | Retry a failed job              | `Promise<RetryJobResponse>`     |
| `ping()`                        | Test API connection             | `Promise<string>`               |
| `getApiInfo()`                  | Get API version info            | `Promise<ApiInfo>`              |

### Standalone utilities

| Function                        | Description                                        |
| ------------------------------- | -------------------------------------------------- |
| `verifyWebhookSignature(options)` | Verify HMAC-SHA256 signature on incoming webhooks |

### TypeScript Types

```typescript
import type {
  NotifyKitConfig,
  SendEmailOptions,
  SendWebhookOptions,
  JobResponse,
  JobStatus,
  JobSummary,
  DeliveryLog,
  RetryJobResponse,
  ApiInfo,
  EmailProvider,
  VerifyWebhookSignatureOptions,
} from "@notifykit/sdk";
```

---

## Plans

| Plan    | Price   | Webhooks/month | Emails/month               | Rate limit   |
| ------- | ------- | -------------- | -------------------------- | ------------ |
| Free    | $0      | 100 (shared)   | 100 (shared with webhooks) | 5 req/min    |
| Indie   | $5/mo   | 4,000          | Unlimited (via your key)   | 50 req/min   |
| Startup | $10/mo  | 15,000         | Unlimited (via your key)   | 200 req/min  |

---

## Support

- Docs: [docs.notifykit.dev](https://docs.notifykit.dev)
- Issues: [GitHub Issues](https://github.com/brayzonn/notifykit-sdk/issues)

---

## License

MIT © NotifyKit
