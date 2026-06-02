import { logger } from "@fems/shared";
import { getInternalSecret } from "../utils/internalSecret";

export const requestImmediateNotificationScan = () => {
  const notificationUrl = process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4003";
  fetch(`${notificationUrl}/internal/notifications/scan`, {
    method: "POST",
    headers: { "x-internal-secret": getInternalSecret() },
  }).catch((error) => {
    logger.warn({ error }, "immediate notification scan could not be requested");
  });
};
