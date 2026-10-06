// src/components/marketing/social-publishing-console.tsx
// Writing what a business says in public, and deciding when it is said.
//
// Three parts, in the order the work actually happens: the accounts you can
// post from, the posts themselves with their approval and their time, and
// the rules that write a draft for you when something happens in the
// product. Nothing goes out without an owner having read it, which is the
// one safeguard worth having when the audience is the whole internet.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import {
  approveSocialPost,
  cancelSocialPost,
  disconnectSocialChannel,
  saveSocialChannel,
  saveSocialPost,
  saveSocialRule,
  scheduleSocialPost,
} from '@/features/social/actions/manage-publishing';
import type { SocialChannel, SocialPost, SocialRule } from '@/features/social/types';
import { SOCIAL_PLATFORMS } from '@/features/social/validation/social';
import { formatDateTime } from '@/lib/dates';
import { formatNumber, humanise } from '@/lib/format';

export interface SocialPublishingConsoleProps {
  /** Accounts this business can post from. */
  channels: readonly SocialChannel[];
  /** What has been written. */
  posts: readonly SocialPost[];
  /** Rules that write a draft by themselves. */
  rules: readonly SocialRule[];
  /** True when the viewer may approve and schedule. */
  isOwner: boolean;
}

type Platform = (typeof SOCIAL_PLATFORMS)[number];

const STATUS_TONES: Readonly<Record<string, 'success' | 'warning' | 'danger' | 'neutral'>> = {
  published: 'success',
  partially_published: 'warning',
  scheduled: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  draft: 'neutral',
  awaiting_approval: 'warning',
};

/** The things that happen in the product which are worth saying out loud. */
const TRIGGER_EVENTS = [
  { value: 'invoice.paid', label: 'An invoice was paid' },
  { value: 'client.created', label: 'A new client was added' },
  { value: 'review.received', label: 'A client left a review' },
  { value: 'milestone.reached', label: 'A project milestone was met' },
];

/**
 * Renders the publishing console.
 *
 * @param props The accounts, posts, rules and whether the viewer may approve.
 * @returns The rendered console.
 */
export function SocialPublishingConsole({
  channels,
  posts,
  rules,
  isOwner,
}: SocialPublishingConsoleProps) {
  const router = useRouter();

  const [platform, setPlatform] = useState<Platform>('linkedin');
  const [accountName, setAccountName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isWriting, setIsWriting] = useState(false);

  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState('');
  const [chosenChannels, setChosenChannels] = useState<string[]>([]);

  const [ruleName, setRuleName] = useState('');
  const [ruleEvent, setRuleEvent] = useState('invoice.paid');
  const [ruleBody, setRuleBody] = useState('');
  const [isSavingRule, setIsSavingRule] = useState(false);

  const connected = channels.filter((channel) => channel.isConnected);

  /**
   * Connects an account to post from.
   *
   * @returns Nothing.
   */
  async function onConnect(): Promise<void> {
    setIsConnecting(true);

    const result = await saveSocialChannel({
      platform,
      accountName,
      accessToken: accessToken === '' ? undefined : accessToken,
    });

    setIsConnecting(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Connected. The token is encrypted and never shown again.');
    setAccountName('');
    setAccessToken('');
    router.refresh();
  }

  /**
   * Stops posting from one account.
   *
   * @param channelId Account being disconnected.
   * @returns Nothing.
   */
  async function onDisconnect(channelId: string): Promise<void> {
    const result = await disconnectSocialChannel({ channelId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Disconnected. Everything already posted stays where it is.');
    router.refresh();
  }

  /**
   * Writes a new post.
   *
   * @returns Nothing.
   */
  async function onWrite(): Promise<void> {
    setIsWriting(true);

    const result = await saveSocialPost({
      title,
      body,
      linkUrl: linkUrl === '' ? undefined : linkUrl,
      hashtags: [],
    });

    setIsWriting(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Written as a draft. It goes nowhere until it is approved and scheduled.');
    setTitle('');
    setBody('');
    setLinkUrl('');
    router.refresh();
  }

  /**
   * Approves one post.
   *
   * @param postId Post being approved.
   * @returns Nothing.
   */
  async function onApprove(postId: string): Promise<void> {
    const result = await approveSocialPost({ postId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Approved.');
    router.refresh();
  }

  /**
   * Schedules one post on the chosen accounts.
   *
   * @param postId Post being scheduled.
   * @returns Nothing.
   */
  async function onSchedule(postId: string): Promise<void> {
    const result = await scheduleSocialPost({
      postId,
      channelIds: chosenChannels,
      scheduledFor,
    });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(`Scheduled on ${formatNumber(result.data.channelCount)} accounts.`);
    setSchedulingId(null);
    setChosenChannels([]);
    router.refresh();
  }

  /**
   * Stops a post that has not gone out.
   *
   * @param postId Post being cancelled.
   * @returns Nothing.
   */
  async function onCancel(postId: string): Promise<void> {
    const result = await cancelSocialPost({ postId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Stopped.');
    router.refresh();
  }

  /**
   * Saves an automatic posting rule.
   *
   * @returns Nothing.
   */
  async function onSaveRule(): Promise<void> {
    setIsSavingRule(true);

    const result = await saveSocialRule({
      name: ruleName,
      triggerEvent: ruleEvent,
      bodyTemplate: ruleBody,
      channelIds: connected.map((channel) => channel.channelId),
      requiresApproval: true,
      minimumHoursBetweenPosts: 24,
      isActive: false,
    });

    setIsSavingRule(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Saved. It writes drafts for you; nothing goes out unread.');
    setRuleName('');
    setRuleBody('');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Accounts you post from</CardTitle>
          <CardDescription>
            Each connection is a token, encrypted the moment it arrives and never shown again.
            Disconnecting stops future posts and touches nothing already published.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No account is connected yet.</p>
          ) : (
            <ul className="space-y-3">
              {channels.map((channel) => (
                <li
                  key={channel.channelId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{channel.accountName}</p>
                      <Badge tone="neutral">{humanise(channel.platform)}</Badge>
                      <Badge tone={channel.isConnected ? 'success' : 'warning'}>
                        {channel.isConnected ? 'Connected' : 'Not connected'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {`${formatNumber(channel.postCount)} posts sent${
                        channel.lastPublishedAt === null
                          ? ''
                          : `, last on ${formatDateTime(channel.lastPublishedAt)}`
                      }${channel.maskedHint === null ? '' : `. Token ${channel.maskedHint}`}`}
                    </p>
                    {channel.connectionError === null ? null : (
                      <p className="text-danger text-sm">{channel.connectionError}</p>
                    )}
                  </div>

                  {isOwner && channel.isConnected ? (
                    <Button variant="ghost" onClick={() => void onDisconnect(channel.channelId)}>
                      Disconnect
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {isOwner ? (
            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
              <FormField id="channel-platform" label="Network">
                <Select
                  id="channel-platform"
                  value={platform}
                  options={SOCIAL_PLATFORMS.map((entry) => ({
                    value: entry,
                    label: humanise(entry),
                  }))}
                  onChange={(event) => setPlatform(event.target.value as Platform)}
                />
              </FormField>

              <FormField id="channel-name" label="Account name" isRequired>
                <Input
                  id="channel-name"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                />
              </FormField>

              <FormField
                id="channel-token"
                label="Access token"
                hint="From the developer settings of that network."
              >
                <Input
                  id="channel-token"
                  type="password"
                  autoComplete="off"
                  value={accessToken}
                  onChange={(event) => setAccessToken(event.target.value)}
                />
              </FormField>

              <div className="sm:col-span-3">
                <Button
                  isLoading={isConnecting}
                  loadingLabel="Connecting"
                  onClick={() => void onConnect()}
                >
                  Connect this account
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What is going out</CardTitle>
          <CardDescription>
            A post is written, read by the owner, then given a time. Each step is recorded against
            the person who did it.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-4 rounded-lg border border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="post-title"
                label="Title"
                hint="Only for you, to find it again."
                isRequired
              >
                <Input
                  id="post-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </FormField>

              <FormField id="post-link" label="Link to include">
                <Input
                  id="post-link"
                  type="url"
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                />
              </FormField>
            </div>

            <FormField id="post-body" label="What it says" isRequired>
              <Textarea
                id="post-body"
                rows={4}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </FormField>

            <Button isLoading={isWriting} loadingLabel="Saving" onClick={() => void onWrite()}>
              Save as a draft
            </Button>
          </div>

          {posts.length === 0 ? (
            <EmptyState
              title="Nothing is written yet"
              description="Write a draft above. It stays a draft until an owner approves it and gives it a time."
            />
          ) : (
            <ul className="space-y-3">
              {posts.map((post) => (
                <li key={post.postId} className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{post.title}</p>
                        <Badge tone={STATUS_TONES[post.status] ?? 'neutral'}>
                          {humanise(post.status)}
                        </Badge>
                        {post.approvedAt === null ? (
                          <Badge tone="warning">Not approved</Badge>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-line text-sm text-muted-foreground">
                        {post.body.slice(0, 220)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {post.scheduledFor === null
                          ? 'No time set yet.'
                          : `Goes out ${formatDateTime(post.scheduledFor)} on ${formatNumber(post.channelCount)} accounts.`}
                        {post.failedCount > 0
                          ? ` ${formatNumber(post.failedCount)} failed to send.`
                          : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isOwner && post.approvedAt === null ? (
                        <Button variant="secondary" onClick={() => void onApprove(post.postId)}>
                          Approve
                        </Button>
                      ) : null}

                      {isOwner && post.status !== 'published' ? (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setSchedulingId(schedulingId === post.postId ? null : post.postId)
                          }
                        >
                          {schedulingId === post.postId ? 'Close' : 'Schedule'}
                        </Button>
                      ) : null}

                      {post.status === 'published' || post.status === 'cancelled' ? null : (
                        <Button variant="ghost" onClick={() => void onCancel(post.postId)}>
                          Stop it
                        </Button>
                      )}
                    </div>
                  </div>

                  {schedulingId === post.postId ? (
                    <div className="space-y-3 border-t border-border pt-3">
                      {connected.length === 0 ? (
                        <Alert tone="warning" title="No account is connected">
                          Connect an account above before scheduling anything.
                        </Alert>
                      ) : (
                        <>
                          <FormField id={`schedule-${post.postId}`} label="When it goes out">
                            <Input
                              id={`schedule-${post.postId}`}
                              type="datetime-local"
                              value={scheduledFor}
                              onChange={(event) => setScheduledFor(event.target.value)}
                            />
                          </FormField>

                          <fieldset className="space-y-2">
                            <legend className="text-sm font-medium text-foreground">
                              Where it goes
                            </legend>
                            {connected.map((channel) => (
                              <Checkbox
                                key={channel.channelId}
                                id={`channel-${post.postId}-${channel.channelId}`}
                                label={`${channel.accountName} on ${humanise(channel.platform)}`}
                                checked={chosenChannels.includes(channel.channelId)}
                                onChange={(event) => {
                                  setChosenChannels(
                                    event.target.checked
                                      ? [...chosenChannels, channel.channelId]
                                      : chosenChannels.filter((id) => id !== channel.channelId)
                                  );
                                }}
                              />
                            ))}
                          </fieldset>

                          <Button onClick={() => void onSchedule(post.postId)}>
                            Put it on the calendar
                          </Button>
                        </>
                      )}
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
          <CardTitle>Posts that write themselves</CardTitle>
          <CardDescription>
            A rule turns something that happened in the product into a draft. It is a draft on
            purpose: an account that posts automatically will eventually post something nobody
            wanted said.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rule is set up.</p>
          ) : (
            <ul className="space-y-3">
              {rules.map((rule) => (
                <li
                  key={rule.ruleId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{rule.name}</p>
                      <Badge tone={rule.isActive ? 'success' : 'neutral'}>
                        {rule.isActive ? 'Running' : 'Paused'}
                      </Badge>
                      {rule.requiresApproval ? <Badge tone="info">Drafts only</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {`${humanise(rule.triggerEvent)}, at most one post every ${formatNumber(
                        rule.minimumHoursBetweenPosts
                      )} hours. Fired ${formatNumber(rule.triggerCount)} times.`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isOwner ? (
            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <FormField id="rule-name" label="Name of the rule" isRequired>
                <Input
                  id="rule-name"
                  value={ruleName}
                  onChange={(event) => setRuleName(event.target.value)}
                />
              </FormField>

              <FormField id="rule-event" label="What sets it off">
                <Select
                  id="rule-event"
                  value={ruleEvent}
                  options={TRIGGER_EVENTS}
                  onChange={(event) => setRuleEvent(event.target.value)}
                />
              </FormField>

              <div className="sm:col-span-2">
                <FormField
                  id="rule-body"
                  label="What the draft should say"
                  hint="Write it as you would say it. You read every draft before it goes out."
                  isRequired
                >
                  <Textarea
                    id="rule-body"
                    rows={3}
                    value={ruleBody}
                    onChange={(event) => setRuleBody(event.target.value)}
                  />
                </FormField>
              </div>

              <div className="sm:col-span-2">
                <Button
                  isLoading={isSavingRule}
                  loadingLabel="Saving"
                  onClick={() => void onSaveRule()}
                >
                  Save this rule
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
