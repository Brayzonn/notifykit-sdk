import { NotifyKitClient } from "@notifykit/sdk";

const client = new NotifyKitClient({
  apiKey: process.env.NOTIFYKIT_API_KEY!,
});

async function main() {
  const job = await client.sendWebhook({
    url: "https://yourapp.com/webhooks/order-created",
    method: "POST",
    payload: {
      orderId: "12345",
      customerId: "user-123",
      items: [
        { productId: "prod-1", quantity: 2, price: 29.99 },
        { productId: "prod-2", quantity: 1, price: 49.99 },
      ],
      total: 109.97,
      status: "pending",
    },
    headers: {
      "X-Event-Type": "order.created",
    },
    idempotencyKey: "order-12345-webhook",
  });

  console.log("Webhook queued:", job.jobId);

  // Check status after 5 seconds
  setTimeout(async () => {
    const status = await client.getJob(job.jobId);
    console.log("Job status:", status.status);

    if (status.status === "failed") {
      console.error("Webhook failed:", status.errorMessage);
    } else if (status.status === "completed") {
      console.log("Webhook delivered successfully!");
    }
  }, 5000);
}

main().catch(console.error);
