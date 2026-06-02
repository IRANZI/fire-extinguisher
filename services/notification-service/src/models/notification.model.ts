export interface EmailJob {
  notificationId: string;
  recipient: string;
  subject: string;
  message: string;
}

export type EmailStatus = "SENT" | "FAILED" | "PREVIEW";
