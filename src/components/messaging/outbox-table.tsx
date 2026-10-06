// src/components/messaging/outbox-table.tsx
// Everything this business has sent to its clients, newest first, with what
// happened to each message.

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { OutboxMessage } from '@/features/messaging/types';
import { formatDateTime } from '@/lib/dates';
import { humanise } from '@/lib/format';
import type { MessageStatus } from '@/types/enums';

export interface OutboxTableProps {
  /** The messages to list. */
  messages: readonly OutboxMessage[];
}

const TONES: Readonly<Record<MessageStatus, 'neutral' | 'success' | 'warning' | 'danger'>> = {
  queued: 'neutral',
  scheduled: 'neutral',
  sending: 'neutral',
  sent: 'success',
  delivered: 'success',
  read: 'success',
  failed: 'danger',
  bounced: 'danger',
  complained: 'danger',
  suppressed: 'warning',
};

/**
 * Renders the outbox.
 *
 * @param props The messages to list.
 * @returns The rendered table.
 */
export function OutboxTable({ messages }: OutboxTableProps) {
  if (messages.length === 0) {
    return (
      <EmptyState
        title="Nothing has been sent yet"
        description="When you send an invoice or a reminder, every message appears here with proof of what the client was told."
      />
    );
  }

  return (
    <Table caption="Messages sent to clients">
      <TableHeader>
        <TableRow>
          <TableHead>Recipient</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Sent</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {messages.map((message) => (
          <TableRow key={message.id}>
            <TableCell>
              <span className="block font-medium text-foreground">
                {message.toName ?? message.toEmail}
              </span>
              <span className="block text-sm text-muted-foreground">{message.toEmail}</span>
            </TableCell>
            <TableCell>
              <span className="block text-foreground">{message.subject}</span>
              {message.failureReason ? (
                <span className="block text-sm text-destructive">{message.failureReason}</span>
              ) : null}
            </TableCell>
            <TableCell>
              <Badge tone={TONES[message.status]}>{humanise(message.status)}</Badge>
              {message.openCount > 0 ? (
                <span className="mt-1 block text-sm text-muted-foreground">
                  Opened {message.openCount} time{message.openCount === 1 ? '' : 's'}
                </span>
              ) : null}
            </TableCell>
            <TableCell>{formatDateTime(message.createdAt)}</TableCell>
            <TableCell>{message.sentAt ? formatDateTime(message.sentAt) : 'Not yet'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
