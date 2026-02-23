import { NotifyKitClient } from "@notifykit/sdk";

const client = new NotifyKitClient({
  apiKey: process.env.NOTIFYKIT_API_KEY!,
});

async function main() {
  const job = await client.sendEmail({
    to: "user@example.com",
    subject: "Welcome to MyApp!",
    body: "<h1>Welcome!</h1><p>Thanks for signing up.</p>",
    idempotencyKey: "user-123-welcome",
  });

  console.log("Email queued:", job.jobId);

  setTimeout(async () => {
    const status = await client.getJob(job.jobId);
    console.log("Job status:", status.status);
  }, 5000);
}

main().catch(console.error);
