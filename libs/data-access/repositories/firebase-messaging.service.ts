import { EnvService } from '@libs/common/config/env.service';
import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';


/**
 * Service for sending Firebase Cloud Messages (FCM).
 */
@Injectable()
export class FirebaseMessagingService {
  private readonly logger = new Logger(FirebaseMessagingService.name);
  private readonly messaging: admin.messaging.Messaging;

  constructor(private readonly envService: EnvService) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.envService.getFirebaseProjectId(),
          clientEmail: this.envService.getFirebaseClientEmail(),
          privateKey: this.envService.getFirebasePrivateKey(),
        } as admin.ServiceAccount),
      });
    }
    this.messaging = admin.messaging();
  }

  /**
   * Sends a single push notification to a specific device.
   * @param token The registration token of the target device.
   * @param notification The notification payload (title, body).
   * @param data Optional key-value pairs for additional data.
   * @returns A promise that resolves with the message ID.
   */
  async sendSingleMessage(
    token: string,
    notification: admin.messaging.Notification,
    data?: { [key: string]: string }
  ): Promise<string> {
    try {
      const response = await this.messaging.send({
        token,
        notification,
        data,
      });
      this.logger.log(`Successfully sent single message: ${response}`);
      return response;
    } catch (error) {
      this.logger.error('Error sending single message:', error);
      throw error;
    }
  }

  /**
   * Sends multiple push notifications to a list of devices.
   * @param tokens An array of registration tokens of the target devices.
   * @param notification The notification payload (title, body).
   * @param data Optional key-value pairs for additional data.
   * @returns A promise that resolves with the batch response.
   */
  async sendMulticastMessage(
    tokens: string[],
    notification: admin.messaging.Notification,
    data?: { [key: string]: string }
  ): Promise<admin.messaging.BatchResponse> {
    try {
      const multicastMessage: admin.messaging.MulticastMessage = {
        tokens,
        notification,
        data,
      };
      const response = await this.messaging.sendEachForMulticast(multicastMessage);
      this.logger.log(`Successfully sent multicast message. Success: ${response.successCount}, Failure: ${response.failureCount}`);

      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            this.logger.error(`Failed to send to token ${tokens[idx]}: ${resp.error?.message}`);
          }
        });
        this.logger.warn(`List of tokens that caused failures: ${failedTokens.join(', ')}`);
      }
      return response;
    } catch (error) {
      this.logger.error('Error sending multicast message:', error);
      throw error;
    }
  }
}