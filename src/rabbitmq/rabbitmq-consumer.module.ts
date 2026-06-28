import { Module } from '@nestjs/common';
import { RabbitMQConsumerService } from './rabbitmq-consumer.service';
import { SocialModule } from '../social/social.module';

@Module({
  imports: [SocialModule],
  providers: [RabbitMQConsumerService],
})
export class RabbitMQConsumerModule {}
