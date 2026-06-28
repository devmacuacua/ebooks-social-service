import { IsString, IsNotEmpty, IsOptional, IsUrl, IsEnum, IsNumber, Min } from 'class-validator';
import { SocialNetwork } from '@prisma/client';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  bookId: string;

  @IsString()
  @IsNotEmpty()
  bookTitle: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  authors?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsUrl()
  @IsOptional()
  bookUrl?: string;

  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @IsEnum(SocialNetwork, { each: true })
  @IsOptional()
  networks?: SocialNetwork[];
}
