// src/components/files/file-library.tsx
// Everything the business has stored, with the few things you can do to it.
//
// Renaming is inline because it is the common case, and removal is refused
// for anything that forms part of a legal record, which the server decides
// rather than this screen.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { deleteStoredFile } from '@/features/files/actions/delete-file';
import { renameStoredFile } from '@/features/files/actions/rename-file';
import type { StoredFile } from '@/features/files/types';
import { formatDate } from '@/lib/dates';
import { formatFileSize, formatNumber, humanise } from '@/lib/format';

export interface FileLibraryProps {
  /** The files to show, newest first. */
  files: readonly StoredFile[];
  /** True when the viewer may rename or remove a file. */
  canManage: boolean;
}

/** Kinds of file that are kept as a record and cannot be removed. */
const PROTECTED_PURPOSES = ['invoice_pdf', 'kyc_document', 'contract'];

/**
 * Renders the file library.
 *
 * @param props The files and what the viewer may do.
 * @returns The rendered library.
 */
export function FileLibrary({ files, canManage }: FileLibraryProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  /**
   * Saves a new name for one file.
   *
   * @param fileId File being renamed.
   * @returns Nothing.
   */
  async function onRename(fileId: string): Promise<void> {
    setBusyId(fileId);
    const result = await renameStoredFile({ fileId, fileName: draftName });
    setBusyId(null);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    setEditingId(null);
    notify.success('That file has been renamed.');
    router.refresh();
  }

  /**
   * Removes one file from the library.
   *
   * @param fileId File being removed.
   * @returns Nothing.
   */
  async function onDelete(fileId: string): Promise<void> {
    setBusyId(fileId);
    const result = await deleteStoredFile({ fileId, reason: 'Removed from the file library' });
    setBusyId(null);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('That file has been removed.');
    router.refresh();
  }

  if (files.length === 0) {
    return (
      <EmptyState
        title="Nothing stored yet"
        description="Upload a receipt, a logo or anything else you want kept with this business. Files attached to an invoice or an expense appear here too."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead>What it is</TableHead>
          <TableHead isNumeric>Size</TableHead>
          <TableHead isNumeric>Opened</TableHead>
          <TableHead>Added</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file) => (
          <TableRow key={file.fileId}>
            <TableCell>
              {editingId === file.fileId ? (
                <Input
                  aria-label="File name"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                />
              ) : (
                <div className="space-y-1">
                  <a
                    className="text-brand-700 underline underline-offset-2"
                    href={`/api/files/${file.fileId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {file.fileName}
                  </a>
                  {file.version > 1 ? (
                    <p className="text-sm text-muted-foreground">
                      {`Version ${formatNumber(file.version)}`}
                    </p>
                  ) : null}
                </div>
              )}
            </TableCell>
            <TableCell>
              <Badge tone="neutral">{humanise(file.filePurpose)}</Badge>
            </TableCell>
            <TableCell isNumeric>{formatFileSize(file.byteSize)}</TableCell>
            <TableCell isNumeric>{formatNumber(file.accessCount)}</TableCell>
            <TableCell>{formatDate(file.createdAt)}</TableCell>
            <TableCell>
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  {editingId === file.fileId ? (
                    <>
                      <Button
                        size="sm"
                        isLoading={busyId === file.fileId}
                        loadingLabel="Saving"
                        onClick={() => void onRename(file.fileId)}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingId(file.fileId);
                        setDraftName(file.fileName);
                      }}
                    >
                      Rename
                    </Button>
                  )}

                  {PROTECTED_PURPOSES.includes(file.filePurpose) ? (
                    <span className="text-sm text-muted-foreground">Kept as a record</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busyId === file.fileId}
                      onClick={() => void onDelete(file.fileId)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">View only</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
