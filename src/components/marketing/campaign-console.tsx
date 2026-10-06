// src/components/marketing/campaign-console.tsx
// Writing to clients, and being honest about how it went.
//
// Two numbers matter on this screen and both are shown without flattery:
// how many people actually agreed to hear from this business, and how many
// of them unsubscribed after the last send. A marketing tool that hides the
// second number encourages the behaviour that destroys the first.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import {
  pauseMarketingCampaign,
  saveCampaignStep,
  saveMarketingCampaign,
  saveMarketingSegment,
  scheduleMarketingCampaign,
} from '@/features/campaigns/actions/manage-campaigns';
import type {
  MarketingCampaign,
  MarketingReach,
  MarketingSegment,
} from '@/features/campaigns/types';
import { formatDateTime } from '@/lib/dates';
import { formatNumber, humanise } from '@/lib/format';

export interface CampaignConsoleProps {
  /** Campaigns written so far. */
  campaigns: readonly MarketingCampaign[];
  /** Audiences described so far. */
  segments: readonly MarketingSegment[];
  /** How many people may lawfully be written to. */
  reach: MarketingReach;
  /** True when the viewer may schedule and stop a send. */
  isOwner: boolean;
}

const STATUS_TONES: Readonly<Record<string, 'success' | 'warning' | 'danger' | 'neutral'>> = {
  sent: 'success',
  sending: 'warning',
  scheduled: 'success',
  paused: 'warning',
  cancelled: 'neutral',
  draft: 'neutral',
};

/**
 * Renders the campaign console.
 *
 * @param props The campaigns, audiences, reach and whether the viewer may send.
 * @returns The rendered console.
 */
export function CampaignConsole({ campaigns, segments, reach, isOwner }: CampaignConsoleProps) {
  const router = useRouter();

  const [segmentName, setSegmentName] = useState('');
  const [isSavingSegment, setIsSavingSegment] = useState(false);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyMarkdown, setBodyMarkdown] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState('');

  const [followUpFor, setFollowUpFor] = useState<string | null>(null);
  const [followUpSubject, setFollowUpSubject] = useState('');
  const [followUpBody, setFollowUpBody] = useState('');
  const [followUpDelay, setFollowUpDelay] = useState('168');

  /**
   * Describes a new audience.
   *
   * @returns Nothing.
   */
  async function onSaveSegment(): Promise<void> {
    setIsSavingSegment(true);
    const result = await saveMarketingSegment({ name: segmentName });
    setIsSavingSegment(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Saved. The audience is counted on a schedule rather than on every page.');
    setSegmentName('');
    router.refresh();
  }

  /**
   * Writes a new campaign as a draft.
   *
   * @returns Nothing.
   */
  async function onWrite(): Promise<void> {
    setIsWriting(true);
    setFieldErrors({});

    const result = await saveMarketingCampaign({
      name,
      subject,
      bodyMarkdown,
      campaignType: 'broadcast',
      segmentId: segmentId === '' ? undefined : segmentId,
    });

    setIsWriting(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors ?? {});
      notify.error(result.error);

      return;
    }

    notify.success('Saved as a draft. Nothing is sent until it is given a time.');
    setName('');
    setSubject('');
    setBodyMarkdown('');
    router.refresh();
  }

  /**
   * Gives one campaign a time.
   *
   * @param campaignId Campaign being scheduled.
   * @returns Nothing.
   */
  async function onSchedule(campaignId: string): Promise<void> {
    const result = await scheduleMarketingCampaign({ campaignId, scheduledFor });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(`Scheduled. It will reach ${formatNumber(result.data.audienceSize)} people.`);
    setSchedulingId(null);
    router.refresh();
  }

  /**
   * Stops one campaign.
   *
   * @param campaignId Campaign being stopped.
   * @returns Nothing.
   */
  async function onPause(campaignId: string): Promise<void> {
    const result = await pauseMarketingCampaign({ campaignId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Stopped. Nobody else will receive it.');
    router.refresh();
  }

  /**
   * Adds a follow up that goes out some days after the first message.
   *
   * Most replies to a campaign come from the second message rather than
   * the first, so writing one has to be as easy as writing the first.
   *
   * @param campaignId Campaign the follow up belongs to.
   * @param stepNumber Where it sits in the sequence.
   * @returns Nothing.
   */
  async function onAddFollowUp(campaignId: string, stepNumber: number): Promise<void> {
    const result = await saveCampaignStep({
      campaignId,
      stepNumber,
      name: `Follow up ${formatNumber(stepNumber)}`,
      subject: followUpSubject,
      bodyMarkdown: followUpBody,
      delayHours: followUpDelay,
    });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Added. It goes out after the delay you set, to the same audience.');
    setFollowUpFor(null);
    setFollowUpSubject('');
    setFollowUpBody('');
    router.refresh();
  }

  const segmentOptions = [
    { value: '', label: 'Everybody who agreed to hear from you' },
    ...segments.map((segment) => ({ value: segment.segmentId, label: segment.name })),
  ];

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">People you may write to</dt>
            <dd className="tabular text-2xl font-semibold">{formatNumber(reach.subscribed)}</dd>
            <p className="text-sm text-muted-foreground">Everybody who agreed, and nobody else.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">Asked you to stop</dt>
            <dd className="tabular text-2xl font-semibold">{formatNumber(reach.unsubscribed)}</dd>
            <p className="text-sm text-muted-foreground">
              They are never written to again, whatever the audience says.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">Clients on your books</dt>
            <dd className="tabular text-2xl font-semibold">{formatNumber(reach.clientCount)}</dd>
            <p className="text-sm text-muted-foreground">
              A client is not a subscriber until they say so.
            </p>
          </CardContent>
        </Card>
      </dl>

      <Card>
        <CardHeader>
          <CardTitle>Write a campaign</CardTitle>
          <CardDescription>
            It is saved as a draft. Giving it a time is a separate decision, and only the owner can
            make it.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="campaign-name"
              label="Name"
              hint="Only you see this."
              errors={fieldErrors['name']}
              isRequired
            >
              <Input
                id="campaign-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>

            <FormField
              id="campaign-subject"
              label="Subject line"
              hint="The only part most people will read."
              errors={fieldErrors['subject']}
              isRequired
            >
              <Input
                id="campaign-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </FormField>

            <FormField id="campaign-segment" label="Who gets it">
              <Select
                id="campaign-segment"
                value={segmentId}
                options={segmentOptions}
                onChange={(event) => setSegmentId(event.target.value)}
              />
            </FormField>
          </div>

          <FormField
            id="campaign-body"
            label="What it says"
            hint="Plain words. Anybody can unsubscribe from the bottom of it."
            errors={fieldErrors['bodyMarkdown']}
            isRequired
          >
            <Textarea
              id="campaign-body"
              rows={6}
              value={bodyMarkdown}
              onChange={(event) => setBodyMarkdown(event.target.value)}
            />
          </FormField>

          <Button isLoading={isWriting} loadingLabel="Saving" onClick={() => void onWrite()}>
            Save as a draft
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your campaigns</CardTitle>
          <CardDescription>
            What each one reached, and how many people left because of it.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {campaigns.length === 0 ? (
            <EmptyState
              title="Nothing has been written yet"
              description="Write a draft above. Nothing reaches a client until you give it a time."
            />
          ) : (
            <ul className="space-y-3">
              {campaigns.map((campaign) => (
                <li
                  key={campaign.campaignId}
                  className="space-y-3 rounded-lg border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{campaign.name}</p>
                        <Badge tone={STATUS_TONES[campaign.status] ?? 'neutral'}>
                          {humanise(campaign.status)}
                        </Badge>
                        {campaign.stepCount > 0 ? (
                          <Badge tone="info">{`${formatNumber(campaign.stepCount)} follow ups`}</Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {campaign.subject ?? 'No subject line yet'}
                      </p>
                      <p className="tabular text-sm text-muted-foreground">
                        {`${formatNumber(campaign.recipientCount)} recipients, ${formatNumber(
                          campaign.deliveredCount
                        )} delivered, ${campaign.openRate}% opened, ${campaign.clickRate}% clicked, ${formatNumber(
                          campaign.unsubscribedCount
                        )} unsubscribed`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {campaign.scheduledFor === null
                          ? `To ${campaign.segmentName ?? 'everybody who agreed'}. No time set.`
                          : `To ${campaign.segmentName ?? 'everybody who agreed'}, ${formatDateTime(
                              campaign.scheduledFor
                            )}.`}
                      </p>
                    </div>

                    {isOwner ? (
                      <div className="flex flex-wrap gap-2">
                        {campaign.status === 'sent' ? null : (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setSchedulingId(
                                schedulingId === campaign.campaignId ? null : campaign.campaignId
                              )
                            }
                          >
                            {schedulingId === campaign.campaignId ? 'Close' : 'Schedule'}
                          </Button>
                        )}

                        {campaign.status === 'sent' ? null : (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setFollowUpFor(
                                followUpFor === campaign.campaignId ? null : campaign.campaignId
                              )
                            }
                          >
                            {followUpFor === campaign.campaignId ? 'Close' : 'Add a follow up'}
                          </Button>
                        )}

                        {campaign.status === 'scheduled' || campaign.status === 'sending' ? (
                          <Button variant="ghost" onClick={() => void onPause(campaign.campaignId)}>
                            Stop it
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {followUpFor === campaign.campaignId ? (
                    <div className="space-y-3 border-t border-border pt-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField
                          id={`follow-subject-${campaign.campaignId}`}
                          label="Subject of the follow up"
                          isRequired
                        >
                          <Input
                            id={`follow-subject-${campaign.campaignId}`}
                            value={followUpSubject}
                            onChange={(event) => setFollowUpSubject(event.target.value)}
                          />
                        </FormField>

                        <FormField
                          id={`follow-delay-${campaign.campaignId}`}
                          label="Hours after the first message"
                          hint="A week is one hundred and sixty eight."
                        >
                          <Input
                            id={`follow-delay-${campaign.campaignId}`}
                            type="number"
                            min="0"
                            max="8760"
                            value={followUpDelay}
                            onChange={(event) => setFollowUpDelay(event.target.value)}
                          />
                        </FormField>
                      </div>

                      <FormField
                        id={`follow-body-${campaign.campaignId}`}
                        label="What it says"
                        isRequired
                      >
                        <Textarea
                          id={`follow-body-${campaign.campaignId}`}
                          rows={3}
                          value={followUpBody}
                          onChange={(event) => setFollowUpBody(event.target.value)}
                        />
                      </FormField>

                      <Button
                        onClick={() =>
                          void onAddFollowUp(campaign.campaignId, campaign.stepCount + 1)
                        }
                      >
                        Add this follow up
                      </Button>
                    </div>
                  ) : null}

                  {schedulingId === campaign.campaignId ? (
                    <div className="space-y-3 border-t border-border pt-3">
                      <FormField
                        id={`schedule-${campaign.campaignId}`}
                        label="When it goes out"
                        hint="The audience is counted at this moment, so you see the size before it sends."
                      >
                        <Input
                          id={`schedule-${campaign.campaignId}`}
                          type="datetime-local"
                          value={scheduledFor}
                          onChange={(event) => setScheduledFor(event.target.value)}
                        />
                      </FormField>

                      <Button onClick={() => void onSchedule(campaign.campaignId)}>
                        Schedule this send
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audiences</CardTitle>
          <CardDescription>
            A described group of people, counted on a schedule so a campaign screen never waits for
            a slow query.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {segments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No audience is described yet, so a campaign reaches everybody who agreed to hear from
              you.
            </p>
          ) : (
            <ul className="space-y-2">
              {segments.map((segment) => (
                <li
                  key={segment.segmentId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{segment.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {segment.description ?? 'No description.'}
                    </p>
                  </div>
                  <span className="tabular text-sm text-muted-foreground">
                    {segment.lastCalculatedAt === null
                      ? 'Not counted yet'
                      : `${formatNumber(segment.memberCount)} people, counted ${formatDateTime(
                          segment.lastCalculatedAt
                        )}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-end">
            <FormField id="segment-name" label="Name a new audience" isRequired>
              <Input
                id="segment-name"
                value={segmentName}
                onChange={(event) => setSegmentName(event.target.value)}
              />
            </FormField>

            <Button
              variant="secondary"
              isLoading={isSavingSegment}
              loadingLabel="Saving"
              onClick={() => void onSaveSegment()}
            >
              Add it
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert tone="info" title="Nobody is written to twice after asking you to stop">
        An unsubscribe is honoured permanently and across every campaign, whatever an audience
        description says. That is a legal requirement in most of the countries your clients are in,
        and it is also simply correct.
      </Alert>
    </div>
  );
}
