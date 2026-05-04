export interface NotifyKitConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type EmailProvider = "SENDGRID" | "RESEND" | "POSTMARK";

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
  priority?: 1 | 5 | 10;
  idempotencyKey?: string;
  /**
   * Force this email through a specific configured provider (paid plans only).
   * If unset, the customer's priority order with full failover applies.
   */
  provider?: EmailProvider;
  /**
   * Fallback provider to try if `provider` fails. Ignored unless `provider`
   * is set. Other configured providers are not tried.
   */
  fallback?: EmailProvider;
}

export interface SendWebhookOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  payload: any;
  headers?: Record<string, string>;
  priority?: 1 | 5 | 10;
  idempotencyKey?: string;
}

export interface JobResponse {
  jobId: string;
  status: string;
  type: string;
  createdAt: string;
}

export interface DeliveryLog {
  id: string;
  attempt: number;
  status: string;
  usedProvider: EmailProvider | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface JobStatus {
  id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  priority: number;
  payload: object;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  deliveryLogs: DeliveryLog[];
}

export interface JobSummary {
  id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  priority: number;
  attempts: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface RetryJobResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface ApiInfo {
  name: string;
  version: string;
  description: string;
  documentation: string;
}
