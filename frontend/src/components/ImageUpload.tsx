'use client';

import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { uploadsApi } from '@/lib/api';
import { parseError } from '@/lib/error-parser';

interface ImageUploadProps {
  /** Called with the public URL after a successful upload */
  onUpload: (url: string) => void;
  /** Currently set image URL (for preview) */
  currentUrl?: string;
  /** 'avatar' or 'banner' — determines the upload endpoint */
  folder: 'avatar' | 'banner';
  /** Label shown above the upload area */
  label?: string;
  /** Extra hint text */
  hint?: string;
  /** Shape of the preview — circle for avatars, rectangle for banners */
  shape?: 'circle' | 'rect';
  /** Disable the upload */
  disabled?: boolean;
  /** Additional CSS class for the container */
  className?: string;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export function ImageUpload({
  onUpload,
  currentUrl,
  folder,
  label,
  hint,
  shape = folder === 'avatar' ? 'circle' : 'rect',
  disabled,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const displayUrl = previewUrl || currentUrl;

  const upload = useCallback(
    async (file: File) => {
      // Client-side validation
      if (file.size > MAX_SIZE) {
        setError('File too large — max 5 MB');
        return;
      }
      if (!ACCEPT.split(',').includes(file.type)) {
        setError('Unsupported format — use JPEG, PNG, WebP, or GIF');
        return;
      }

      setError('');
      setUploading(true);

      // Show local preview immediately
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);

      try {
        const result =
          folder === 'avatar'
            ? await uploadsApi.uploadAvatar(file)
            : await uploadsApi.uploadBanner(file);

        setPreviewUrl(result.url);
        onUpload(result.url);
      } catch (err) {
        const parsed = parseError(err);
        setError(parsed.message || 'Upload failed');
        setPreviewUrl(null);
      } finally {
        setUploading(false);
      }
    },
    [folder, onUpload],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="block text-sm font-medium text-muted">{label}</label>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${folder} image`}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative flex cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed transition-all duration-200',
          shape === 'circle'
            ? 'h-28 w-28 rounded-full'
            : 'h-40 w-full rounded-xl',
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50',
          disabled && 'opacity-50 cursor-not-allowed',
          uploading && 'pointer-events-none',
        )}
      >
        {/* Preview image */}
        {displayUrl && (
          <img
            src={displayUrl}
            alt={`${folder} preview`}
            className={cn(
              'absolute inset-0 h-full w-full object-cover',
              shape === 'circle' ? 'rounded-full' : 'rounded-xl',
            )}
            onError={() => setPreviewUrl(null)}
          />
        )}

        {/* Overlay */}
        <div
          className={cn(
            'relative z-10 flex flex-col items-center gap-1.5 rounded-lg px-4 py-3 text-center transition-opacity',
            displayUrl ? 'bg-background/80 backdrop-blur-sm' : '',
            displayUrl && !uploading && !dragOver ? 'opacity-0 hover:opacity-100' : 'opacity-100',
          )}
        >
          {uploading ? (
            <>
              <svg className="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-muted">Uploading...</span>
            </>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-xs text-muted">
                {displayUrl ? 'Change image' : 'Click or drag to upload'}
              </span>
              <span className="text-[10px] text-muted/60">
                JPEG, PNG, WebP, GIF — max 5 MB
              </span>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || uploading}
          aria-hidden
        />
      </div>

      {error && <p className="text-xs text-error">{error}</p>}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
