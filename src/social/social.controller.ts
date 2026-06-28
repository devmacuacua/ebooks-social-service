import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SocialService, PublishBookInput } from './social.service';
import { CreatePostDto } from './dto/create-post.dto';
import { SocialPost } from '@prisma/client';

@Controller('social')
export class SocialController {
  private readonly logger = new Logger(SocialController.name);

  constructor(private readonly socialService: SocialService) {}

  /**
   * POST /social/post
   * Manually trigger a social post for a book (admin endpoint).
   */
  @Post('post')
  @HttpCode(HttpStatus.CREATED)
  async createPost(@Body() dto: CreatePostDto): Promise<SocialPost[]> {
    this.logger.log(`Manual post trigger for book: ${dto.bookId}`);

    const input: PublishBookInput = {
      bookId: dto.bookId,
      title: dto.bookTitle,
      description: dto.description,
      authors: dto.authors,
      price: dto.price,
      url: dto.bookUrl,
      imageUrl: dto.imageUrl,
      networks: dto.networks,
    };

    return this.socialService.publishBook(input);
  }

  /**
   * GET /social/posts
   * List all social posts with their statuses.
   */
  @Get('posts')
  async findAll(): Promise<SocialPost[]> {
    return this.socialService.findAll();
  }

  /**
   * GET /social/posts/book/:bookId
   * Get all social posts for a specific book.
   */
  @Get('posts/book/:bookId')
  async findByBook(@Param('bookId') bookId: string): Promise<SocialPost[]> {
    return this.socialService.findByBookId(bookId);
  }

  /**
   * GET /social/posts/:id
   * Get a single social post by ID.
   */
  @Get('posts/:id')
  async findOne(@Param('id') id: string): Promise<SocialPost> {
    return this.socialService.findOne(id);
  }

  /**
   * POST /social/posts/:id/retry
   * Retry a failed social post.
   */
  @Post('posts/:id/retry')
  @HttpCode(HttpStatus.OK)
  async retry(@Param('id') id: string): Promise<SocialPost> {
    this.logger.log(`Retrying failed post: ${id}`);
    return this.socialService.retryPost(id);
  }
}
