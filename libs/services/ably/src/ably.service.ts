import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Ably from 'ably';
import { EnvService } from '@libs/common/config/env.service';

@Injectable()
export class AblyService implements OnModuleInit {
  private readonly logger = new Logger(AblyService.name);
  private realtime: Ably.Realtime;

  constructor(private readonly envService: EnvService) {}

  onModuleInit() {
    const apiKey = this.envService.getAblyApiKey();
    if (!apiKey) {
      this.logger.warn('Ably API key not configured. Ably service will not be initialized.');
      return;
    }

    this.realtime = new Ably.Realtime({ key: apiKey });

    this.realtime.connection.once('connected', () => {
      this.logger.log('Ably Realtime client connected successfully');
    });

    this.realtime.connection.on('failed', (stateChange: Ably.ConnectionStateChange) => {
      const reason = stateChange.reason;
      this.logger.error(`Ably connection failed: ${reason?.message || 'Unknown error'}`);
    });
  }

  /**
   * Get the underlying Ably Realtime client instance.
   * Useful for advanced use cases.
   */
  getClient(): Ably.Realtime {
    return this.realtime;
  }

  /**
   * Publish a message to a specific channel.
   * @param channelName - The name of the channel to publish to
   * @param eventName - The event name
   * @param data - The data payload
   */
  async publish<T = any>(
    channelName: string,
    eventName: string,
    data: T,
  ): Promise<void> {
    if (!this.realtime) {
      this.logger.warn('Ably not initialized. Cannot publish message.');
      return;
    }

    const channel = this.realtime.channels.get(channelName);
    await channel.publish(eventName, data);
    this.logger.debug(`Published event '${eventName}' to channel '${channelName}'`);
  }

  /**
   * Subscribe to messages on a specific channel.
   * @param channelName - The name of the channel to subscribe to
   * @param eventNameOrCallback - Event name string OR a callback to receive all events
   * @param callback - The callback to invoke when a message is received (required if eventNameOrCallback is a string)
   * @returns An unsubscribe function
   */
  subscribe(
    channelName: string,
    eventNameOrCallback: string | ((message: Ably.Message) => void),
    callback?: (message: Ably.Message) => void,
  ): () => void {
    if (!this.realtime) {
      this.logger.warn('Ably not initialized. Cannot subscribe.');
      return () => {};
    }

    const channel = this.realtime.channels.get(channelName);

    if (typeof eventNameOrCallback === 'function') {
      // subscribe to all events
      channel.subscribe(eventNameOrCallback);
    } else {
      // subscribe to a specific event
      channel.subscribe(eventNameOrCallback, callback);
    }

    this.logger.debug(`Subscribed to channel '${channelName}'`);

    // Return an unsubscribe function
    return () => {
      channel.unsubscribe();
      this.logger.debug(`Unsubscribed from channel '${channelName}'`);
    };
  }

  /**
   * Get a channel instance for advanced operations (history, presence, etc.)
   * @param channelName - The name of the channel
   */
  getChannel(channelName: string): Ably.RealtimeChannel {
    return this.realtime?.channels.get(channelName);
  }
}