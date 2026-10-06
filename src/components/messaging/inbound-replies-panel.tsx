// src/components/messaging/inbound-replies-panel.tsx
// What came back. A reply is how a client asks to be left alone and how a
// conversation carries on, so neither can sit unread.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { resolveInboundReply } from '@/features/messaging/actions/resolve-reply';
import type { InboundReplyRecord } from '@/features/messaging/types';
import { formatDateTime } from '@/lib/dates';
import { humanise } from '@/lib/format';

export interface InboundRepliesPanelProps {
  /** The replies waiting for somebody. */
  replies: readonly InboundReplyRecord[];
  /** False when the viewer may look but not close a reply. */
  canManage: boolean;
}

/**
 * Renders the replies panel.
 *
 * @param props The replies and what the viewer may do.
 * @returns The rendered panel.
 */
export function InboundRepliesPanel({ replies, canManage }: InboundRepliesPanelProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Closes one reply.
   *
   * @param reply Reply being closed.
   * @returns Nothing.
   */
  async function onResolve(reply: InboundReplyRecord): Promise<void> {
    setBusyId(reply.inboundId);
    setFailure(null);

    const result = await resolveInboundReply({
      inboundId: reply.inboundId,
      note: notes[reply.inboundId] ?? undefined,
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('That reply has been closed.');
    router.refresh();
  }

  if (replies.length === 0) {
    return (
      <EmptyState
        title="Nothing is waiting"
        description="Replies to your text and chat messages appear here, and a request to stop is acted on the second it arrives."
      />
    );
  }

  return (
    <div className="space-y-4">
      {failure ? (
        <Alert tone="danger" title="That did not work">
          {failure}
        </Alert>
      ) : null}

      <ul className="space-y-3">
        {replies.map((reply) => (
          <li key={reply.inboundId}>
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{reply.clientName ?? reply.fromAddress}</p>
                  <Badge tone="neutral">{humanise(reply.channel)}</Badge>
                  {reply.isOptOut ? <Badge tone="danger">Asked us to stop</Badge> : null}
                  <span className="text-sm text-muted-foreground">
                    {formatDateTime(reply.receivedAt)}
                  </span>
                </div>

                <p className="rounded-md bg-surface-muted p-3 text-sm">
                  {reply.bodyText ?? 'The reply arrived with nothing in it.'}
                </p>

                {reply.isOptOut ? (
                  <p className="text-sm text-muted-foreground">
                    This address has already been taken off the list for that channel. Nothing else
                    will be sent to it.
                  </p>
                ) : null}

                {canManage ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <Input
                      aria-label={`What was done about the reply from ${reply.fromAddress}`}
                      placeholder="What was done about it"
                      value={notes[reply.inboundId] ?? ''}
                      onChange={(event) => {
                        setNotes((state) => ({
                          ...state,
                          [reply.inboundId]: event.target.value,
                        }));
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      isLoading={busyId === reply.inboundId}
                      loadingLabel="Closing"
                      onClick={() => {
                        void onResolve(reply);
                      }}
                    >
                      Mark as dealt with
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
