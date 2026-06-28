import { Injectable } from '@nestjs/common';

export interface BookPostData {
  title: string;
  description: string;
  authors?: string;
  price?: number;
  url?: string;
}

export interface ComposedPosts {
  twitter: string;
  facebook: string;
}

@Injectable()
export class PostComposerService {
  private readonly HASHTAGS = '#EBooks #Livros #Mozambique #Leitura #Books';
  private readonly TWITTER_MAX = 280;

  /**
   * Compose platform-specific posts for a book.
   */
  composeBookPost(book: BookPostData): ComposedPosts {
    return {
      twitter: this.composeTwitterPost(book),
      facebook: this.composeFacebookPost(book),
    };
  }

  /**
   * Twitter post — max 280 chars.
   * Format: title + short description snippet + hashtags + URL
   */
  private composeTwitterPost(book: BookPostData): string {
    const hashtags = this.HASHTAGS;
    const url = book.url ? ` ${book.url}` : '';
    const baseEnd = `\n\n${hashtags}${url}`;

    // Budget: TWITTER_MAX minus the tail
    const budget = this.TWITTER_MAX - baseEnd.length;

    let header = `📚 ${book.title}`;
    if (book.authors) header += ` — ${book.authors}`;

    let body = book.description || '';
    // Truncate description to fit budget after header + newline
    const headerLine = header + '\n';
    const remaining = budget - headerLine.length;
    if (body.length > remaining) {
      body = body.substring(0, Math.max(0, remaining - 1)) + '…';
    }

    const tweet = `${headerLine}${body}${baseEnd}`;
    // Safety clamp
    return tweet.length <= this.TWITTER_MAX
      ? tweet
      : tweet.substring(0, this.TWITTER_MAX - 1) + '…';
  }

  /**
   * Facebook post — longer, with full description, price, and buy link.
   */
  private composeFacebookPost(book: BookPostData): string {
    const lines: string[] = [];

    lines.push(`📚 ${book.title}`);

    if (book.authors) {
      lines.push(`✍️ Autores: ${book.authors}`);
    }

    lines.push('');
    lines.push(book.description || '');

    if (book.price !== undefined && book.price !== null) {
      const formattedPrice =
        book.price === 0
          ? 'Gratuito'
          : `MT ${book.price.toFixed(2)}`;
      lines.push('');
      lines.push(`💰 Preço: ${formattedPrice}`);
    }

    if (book.url) {
      lines.push('');
      lines.push(`🔗 Comprar agora: ${book.url}`);
    }

    lines.push('');
    lines.push(this.HASHTAGS);

    return lines.join('\n');
  }
}
