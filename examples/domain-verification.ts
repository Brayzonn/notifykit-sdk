import { NotifyKitClient } from "@notifykit/sdk";

const client = new NotifyKitClient({
  apiKey: process.env.NOTIFYKIT_API_KEY!,
});

async function setupCustomDomain() {
  // Step 1: Request domain verification
  const verification = await client.requestDomainVerification("myapp.com");

  console.log(`Domain: ${verification.domain}`);
  console.log(`Status: ${verification.status}`);
  console.log("\nAdd these DNS records:");

  verification.dnsRecords.forEach((record: any) => {
    console.log(`\nType: ${record.type}`);
    console.log(`Host: ${record.host}`);
    console.log(`Value: ${record.value}`);
  });

  // Step 2: After adding DNS records, verify
  console.log("\n\nAfter adding DNS records, verifying...");

  // Wait for DNS propagation
  await new Promise((resolve) => setTimeout(resolve, 60000)); // 1 minute

  const status = await client.verifyDomain();
  console.log(`\nVerification status: ${status.verified ? "yes" : "not yet"}`);
  console.log(status.message);

  // Step 3: Check status anytime
  const domainInfo = await client.getDomainStatus();
  console.log(`\nDomain: ${domainInfo.domain}`);
  console.log(`Verified: ${domainInfo.verified}`);
}

setupCustomDomain().catch(console.error);
