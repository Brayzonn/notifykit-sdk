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

> **Note:** On the **Free plan**, emails send from NotifyKit's shared SendGrid account (`noreply@notifykit.dev`). On **Indie/Startup plans**, connect your own SendGrid API key in the dashboard before sending emails.

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
  from: "hello@em.yourapp.com", // Must be a verified domain
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

// Force SendGrid first, then Resend if SendGrid fails. No other providers tried.
await client.sendEmail({
  to: "user@example.com",
  subject: "Receipt",
  body: "<h1>Thanks</h1>",
  provider: "SENDGRID",
  fallback: "RESEND",
});
```

**Validation:**

| Case                                                               | Outcome           |
| ------------------------------------------------------------------ | ----------------- |
| `fallback` set without `provider`                                  | `400 Bad Request` |
| `provider` equals `fallback`                                       | `400 Bad Request` |
| Requested `provider` or `fallback` not configured for your account | `400 Bad Request` |

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

Webhooks are queued immediately (HTTP 202 Accepted) and delivered asynchronously with automatic retries on failure.

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
    "X-Webhook-Secret": process.env.WEBHOOK_SECRET!,
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

For successful sends, the last entry's `usedProvider` is the provider that delivered. For failures, it's the last provider attempted. Webhook jobs return an empty array.

### List Jobs with Filters

```typescript
const result = await client.listJobs({
  page: 1,
  limit: 20,
  type: "email", // Filter by type: 'email' or 'webhook'
  status: "failed", // Filter by status
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
    if (error.isStatus(403))
      console.error("Quota or permission error:", error.message);
    if (error.isStatus(409)) console.error("Duplicate idempotency key");
    if (error.isStatus(429)) console.error("Rate limit exceeded");
  }
}
```

---

## API Reference

| Method                 | Description                     | Returns                         |
| ---------------------- | ------------------------------- | ------------------------------- |
| `sendEmail(options)`   | Send an email notification      | `Promise<JobResponse>`          |
| `sendWebhook(options)` | Send a webhook notification     | `Promise<JobResponse>`          |
| `getJob(jobId)`        | Get job status and details      | `Promise<JobStatus>`            |
| `listJobs(options?)`   | List jobs with optional filters | `Promise<{ data, pagination }>` |
| `retryJob(jobId)`      | Retry a failed job              | `Promise<RetryJobResponse>`     |
| `ping()`               | Test API connection             | `Promise<string>`               |
| `getApiInfo()`         | Get API version info            | `Promise<ApiInfo>`              |

### TypeScript Types

```typescript
import type {
  NotifyKitConfig,
  SendEmailOptions,
  SendWebhookOptions,
  JobResponse,
  ApiInfo,
} from "@notifykit/sdk";
```

---

## Plans

| Plan    | Price  | Webhooks/month | Emails/month                      |
| ------- | ------ | -------------- | --------------------------------- |
| Free    | $0     | 100 (shared)   | 100 (shared with webhooks)        |
| Indie   | $9/mo  | 4,000          | Unlimited (via your SendGrid key) |
| Startup | $30/mo | 15,000         | Unlimited (via your SendGrid key) |

---

## Support

- Docs: [docs.notifykit.dev](https://docs.notifykit.dev)
- Issues: [GitHub Issues](https://github.com/brayzonn/notifykit-sdk/issues)

---

## License

MIT © NotifyKit
