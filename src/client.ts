import axios, { AxiosInstance } from 'axios';
import {
  NotifyKitConfig,
  SendEmailOptions,
  SendWebhookOptions,
  JobResponse,
  JobStatus,
  ApiInfo,
  PaginationMeta,
  RetryJobResponse,
} from './types';
import { NotifyKitError } from './errors';

export class NotifyKitClient {
  private client: AxiosInstance;

  constructor(config: NotifyKitConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    this.client = axios.create({
      baseURL: config.baseUrl || 'https://api.notifykit.dev',
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => {
        const apiResponse = response.data;

        if (apiResponse && apiResponse.success === false) {
          throw new NotifyKitError(
            apiResponse.error || apiResponse.message || 'Request failed',
            response.status,
            apiResponse,
          );
        }

        return apiResponse?.data ?? apiResponse;
      },
      (error) => {
        if (error.response) {
          const data = error.response.data;
          const statusCode = error.response.status;

          let message = error.message;
          let errors = null;

          if (data?.error) {
            if (Array.isArray(data.error)) {
              errors = data.error;
              message = data.error.join(', ');
            } else {
              message = data.error;
            }
          } else if (data?.message) {
            if (Array.isArray(data.message)) {
              errors = data.message;
              message = 'Validation failed';
            } else {
              message = data.message;
            }
          }

          throw new NotifyKitError(message, statusCode, data, errors);
        }

        throw new NotifyKitError(error.message || 'Network error occurred');
      },
    );
  }

  // ================================
  // APP
  // ================================

  /** Test API connection */
  async ping(): Promise<string> {
    return await this.client.get('/api/v1/ping');
  }

  /** Get API information */
  async getApiInfo(): Promise<ApiInfo> {
    return await this.client.get('/api/v1/info');
  }

  // ================================
  // NOTIFICATIONS
  // ================================

  /** Send an email notification */
  async sendEmail(options: SendEmailOptions): Promise<JobResponse> {
    return await this.client.post('/api/v1/notifications/email', options);
  }

  /** Send a webhook notification */
  async sendWebhook(options: SendWebhookOptions): Promise<JobResponse> {
    return await this.client.post('/api/v1/notifications/webhook', options);
  }

  /** Get job status by ID */
  async getJob(jobId: string): Promise<JobStatus> {
    return await this.client.get(`/api/v1/notifications/jobs/${jobId}`);
  }

  /** List jobs with optional filters */
  async listJobs(options?: {
    page?: number;
    limit?: number;
    type?: 'email' | 'webhook';
    status?: 'pending' | 'processing' | 'completed' | 'failed';
  }): Promise<{ data: JobStatus[]; pagination: PaginationMeta }> {
    return await this.client.get('/api/v1/notifications/jobs', {
      params: options,
    });
  }

  /** Retry a failed job */
  async retryJob(jobId: string): Promise<RetryJobResponse> {
    return await this.client.post(`/api/v1/notifications/jobs/${jobId}/retry`);
  }
}
