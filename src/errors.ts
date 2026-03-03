export class NotifyKitError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any,
    public errors?: any[],
    public retryAfter?: number
  ) {
    super(message);
    this.name = "NotifyKitError";

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get formatted error message with details
   */
  getFullMessage(): string {
    let msg = this.message;

    if (this.statusCode) {
      msg = `[${this.statusCode}] ${msg}`;
    }

    if (this.errors && this.errors.length > 0) {
      msg +=
        "\nValidation errors:\n" +
        this.errors.map((e) => `  - ${e}`).join("\n");
    }

    return msg;
  }

  /**
   * Check if error is a specific HTTP status
   */
  isStatus(code: number): boolean {
    return this.statusCode === code;
  }
}
