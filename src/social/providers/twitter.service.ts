import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';

@Injectable()
export class TwitterService {
  private readonly logger = new Logger(TwitterService.name);
  private client: TwitterApi;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('TWITTER_API_KEY');
    const apiSecret = this.configService.get<string>('TWITTER_API_SECRET');
    const accessToken = this.configService.get<string>('TWITTER_ACCESS_TOKEN');
    const accessSecret = this.configService.get<string>('TWITTER_ACCESS_SECRET');

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
      this.logger.warn('Twitter credentials not fully configured');
    }

    // OAuth 1.0a client (read-write)
    this.client = new TwitterApi({
      appKey: apiKey || '',
      appSecret: apiSecret || '',
      accessToken: accessToken || '',
      accessSecret: accessSecret || '',
    });
  }

  /**
   * Upload a media file from a URL to Twitter and return the media_id
   */
  private async uploadMediaFromUrl(imageUrl: string): Promise<string | null> {
    try {
      this.logger.log(`Downloading image for upload: ${imageUrl}`);
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);

      // Determine mime type from content-type header or URL
      const contentType: string =
        (response.headers['content-type'] as string) || 'image/jpeg';
      const mimeType = contentType.split(';')[0].trim();

      const mediaId = await this.client.v1.uploadMedia(buffer, { mimeType });
      this.logger.log(`Media uploaded to Twitter, mediaId: ${mediaId}`);
      return mediaId;
    } catch (error) {
      this.logger.error('Failed to upload media to Twitter', error);
      return null;
    }
  }

  /**
   * Post a tweet, optionally attaching an image from a URL.
   * Returns the tweet ID on success.
   */
  async postTweet(text: string, imageUrl?: string): Promise<string> {
    this.logger.log(`Posting tweet (length=${text.length})`);

    try {
      const tweetPayload: Parameters<typeof this.client.v2.tweet>[0] = { text };

      if (imageUrl) {
        const mediaId = await this.uploadMediaFromUrl(imageUrl);
        if (mediaId) {
          tweetPayload.media = { media_ids: [mediaId] };
        }
      }

      const response = await this.client.v2.tweet(tweetPayload);
      const tweetId = response.data.id;
      this.logger.log(`Tweet posted successfully: ${tweetId}`);
      return tweetId;
    } catch (error) {
      this.logger.error('Failed to post tweet', error);
      throw new Error(`Twitter post failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
