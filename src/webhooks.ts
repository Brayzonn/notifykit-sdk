import * as crypto from "crypto";

export interface VerifyWebhookSignatureOptions {
  /** Raw request body as a string — do NOT pass a parsed object. */
  payload: string;
  /** Value of the X-Webhook-Timestamp header. */
  timestamp: string;
  /** Value of the X-Webhook-Signature header (format: t=<ts>,v1=<hex>). */
  signature: string;
  /** Plaintext webhook signing secret from your NotifyKit dashboard. */
  secret: string;
  /**
   * Maximum age of the request in seconds before it is rejected as a replay.
   * Defaults to 300 (5 minutes).
   */
  tolerance?: number;
}

/**
 * Verify an incoming webhook signature from NotifyKit.
 *
 * NotifyKit signs outgoing webhook requests with HMAC-SHA256 when a signing
 * secret is configured. Call this on your receiving endpoint to confirm the
 * request is genuine and has not been replayed.
 *
 * @returns `true` if the signature is valid and the request is within the
 *   tolerance window, `false` otherwise.
 *
 * @example
 * ```ts
 * app.post('/webhook', (req, res) => {
 *   const valid = verifyWebhookSignature({
 *     payload: req.rawBody,           // raw string, not parsed JSON
 *     timestamp: req.headers['x-webhook-timestamp'],
 *     signature: req.headers['x-webhook-signature'],
 *     secret: process.env.NOTIFYKIT_WEBHOOK_SECRET,
 *   });
 *   if (!valid) return res.status(401).send('Invalid signature');
 *   // ...
 * });
 * ```
 */
export function verifyWebhookSignature(
  options: VerifyWebhookSignatureOptions,
): boolean {
  const { payload, timestamp, signature, secret, tolerance = 300 } = options;

  let v1: string | undefined;
  let headerTs: string | undefined;
  for (const part of signature.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key === "v1") v1 = val;
    if (key === "t") headerTs = val;
  }

  if (!v1 || !headerTs) return false;

  if (headerTs !== timestamp) return false;

  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;

  const age = Math.floor(Date.now() / 1000) - ts;
  if (age < 0 || age > tolerance) return false;

  const signed = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signed)
    .digest("hex");

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(v1, "hex");
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}
