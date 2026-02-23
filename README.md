# NotifyKit SDK

Official Node.js/TypeScript SDK for NotifyKit - Send emails and webhooks with ease.

## Installation

```bash
npm install @notifykit/sdk
```

## Quick Start

```typescript
import { NotifyKitClient } from "@notifykit/sdk";

const notifyKit = new NotifyKitClient({
  apiKey: "ntfy_sk_your_api_key",
});

// Send an email
await notifyKit.sendEmail({
  to: "user@example.com",
  subject: "Welcome!",
  body: "<h1>Hello World</h1>",
});
```

---

## Sending Emails

**Important:** Emails are queued immediately (HTTP 202 Accepted) and delivered asynchronously. Check job status to confirm delivery.

### Basic Email

```typescript
await notifyKit.sendEmail({
  to: "user@example.com",
  subject: "Order Confirmed",
  body: "<h1>Thanks for your order!</h1>",
});
```

### Custom From Address

```typescript
await notifyKit.sendEmail({
  to: "user@example.com",
  subject: "Welcome",
  body: "<h1>Hello</h1>",
  from: "hello@yourapp.com", // Must be a verified domain
});
```

### Prevent Duplicate Sends (Recommended)

```typescript
await notifyKit.sendEmail({
  to: "user@example.com",
  subject: "Welcome",
  body: "<h1>Hello</h1>",
  idempotencyKey: "user-123-welcome", // Prevents duplicate sends on retry
});
```

**How idempotency works:**

- Same key → Request rejected with 409 Conflict, original job returned
- Different key → New email sent
- No key → Always sends (not recommended for production)

---

## Sending Webhooks

**Important:** Like emails, webhooks are queued immediately (HTTP 202 Accepted) and delivered asynchronously. Check job status to confirm delivery.

### Basic Webhook

```typescript
await notifyKit.sendWebhook({
  url: "https://yourapp.com/webhooks/order",
  payload: {
    orderId: "12345",
    status: "completed",
  },
});
```

### With Custom Headers and Method

```typescript
await notifyKit.sendWebhook({
  url: "https://yourapp.com/webhooks/order",
  method: "POST", // GET, POST, PUT, PATCH, DELETE(default is POST)
  payload: { orderId: "12345" },
  headers: {
    "X-Event-Type": "order.created",
    "X-Signature": "abc123",
  },
  idempotencyKey: "order-12345-webhook",
});
```

---

## Tracking Jobs

All notifications return a job object with a job Id that can be tracked.

### Check Job Status

**Important:** `sendEmail()` returns immediately after queuing the job (HTTP 202 Accepted). The actual email is sent asynchronously by a background worker. Always check the job status to confirm delivery.

```typescript
const job = await notifyKit.sendEmail({
  to: "user@example.com",
  subject: "Test",
  body: "<h1>Test</h1>",
});

console.log(`Job ID: ${job.jobId}`); // Save this for later tracking

// Check status later
const status = await notifyKit.getJob(job.jobId);

console.log(status.status); // 'pending' | 'processing' | 'completed' | 'failed'

if (status.status === "completed") {
  console.log("Email sent successfully!");
} else if (status.status === "failed") {
  console.error(" Failed:", status.errorMessage);
}
```

### List Jobs with Filters

```typescript
const result = await notifyKit.listJobs({
  page: 1,
  limit: 20,
  type: "email", // Filter by type: 'email' or 'webhook'
  status: "failed", // Filter by status: 'pending', 'processing', 'completed', 'failed'
});

console.log(`Total: ${result.pagination.total} jobs`);
console.log(`Pages: ${result.pagination.totalPages}`);

result.data.forEach((job) => {
  console.log(`${job.id}: ${job.status} (${job.attempts} attempts)`);
});
```

### Retry Failed Jobs

```typescript
const job = await notifyKit.sendEmail({...});

// Later, if job failed
const status = await notifyKit.getJob(job.jobId);

if (status.status === "failed") {
  // Retry the job
  await notifyKit.retryJob(job.jobId);
  console.log("Job queued for retry");
}
```

**Note:** Only jobs with status `failed` can be retried.

---

## Domain Management

Use your own verified domain to send emails (e.g., `welcome@yourapp.com` instead of `noreply@notifykit.dev`).

### Step 1: Request Domain Verification

```typescript
const verification = await notifyKit.requestDomainVerification("yourapp.com");

console.log(`Domain: ${verification.domain}`);
console.log(`Status: ${verification.status}`); // 'pending' or 'verified'
```

**Response:**

```json
{
  "domain": "yourapp.com",
  "status": "pending",
  "dnsRecords": [
    {
      "id": 1,
      "type": "CNAME",
      "host": "em8724.yourapp.com",
      "value": "u12345678.wl123.sendgrid.net",
      "description": "Mail CNAME - Routes email through SendGrid"
    },
    {
      "id": 2,
      "type": "CNAME",
      "host": "s1._domainkey.yourapp.com",
      "value": "s1.domainkey.u12345678.wl123.sendgrid.net",
      "description": "DKIM 1 - Email authentication (prevents spoofing)"
    },
    {
      "id": 3,
      "type": "CNAME",
      "host": "s2._domainkey.yourapp.com",
      "value": "s2.domainkey.u12345678.wl123.sendgrid.net",
      "description": "DKIM 2 - Email authentication (backup)"
    }
  ],
  "instructions": {
    "message": "Add these DNS records to your domain registrar",
    "steps": [
      "1. Login to your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.)",
      "2. Navigate to DNS settings for your domain",
      "3. Add each CNAME record below",
      "4. Wait 15-60 minutes for DNS propagation",
      "5. Click 'Verify Domain' to check status"
    ],
    "estimatedTime": "15-60 minutes"
  }
}
```

### Understanding DNS Records

**Record 1: Mail CNAME** (`em8724.yourapp.com`)

- Routes emails through SendGrid's infrastructure
- Allows sending from `welcome@em.yourapp.com`

**Record 2 & 3: DKIM Records** (`s1._domainkey` and `s2._domainkey`)

- Digital signatures that prove emails are from you
- Prevents spoofing and improves deliverability
- Two records provide redundancy during key rotation

### Step 2: Add DNS Records to Your Domain

Go to your domain registrar and add the 3 CNAME records:

**Example for Cloudflare:**

```
Type: CNAME
Name: em8724
Content: u12345678.wl123.sendgrid.net
Proxy status: DNS only (disable proxy)
```

**Example for Namecheap:**

```
Type: CNAME Record
Host: em8724
Value: u12345678.wl123.sendgrid.net
TTL: Automatic
```

**DNS propagation takes 15-60 minutes** (sometimes up to 24 hours).

### Step 3: Verify Domain

After adding DNS records and waiting for propagation:

```typescript
const status = await notifyKit.verifyDomain();

if (status.verified) {
  console.log("Domain verified!");
  console.log("You can now send from: welcome@em.yourapp.com");
} else {
  console.log("DNS still propagating...");
  console.log(status.message);

  // Check validation results for issues
  if (status.validationResults) {
    console.log("Validation details:", status.validationResults);
  }
}
```

**Response:**

```json
{
  "domain": "yourapp.com",
  "verified": true,
  "message": "Domain verified! You can now send emails from this domain."
}
```

### Step 4: Send Emails from Your Domain

Once verified, emails automatically use `noreply@em.yourapp.com` if you don't specify a `from` address:

```typescript
// Automatically uses: noreply@em.yourapp.com
await notifyKit.sendEmail({
  to: "user@example.com",
  subject: "Welcome!",
  body: "Welcome to MyApp!",
  // No 'from' specified → Uses noreply@em.yourapp.com
});

// Or specify a custom sender address on your domain
await notifyKit.sendEmail({
  to: "user@example.com",
  subject: "Support Response",
  body: "We're here to help",
  from: "support@em.yourapp.com", // Custom sender
});

// You can also use different names with the same domain
await notifyKit.sendEmail({
  to: "user@example.com",
  subject: "Order Shipped",
  body: "Your order is on the way!",
  from: "orders@em.yourapp.com", // Different sender
});
```

**Important: The `em.` Subdomain**

Emails are sent from `em.yourapp.com` (subdomain), **not** `yourapp.com` (main domain).

**Examples:**

- Correct: `welcome@em.yourapp.com`
- Correct: `support@em.yourapp.com`
- Wrong: `welcome@yourapp.com` (will be rejected)

**Why the subdomain?**

Using a dedicated subdomain (`em.`) for transactional emails protects your main domain's reputation:

1. **Isolation**: If a transactional email is marked as spam, it doesn't hurt your main domain
2. **Separate reputation**: Your business emails (`team@yourapp.com`) remain trusted

**What recipients see:**

```
From: support@em.yourapp.com
```

Most email clients only show `yourapp.com` in the sender name, so users typically see it as coming from your domain.

**If you try to use the main domain:**

```typescript
await notifyKit.sendEmail({
  from: "hello@yourapp.com", //  Missing "em."
});

// Error: "Cannot send from hello@yourapp.com. Use em.yourapp.com instead
// (e.g., hello@em.yourapp.com)"
```

### Check Domain Status Anytime

```typescript
const info = await notifyKit.getDomainStatus();

console.log(`Domain: ${info.domain}`); // 'yourapp.com' or null
console.log(`Verified: ${info.verified}`); // true or false
console.log(`Status: ${info.status}`); // 'not_configured', 'pending', 'verified'

if (info.verified) {
  console.log(`Verified at: ${info.verifiedAt}`);
}
```

**Response:**

```json
{
  "domain": "yourapp.com",
  "verified": true,
  "status": "verified",
  "dnsRecords": [...],
  "requestedAt": "2026-01-04T10:00:00.000Z",
  "verifiedAt": "2026-01-04T10:45:00.000Z"
}
```

### Remove Domain Configuration

```typescript
await notifyKit.removeDomain();
console.log(
  "Domain removed. Emails will now send from NotifyKit's default domain."
);
```

**Note:** You can only have **one verified domain at a time**. Requesting a new domain automatically replaces the old one.

---

## Troubleshooting Domain Verification

### DNS Not Verifying After 1 Hour

**Check DNS propagation:**

```bash
# Check if CNAME exists
dig em8724.yourapp.com CNAME

# Should return: u12345678.wl123.sendgrid.net
```

**Common issues:**

1. **Wrong host name** - Some registrars need full hostname (`em8724.yourapp.com`), others just the subdomain (`em8724`)
2. **Proxy enabled** (Cloudflare) - Disable proxy, use "DNS only"
3. **TTL too high** - Lower TTL to 300 seconds (5 minutes) for faster propagation
4. **Old records** - Delete any existing records for the same hostname first

### Emails Still Sending from NotifyKit Domain

**Possible causes:**

1. Domain not verified yet - Check status: `await notifyKit.getDomainStatus()`
2. Free plan - Custom domains only available on paid plans (Indie, Startup)
3. Verification failed - DNS records may have been removed

### Verification Says "Domain Already Verified by Another Customer"

Each domain can only be verified by one NotifyKit account. If you own this domain:

1. Remove it from the other account first
2. Then verify it on your current account

---

## Best Practices

### Use Subdomain for Transactional Emails

**Good:** `noreply@em.yourapp.com` (dedicated subdomain)  
**Bad:** `noreply@yourapp.com` (main domain)

**Why?** If transactional emails are marked as spam, it doesn't hurt your main domain's reputation for important business emails.

### Set Up DMARC (Optional but Recommended)

Add a TXT record to improve email deliverability:

```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc-reports@yourapp.com
```

This enables email authentication reporting and protects against spoofing.

### Monitor Your Domain Reputation

- Check SendGrid Activity Feed regularly
- Watch for high bounce rates (>5% is concerning)
- Remove invalid email addresses from your lists
- Never send unsolicited emails (spam)

---

## Real-World Examples

### User Signup Flow

```typescript
import { NotifyKitClient } from "@notifykit/sdk";

const notifyKit = new NotifyKitClient({
  apiKey: process.env.NOTIFYKIT_API_KEY,
});

async function handleUserSignup(user) {
  await notifyKit.sendEmail({
    to: user.email,
    subject: "Welcome to MyApp!",
    body: `
      <h1>Hi ${user.name}!</h1>
      <p>Thanks for signing up. Get started by exploring our features.</p>
      <a href="https://myapp.com/get-started">Get Started</a>
    `,
    idempotencyKey: `user-${user.id}-welcome`,
  });
}
```

### Order Confirmation with Multiple Notifications

```typescript
async function handleOrderPlaced(order) {
  // Send email to customer
  await notifyKit.sendEmail({
    to: order.customerEmail,
    subject: `Order #${order.id} Confirmed`,
    body: generateOrderConfirmationEmail(order),
    idempotencyKey: `order-${order.id}-customer-email`,
  });

  // Notify warehouse system via webhook
  await notifyKit.sendWebhook({
    url: "https://warehouse-system.com/api/new-order",
    method: "POST",
    payload: {
      orderId: order.id,
      items: order.items,
      shippingAddress: order.shippingAddress,
      priority: order.priority,
    },
    headers: {
      "X-Warehouse-Token": process.env.WAREHOUSE_API_TOKEN,
    },
    idempotencyKey: `order-${order.id}-warehouse-webhook`,
  });

  // Send to analytics
  await notifyKit.sendWebhook({
    url: "https://analytics.myapp.com/track",
    payload: {
      event: "order.placed",
      orderId: order.id,
      revenue: order.total,
      customerId: order.customerId,
    },
    idempotencyKey: `order-${order.id}-analytics`,
  });
}
```

### Background Job Status Monitoring

```typescript
async function sendEmailWithMonitoring(
  to: string,
  subject: string,
  body: string
) {
  const job = await notifyKit.sendEmail({ to, subject, body });

  // Check status after 5 seconds
  setTimeout(async () => {
    const status = await notifyKit.getJob(job.jobId);

    if (status.status === "failed") {
      console.error(`Email delivery failed: ${status.errorMessage}`);
      await alertAdmin(`Email to ${to} failed`);
    }
  }, 5000);

  return job;
}
```

---

## Configuration

### Custom Base URL (Self-Hosted or Staging)

```typescript
const notifyKit = new NotifyKitClient({
  apiKey: "ntfy_sk_...",
  baseUrl: "https://staging-api.notifykit.dev", // Default: https://api.notifykit.dev
});
```

---

## API Reference

| Method                              | Description                      | Returns                      |
| ----------------------------------- | -------------------------------- | ---------------------------- |
| `sendEmail(options)`                | Send an email notification       | `JobResponse`                |
| `sendWebhook(options)`              | Send a webhook notification      | `JobResponse`                |
| `getJob(jobId)`                     | Get job status by ID             | `JobStatus`                  |
| `listJobs(options?)`                | List jobs with optional filters  | `{ data, pagination }`       |
| `retryJob(jobId)`                   | Retry a failed job               | `JobResponse`                |
| `requestDomainVerification(domain)` | Request domain verification      | `DomainVerificationResponse` |
| `verifyDomain()`                    | Check domain DNS verification    | `DomainStatusResponse`       |
| `getDomainStatus()`                 | Get current domain configuration | `DomainInfoResponse`         |
| `removeDomain()`                    | Remove domain configuration      | `{ message: string }`        |

### TypeScript Types

All methods are fully typed. Import types for use in your code:

```typescript
import {
  NotifyKitClient,
  SendEmailOptions,
  SendWebhookOptions,
  JobResponse,
  JobStatus,
  NotifyKitError,
} from "@notifykit/sdk";
```

---

## Requirements

- Node.js 16+ or browser with fetch support
- TypeScript 4.5+ (optional, for type checking)

---

## Support

- 🐛 Issues: [GitHub Issues](https://github.com/brayzonn/notifykit-sdk/issues)

---

## License

MIT © NotifyKit
