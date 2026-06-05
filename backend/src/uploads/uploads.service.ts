import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { randomUUID } from 'crypto';
import * as path from 'path';

const BUCKET = 'images';
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private bucketReady = false;

  constructor(private readonly supabase: SupabaseService) {}

  /** Ensure the storage bucket exists (called lazily on first upload) */
  private async ensureBucket() {
    if (this.bucketReady) return;

    const { data: buckets } = await this.supabase.admin.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET);

    if (!exists) {
      const { error } = await this.supabase.admin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_SIZE,
        allowedMimeTypes: ALLOWED_MIME,
      });
      if (error && !error.message?.includes('already exists')) {
        throw error;
      }
      this.logger.log(`Created storage bucket "${BUCKET}"`);
    }
    this.bucketReady = true;
  }

  /**
   * Upload an image to Supabase Storage.
   * @param file  The Multer file object
   * @param folder  Sub-folder: 'avatars' | 'banners'
   * @returns The public URL of the uploaded image
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: 'avatars' | 'banners',
  ): Promise<{ url: string; path: string }> {
    // Validate
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_SIZE) throw new BadRequestException('File too large (max 5 MB)');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, GIF`,
      );
    }

    await this.ensureBucket();

    // Generate unique filename (sanitize extension from original name)
    const ext = path.extname(file.originalname).replace(/^\./, '').toLowerCase() || 'jpg';
    if (!ALLOWED_EXT.has(ext)) {
      throw new BadRequestException(`Unsupported file extension: .${ext}`);
    }
    const filename = `${folder}/${randomUUID()}.${ext}`;

    const { data, error } = await this.supabase.admin.storage
      .from(BUCKET)
      .upload(filename, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase.admin.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    this.logger.log(`Uploaded ${file.originalname} → ${urlData.publicUrl}`);
    return { url: urlData.publicUrl, path: data.path };
  }

  /** Delete a previously uploaded image */
  async deleteImage(path: string): Promise<void> {
    await this.ensureBucket();
    const { error } = await this.supabase.admin.storage
      .from(BUCKET)
      .remove([path]);

    if (error) {
      this.logger.warn(`Delete failed for ${path}: ${error.message}`);
    }
  }
}
