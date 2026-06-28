import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { SocialModule } from './social/social.module';
import { RabbitMQConsumerModule } from './rabbitmq/rabbitmq-consumer.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    // Config — available globally via ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting — protect the API endpoints
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute window (ms)
        limit: 30,  // max 30 requests per window
      },
    ]),

    PrismaModule,
    SocialModule,
    RabbitMQConsumerModule,
  ],
})
export class AppModule {}
