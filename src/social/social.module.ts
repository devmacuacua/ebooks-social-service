import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { PostComposerService } from './post-composer.service';
import { TwitterService } from './providers/twitter.service';
import { FacebookService } from './providers/facebook.service';

@Module({
  controllers: [SocialController],
  providers: [
    SocialService,
    PostComposerService,
    TwitterService,
    FacebookService,
  ],
  exports: [SocialService],
})
export class SocialModule {}
