'use client';

import Link from 'next/link';
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  Mail,
  Merge,
  MoreHorizontal,
  Phone,
  Plus,
  Send,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui';
import { buildClientTimeline } from '@/lib/clients/service';
import type { ClientStatement } from '@/lib/clients/types';
import type { Client, ClientActivityEntry } from '@/types/client';
import { buildStatement, formatCurrency, getClientGroup, getClientTags } from './clients-data';

export function ClientDetailPage({ client }: { readonly client: Client }): ReactNode {
  const [archived, setArchived] = useState(client.isArchived);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [note, setNote] = useState('');
  const statement = buildStatement(client.id);
  const timeline = buildTimeline(client.id);
  const group = getClientGroup(client.groupId);
  const tags = getClientTags(client.tagIds);

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/clients"
            className="mt-1 rounded-md p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            aria-label="Back to clients"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Client profile
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                {client.displayName}
              </h1>
              <Badge variant={archived ? 'neutral' : 'success'}>
                {archived ? 'Archived' : 'Active'}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Last updated Oct 6, 2026 · Tenant-scoped workspace record
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/clients/${client.id}/edit`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-foreground shadow-xs hover:border-brand-300 hover:bg-surface-raised"
          >
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
          <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
            <DialogTrigger className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-foreground shadow-xs hover:border-brand-300 hover:bg-surface-raised">
              <Merge className="h-4 w-4" aria-hidden="true" />
              Merge
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Merge client records</DialogTitle>
              <DialogDescription>
                Choose a destination record. Invoices, notes, reminders, and activity will stay
                attached to the destination client.
              </DialogDescription>
              <div className="mt-5 space-y-4">
                <Label htmlFor="merge-target">Destination client</Label>
                <select
                  id="merge-target"
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option>Choose a matching client</option>
                  <option>Brightline Works</option>
                  <option>Oak &amp; Field</option>
                </select>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setMergeOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setMergeOpen(false)}>Review merge</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant={archived ? 'success' : 'secondary'}
            leftIcon={<Archive className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setArchived((value) => !value)}
          >
            {archived ? 'Restore' : 'Archive'}
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Client contact summary">
        <ContactCard
          icon={<Mail className="h-4 w-4" aria-hidden="true" />}
          label="Email"
          value={client.email}
        />
        <ContactCard
          icon={<Phone className="h-4 w-4" aria-hidden="true" />}
          label="Phone"
          value={client.phone ?? 'No phone number'}
        />
        <ContactCard
          icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
          label="Group"
          value={group?.name ?? 'Unassigned'}
        />
      </section>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-5">
          <span className="mr-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Tags
          </span>
          {tags.map((tag) => (
            <Badge key={tag.id} variant="brand">
              {tag.name}
            </Badge>
          ))}
          <Button
            variant="quiet"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Add tag
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList aria-label="Client details">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="statement">Statement</TabsTrigger>
          <TabsTrigger value="timeline">Activity timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewPanel client={client} note={note} onNoteChange={setNote} />
        </TabsContent>
        <TabsContent value="statement">
          <StatementPanel statement={statement} />
        </TabsContent>
        <TabsContent value="timeline">
          <TimelinePanel entries={timeline.entries} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContactCard({
  icon,
  label,
  value,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}): ReactNode {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewPanel({
  client,
  note,
  onNoteChange,
}: {
  readonly client: Client;
  readonly note: string;
  readonly onNoteChange: (value: string) => void;
}): ReactNode {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client context</CardTitle>
          <CardDescription>Private details your team can use when preparing work.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Detail
              label="Invoice name"
              value={client.companyNameOnInvoice ?? client.displayName}
            />
            <Detail label="Default currency" value={client.defaultCurrency} />
            <Detail label="Tax ID" value={client.taxId ?? 'Not provided'} />
            <Detail
              label="Billing address"
              value={
                client.billingAddress
                  ? `${client.billingAddress.city}, ${client.billingAddress.country}`
                  : 'Not provided'
              }
            />
          </div>
          <div>
            <Label htmlFor="quick-note">Quick note</Label>
            <Textarea
              id="quick-note"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Capture a private follow-up note"
            />
          </div>
          <div className="flex justify-end">
            <Button
              variant="secondary"
              leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            >
              Save note
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Next action</CardTitle>
          <CardDescription>Keep the relationship moving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}>
            Send statement
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            leftIcon={<Phone className="h-4 w-4" aria-hidden="true" />}
          >
            Create reminder
          </Button>
          <Button
            variant="quiet"
            className="w-full"
            leftIcon={<MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
          >
            More actions
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StatementPanel({ statement }: { readonly statement: ClientStatement }): ReactNode {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Account statement</CardTitle>
          <CardDescription>Invoices, payments, and credits in chronological order.</CardDescription>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}
        >
          Send statement
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid gap-3 border-y border-border bg-surface-muted/40 p-5 sm:grid-cols-3">
          <Metric
            label="Invoiced"
            value={formatCurrency(statement.totalInvoiced.amount, statement.currency)}
          />
          <Metric
            label="Paid"
            value={formatCurrency(statement.totalPaid.amount, statement.currency)}
          />
          <Metric
            label="Closing balance"
            value={formatCurrency(statement.closingBalance.amount, statement.currency)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {statement.rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 text-muted-foreground">{formatDate(row.occurredAt)}</td>
                  <td className="px-5 py-4 font-semibold">{row.reference}</td>
                  <td className="px-5 py-4 text-muted-foreground">{row.description}</td>
                  <td
                    className={`px-5 py-4 text-right font-semibold ${row.type === 'invoice' ? 'text-foreground' : 'text-success-foreground'}`}
                  >
                    {formatCurrency(row.amount.amount, statement.currency)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums">
                    {formatCurrency(row.balance.amount, statement.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelinePanel({
  entries,
}: {
  readonly entries: readonly ClientActivityEntry[];
}): ReactNode {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity timeline</CardTitle>
        <CardDescription>
          A chronological record of client-facing and internal events.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {entries.map((entry) => (
            <div key={entry.id} className="relative flex gap-4">
              <span className="relative mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 border-b border-border pb-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{entry.type}</p>
                  <time className="text-xs text-muted-foreground">
                    {formatDate(entry.occurredAt)}
                  </time>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{entry.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
function Metric({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
function buildTimeline(clientId: string): { readonly entries: readonly ClientActivityEntry[] } {
  return buildClientTimeline({
    clientId,
    entries: [
      {
        id: 'activity-1' as Client['id'],
        clientId: clientId as Client['id'],
        type: 'Statement sent',
        description: 'The October account statement was prepared for review.',
        occurredAt: '2026-10-06T09:12:00.000Z' as Client['updatedAt'],
      },
      {
        id: 'activity-2' as Client['id'],
        clientId: clientId as Client['id'],
        type: 'Payment received',
        description: 'Payment PAY-401 was reconciled against INV-1038.',
        occurredAt: '2026-09-22T10:00:00.000Z' as Client['updatedAt'],
      },
    ],
  });
}
