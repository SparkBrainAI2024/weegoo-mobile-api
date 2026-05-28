import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { EnvService } from '@libs/common/config/env.service';

@Injectable()
export class FirebaseMessagingService implements OnModuleInit {
  private messaging: admin.messaging.Messaging;

  constructor(private readonly envService: EnvService) {}

  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.envService.getFirebaseProjectId(),
          clientEmail: this.envService.getFirebaseClientEmail(),
          privateKey: this.envService
            .getFirebasePrivateKey()
            ?.replace(/\\n/g, '\n'),
        }),
      });
    }

    // Initialize messaging AFTER app initialization
    this.messaging = admin.messaging();
  }

  async sendSingleMessage(
    token: string,
    message: admin.messaging.Message,
  ): Promise<string> {
    try {
      const response = await this.messaging.send({
        ...message,
        token,
      });

      return response;
    } catch (error) {
      console.error('Error sending single message:', error);
      throw error;
    }
  }

  async sendMulticastMessage(
    tokens: string[],
    message: admin.messaging.MulticastMessage,
  ): Promise<admin.messaging.BatchResponse> {
    try {
      const multicastMessage: admin.messaging.MulticastMessage = {
        ...message,
        tokens,
      };

      const response =
        await this.messaging.sendEachForMulticast(multicastMessage);

      if (response.failureCount > 0) {
        const failedTokens: string[] = [];

        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            console.error(
              `Failed to send to token ${tokens[idx]}: ${resp.error?.message}`,
            );
          }
        });

        console.warn(
          `List of tokens that caused failures: ${failedTokens}`,
        );
      }

      return response;
    } catch (error) {
      console.error('Error sending multicast message:', error);
      throw error;
    }
  }
}