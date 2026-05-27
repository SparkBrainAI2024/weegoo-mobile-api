import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { EnvService } from '@libs/common/config/env.service';

/**
 * Service for sending Firebase Cloud Messages (FCM).
 */
@Injectable()
export class FirebaseMessagingService implements OnModuleInit {
  private readonly messaging: admin.messaging.Messaging;

  constructor(private readonly envService: EnvService) {
    this.messaging = admin.messaging();
  }

  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.envService.getFirebaseProjectId(),
          clientEmail: this.envService.getFirebaseClientEmail(),
          privateKey: this.envService.getFirebasePrivateKey()?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  /**
   * Sends a single push notification to a specific device.
   * @param token The registration token of the target device.
   * @param message The message payload to send.
   * @returns A promise that resolves with the message ID.
   */
  async sendSingleMessage(
    token: string,
    message: admin.messaging.Message,
  ): Promise<string> {
    try {
      const response = await this.messaging.send(message);
      return response;
    } catch (error) {
      console.error('Error sending single message:', error);
      throw error;
    }
  }

  /**
   * Sends multiple push notifications to a list of devices.
   * @param tokens An array of registration tokens of the target devices.
   * @param message The message payload to send.
   * @returns A promise that resolves with the batch response.
   */
  async sendMulticastMessage(
    tokens: string[],
    message: admin.messaging.MulticastMessage,
  ): Promise<admin.messaging.BatchResponse> {
    try {
      // Add the tokens to the message object for multicast sending
      const multicastMessage: admin.messaging.MulticastMessage = {
        ...message,
        tokens: tokens,
      };
      const response = await this.messaging.sendEachForMulticast(multicastMessage);
      if (response.failureCount > 0) {
        const failedTokens:any = [];
        response.responses.forEach((resp:any, idx:number) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            console.error(`Failed to send to token ${tokens[idx]}: ${resp.error?.message}`);
          }
        });
        console.warn(`List of tokens that caused failures: ${failedTokens}`);
      }
      return response;
    } catch (error) {
      console.error('Error sending multicast message:', error);
      throw error;
    }
  }
}