import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TwitterService } from './providers/twitter.service';
import { FacebookService } from './providers/facebook.service';
import { PostComposerService, BookPostData } from './post-composer.service';
import { SocialNetwork, PostStatus, SocialPost } from '@prisma/client';

export interface PublishBookInput extends BookPostData {
  bookId: string;
  imageUrl?: string;
  networks?: SocialNetwork[];
}

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twitterService: TwitterService,
    private readonly facebookService: FacebookService,
    private readonly postComposer: PostComposerService,
  ) {}

  /**
   * Publish a book to all requested social networks.
   * Creates a SocialPost record per network and updates status after posting.
   */
  async publishBook(input: PublishBookInput): Promise<SocialPost[]> {
    const networks = input.networks ?? [SocialNetwork.TWITTER, SocialNetwork.FACEBOOK];
    const composed = this.postComposer.composeBookPost({
      title: input.title,
      description: input.description,
      authors: input.authors,
      price: input.price,
      url: input.url,
    });

    const results: SocialPost[] = [];

    for (const network of networks) {
      const content =
        network === SocialNetwork.TWITTER ? composed.twitter : composed.facebook;

      // Create a PENDING record first
      const record = await this.prisma.socialPost.create({
        data: {
          bookId: input.bookId,
          bookTitle: input.title,
          network,
          status: PostStatus.PENDING,
          content,
          imageUrl: input.imageUrl ?? null,
        },
      });

      // Attempt to post and update the record
      const updated = await this.publishToNetwork(record, input.imageUrl, input.url);
      results.push(updated);
    }

    return results;
  }

  /**
   * Attempt to post a SocialPost record to its target network.
   * Updates the record to PUBLISHED or FAILED.
   */
  private async publishToNetwork(
    post: SocialPost,
    imageUrl?: string,
    bookUrl?: string,
  ): Promise<SocialPost> {
    try {
      let externalId: string;

      switch (post.network) {
        case SocialNetwork.TWITTER:
          externalId = await this.twitterService.postTweet(post.content, imageUrl);
          break;

        case SocialNetwork.FACEBOOK:
          externalId = await this.facebookService.postToPage(
            post.content,
            imageUrl,
            bookUrl,
          );
          break;

        default:
          throw new Error(`Network ${post.network} is not yet implemented`);
      }

      return await this.prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: PostStatus.PUBLISHED,
          externalId,
          publishedAt: new Date(),
          error: null,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to publish post ${post.id} to ${post.network}: ${errorMsg}`,
      );

      return await this.prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: PostStatus.FAILED,
          error: errorMsg,
        },
      });
    }
  }

  /**
   * List all social posts, most recent first.
   */
  async findAll(): Promise<SocialPost[]> {
    return this.prisma.socialPost.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * List social posts for a specific book.
   */
  async findByBookId(bookId: string): Promise<SocialPost[]> {
    return this.prisma.socialPost.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single social post by ID.
   */
  async findOne(id: string): Promise<SocialPost> {
    const post = await this.prisma.socialPost.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException(`SocialPost ${id} not found`);
    }
    return post;
  }

  /**
   * Retry a failed post.
   */
  async retryPost(id: string): Promise<SocialPost> {
    const post = await this.findOne(id);
    if (post.status !== PostStatus.FAILED) {
      throw new Error(`Post ${id} is not in FAILED state (current: ${post.status})`);
    }
    return this.publishToNetwork(post, post.imageUrl ?? undefined);
  }
}
