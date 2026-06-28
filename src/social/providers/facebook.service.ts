import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

interface FacebookFeedResponse {
  id: string;
}

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);
  private readonly pageId: string;
  private readonly pageToken: string;

  constructor(private readonly configService: ConfigService) {
    this.pageId = this.configService.get<string>('FACEBOOK_PAGE_ID') || '';
    this.pageToken = this.configService.get<string>('FACEBOOK_PAGE_TOKEN') || '';

    if (!this.pageId || !this.pageToken) {
      this.logger.warn('Facebook Page credentials not fully configured');
    }
  }

  /**
   * Post a photo with a caption to the Facebook Page.
   * Returns the post ID.
   */
  private async postPhoto(caption: string, imageUrl: string): Promise<string> {
    this.logger.log(`Posting photo to Facebook page ${this.pageId}`);

    const url = `${GRAPH_API_BASE}/${this.pageId}/photos`;
    const response = await axios.post<FacebookFeedResponse>(url, null, {
      params: {
        url: imageUrl,
        caption,
        access_token: this.pageToken,
      },
    });

    const postId: string = response.data.id;
    this.logger.log(`Facebook photo posted: ${postId}`);
    return postId;
  }

  /**
   * Post a text/link message to the Facebook Page feed.
   * Returns the post ID.
   */
  private async postFeed(message: string, link?: string): Promise<string> {
    this.logger.log(`Posting to Facebook page feed ${this.pageId}`);

    const url = `${GRAPH_API_BASE}/${this.pageId}/feed`;
    const params: Record<string, string> = {
      message,
      access_token: this.pageToken,
    };
    if (link) params.link = link;

    const response = await axios.post<FacebookFeedResponse>(url, null, { params });
    const postId: string = response.data.id;
    this.logger.log(`Facebook feed post created: ${postId}`);
    return postId;
  }

  /**
   * Post to a Facebook Page — uses photo endpoint when imageUrl is provided,
   * otherwise falls back to the feed endpoint.
   * Returns the Facebook post ID.
   */
  async postToPage(message: string, imageUrl?: string, link?: string): Promise<string> {
    if (!this.pageId || !this.pageToken) {
      throw new Error('Facebook Page credentials are not configured');
    }

    try {
      if (imageUrl) {
        return await this.postPhoto(message, imageUrl);
      }
      return await this.postFeed(message, link);
    } catch (error) {
      const detail =
        axios.isAxiosError(error)
          ? JSON.stringify(error.response?.data)
          : String(error);
      this.logger.error(`Facebook post failed: ${detail}`);
      throw new Error(`Facebook post failed: ${detail}`);
    }
  }
}
