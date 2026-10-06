'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import type {
  StorageFileCategory,
  StorageFileMetadata,
  StorageFileVisibility,
} from '@/types/storage';
import { FileUploader, type FileUploadRequest } from './file-uploader';

export interface ImageUploaderProps {
  readonly companyId: string;
  readonly onUpload: (request: FileUploadRequest) => Promise<StorageFileMetadata>;
  readonly onUploaded?: (metadata: StorageFileMetadata) => void;
  readonly currentUrl?: string | null;
  readonly category?: StorageFileCategory;
  readonly visibility?: StorageFileVisibility;
  readonly label?: string;
  readonly maxSizeBytes?: number;
  readonly className?: string;
}

export function ImageUploader({
  companyId,
  onUpload,
  onUploaded,
  currentUrl,
  category = 'company_branding_asset',
  visibility = 'public',
  label = 'Upload an image',
  maxSizeBytes = 5_000_000,
  className,
}: ImageUploaderProps): ReactNode {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);
  useEffect(
    () => () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );
  return (
    <div className={className}>
      {previewUrl ? (
        <div className="mb-4 overflow-hidden rounded-lg border border-border bg-surface-muted">
          <Image
            src={previewUrl}
            alt="Current uploaded image"
            width={800}
            height={192}
            unoptimized
            className="max-h-48 w-full object-contain"
          />
        </div>
      ) : null}
      <FileUploader
        companyId={companyId}
        category={category}
        visibility={visibility}
        accept="image/jpeg,image/png,image/webp,image/gif"
        maxSizeBytes={maxSizeBytes}
        label={label}
        description="Use a clear JPG, PNG, WEBP, or GIF image."
        onUpload={async (request) => {
          const metadata = await onUpload(request);
          setPreviewUrl(metadata.url);
          onUploaded?.(metadata);
          return metadata;
        }}
      />
    </div>
  );
}
