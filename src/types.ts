export interface NotifyKitConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
  idempotencyKey?: string;
}

export interface ApiInfo {
  name: string;
  version: string;
  description: string;
  documentation: string;
}

export interface SendWebhookOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  payload?: any;
  headers?: Record<string, string>;
  idempotencyKey?: string;
}

export interface JobResponse {
  jobId: string;
  status: string;
  type: string;
  createdAt: string;
}

export interface JobStatus {
  id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

//customer domain verification types
export interface DomainVerificationRequest {
  domain: string;
}

export interface DnsRecord {
  id: number;
  type: string;
  host: string;
  value: string;
  description: string;
}

export interface DomainVerificationResponse {
  domain: string;
  status: "pending" | "verified";
  dnsRecords: DnsRecord[];
  instructions: {
    message: string;
    steps: string[];
    estimatedTime: string;
  };
}

export interface DomainStatusResponse {
  domain: string;
  verified: boolean;
  message: string;
  validationResults?: any;
}

export interface DomainInfoResponse {
  domain: string | null;
  verified: boolean;
  status: "not_configured" | "pending" | "verified";
  dnsRecords?: any;
  requestedAt?: string;
  verifiedAt?: string;
}
