import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import { SocialService, PublishBookInput } from '../social/social.service';
import { SocialNetwork } from '@prisma/client';

// Shape of messages received from the book service
interface BookPublishedEvent {
  bookId: string;
  title: string;
  description: string;
  authors?: string;
  price?: number;
  url?: string;
  imageUrl?: string;
}

interface BookFeaturedEvent {
  bookId: string;
  title: string;
  description: string;
  authors?: string;
  price?: number;
  url?: string;
  imageUrl?: string;
  reason?: string; // e.g. "Editor's pick", "Bestseller"
}

const QUEUE_BOOK_PUBLISHED = 'social.book.published';
const QUEUE_BOOK_FEATURED = 'social.book.featured';

@Injectable()
export class RabbitMQConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQConsumerService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private readonly rabbitmqUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly socialService: SocialService,
  ) {
    this.rabbitmqUrl =
      this.configService.get<string>('RABBITMQ_URL') ||
      'amqp://guest:guest@localhost:5672';
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      this.logger.log(`Connecting to RabbitMQ at ${this.rabbitmqUrl}`);
      this.connection = await amqplib.connect(this.rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Ensure queues exist (durable so they survive broker restarts)
      await this.channel.assertQueue(QUEUE_BOOK_PUBLISHED, { durable: true });
      await this.channel.assertQueue(QUEUE_BOOK_FEATURED, { durable: true });

      // Process one message at a time per queue
      this.channel.prefetch(1);

      // Register consumers
      await this.consumeBookPublished();
      await this.consumeBookFeatured();

      this.logger.log('RabbitMQ consumers registered successfully');

      // Reconnect on unexpected close
      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed, reconnecting in 5s...');
        setTimeout(() => this.connect(), 5000);
      });

      this.connection.on('error', (err) => {
        this.logger.error('RabbitMQ connection error', err);
      });
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', error);
      this.logger.warn('Retrying RabbitMQ connection in 10s...');
      setTimeout(() => this.connect(), 10000);
    }
  }

  private async disconnect(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.logger.log('RabbitMQ connection closed gracefully');
    } catch (error) {
      this.logger.error('Error while closing RabbitMQ connection', error);
    }
  }

  /**
   * Consumes 'social.book.published' — posts to all social networks when
   * a new book is published.
   */
  private async consumeBookPublished(): Promise<void> {
    if (!this.channel) return;

    this.channel.consume(QUEUE_BOOK_PUBLISHED, async (msg) => {
      if (!msg) return;

      try {
        const event: BookPublishedEvent = JSON.parse(msg.content.toString());
        this.logger.log(
          `Received book.published event for bookId=${event.bookId} title="${event.title}"`,
        );

        const input: PublishBookInput = {
          bookId: event.bookId,
          title: event.title,
          description: event.description,
          authors: event.authors,
          price: event.price,
          url: event.url,
          imageUrl: event.imageUrl,
          networks: [SocialNetwork.TWITTER, SocialNetwork.FACEBOOK],
        };

        const results = await this.socialService.publishBook(input);
        this.logger.log(
          `Published ${results.length} social posts for book ${event.bookId}`,
        );

        this.channel!.ack(msg);
      } catch (error) {
        this.logger.error(
          `Error processing ${QUEUE_BOOK_PUBLISHED} message`,
          error,
        );
        // Nack without requeue to avoid poison-message loops;
        // the record is already marked FAILED in the DB.
        this.channel!.nack(msg, false, false);
      }
    });
  }

  /**
   * Consumes 'social.book.featured' — reposts a book that has been featured.
   * Adds a "featured" callout to the post content via the description field.
   */
  private async consumeBookFeatured(): Promise<void> {
    if (!this.channel) return;

    this.channel.consume(QUEUE_BOOK_FEATURED, async (msg) => {
      if (!msg) return;

      try {
        const event: BookFeaturedEvent = JSON.parse(msg.content.toString());
        this.logger.log(
          `Received book.featured event for bookId=${event.bookId} title="${event.title}"`,
        );

        const featuredReason = event.reason || '⭐ Livro em Destaque';
        const enrichedDescription =
          `${featuredReason}\n\n${event.description || ''}`.trim();

        const input: PublishBookInput = {
          bookId: event.bookId,
          title: event.title,
          description: enrichedDescription,
          authors: event.authors,
          price: event.price,
          url: event.url,
          imageUrl: event.imageUrl,
          networks: [SocialNetwork.TWITTER, SocialNetwork.FACEBOOK],
        };

        const results = await this.socialService.publishBook(input);
        this.logger.log(
          `Published ${results.length} featured social posts for book ${event.bookId}`,
        );

        this.channel!.ack(msg);
      } catch (error) {
        this.logger.error(
          `Error processing ${QUEUE_BOOK_FEATURED} message`,
          error,
        );
        this.channel!.nack(msg, false, false);
      }
    });
  }
}
