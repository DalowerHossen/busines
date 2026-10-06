'use client';

import { UploadCloud, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react';
import type {
  StorageFileCategory,
  StorageFileMetadata,
  StorageFileVisibility,
} from '@/types/storage';
import { Button, Progress } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface FileUploadRequest {
  readonly companyId: string;
  readonly category: StorageFileCategory;
  readonly visibility: StorageFileVisibility;
  readonly file: File;
}

export interface FileUploaderProps {
  readonly companyId: string;
  readonly category: StorageFileCategory;
  readonly visibility?: StorageFileVisibility;
  readonly onUpload: (request: FileUploadRequest) => Promise<StorageFileMetadata>;
  readonly onUploaded?: (metadata: StorageFileMetadata) => void;
  readonly accept?: string;
  readonly maxSizeBytes?: number;
  readonly multiple?: boolean;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly description?: string;
  readonly className?: string;
}

export function FileUploader({
  companyId,
  category,
  visibility = 'private',
  onUpload,
  onUploaded,
  accept,
  maxSizeBytes = 25_000_000,
  multiple = false,
  disabled = false,
  label = 'Upload a file',
  description = 'Drag and drop a file here, or browse from your device.',
  className,
}: FileUploaderProps): ReactNode {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<readonly StorageFileMetadata[]>([]);

  const processFiles = async (files: readonly File[]) => {
    setError(null);
    const selectedFiles = multiple ? files : files.slice(0, 1);
    for (const file of selectedFiles) {
      if (file.size > maxSizeBytes) {
        setError(
          `${file.name} is too large. The maximum allowed size is ${formatBytes(maxSizeBytes)}.`
        );
        continue;
      }
      if (accept && !matchesAccept(file, accept)) {
        setError(`${file.name} is not an accepted file type.`);
        continue;
      }
      try {
        setProgress(10);
        const metadata = await onUpload({ companyId, category, visibility, file });
        setProgress(100);
        setUploadedFiles((current) => (multiple ? [...current, metadata] : [metadata]));
        onUploaded?.(metadata);
      } catch (uploadError) {
        setProgress(null);
        setError(
          uploadError instanceof Error ? uploadError.message : 'The file could not be uploaded.'
        );
      }
    }
    setProgress(null);
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    void processFiles(files);
    event.target.value = '';
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!disabled) void processFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        className={cn(
          'rounded-xl border-2 border-dashed border-border bg-surface-muted/50 p-6 text-center transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isDragging && 'border-brand-500 bg-brand-50 dark:bg-brand-950',
          disabled && 'cursor-not-allowed opacity-60'
        )}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={onInputChange}
        />
        <UploadCloud className="mx-auto h-8 w-8 text-brand-600" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-4"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Browse files
        </Button>
      </div>
      {progress !== null ? <Progress value={progress} label="Uploading" /> : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {uploadedFiles.length > 0 ? (
        <ul className="space-y-2" aria-label="Uploaded files">
          {uploadedFiles.map((file) => (
            <li
              key={file.providerFileId}
              className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-foreground">{file.fileName}</span>
              <button
                type="button"
                aria-label={`Remove ${file.fileName}`}
                className="ml-3 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  setUploadedFiles((current) =>
                    current.filter((item) => item.providerFileId !== file.providerFileId)
                  )
                }
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function matchesAccept(file: File, accept: string): boolean {
  return accept.split(',').some((entry) => {
    const pattern = entry.trim().toLowerCase();
    return (
      pattern === file.type.toLowerCase() ||
      (pattern.endsWith('/*') && file.type.toLowerCase().startsWith(pattern.slice(0, -1))) ||
      (pattern.startsWith('.') && file.name.toLowerCase().endsWith(pattern))
    );
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1_024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}
