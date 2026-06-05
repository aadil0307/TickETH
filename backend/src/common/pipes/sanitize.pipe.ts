import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
} from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

/**
 * Global pipe that sanitizes all string inputs using sanitize-html.
 * Strips all HTML tags and dangerous attributes.
 * Applied globally alongside ValidationPipe.
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  private static readonly sanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'recursiveEscape',
  };

  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type === 'custom') return value;
    return this.sanitize(value);
  }

  private sanitize(value: any): any {
    if (value === null || value === undefined) return value;

    if (typeof value === 'string') {
      return sanitizeHtml(value, SanitizePipe.sanitizeOptions).replace(/\0/g, '').trim();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (typeof value === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = this.sanitize(val);
      }
      return sanitized;
    }

    return value;
  }
}
