'use client';

import Link from 'next/link';
import { Download, FileUp, Merge, Plus, Users, UserRoundCheck } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  buttonVariants,
} from '@/components/ui';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { DataTableToolbar } from '@/components/shared/data-table-toolbar';
import { findPotentialDuplicates } from '@/lib/clients/service';
import type { Client } from '@/types/client';
import {
  CLIENTS,
  CLIENT_GROUPS,
  CLIENT_TAGS,
  formatCurrency,
  getClientGroup,
  getClientTags,
} from './clients-data';

export function ClientsPage({
  clients = CLIENTS,
}: {
  readonly clients?: readonly Client[];
}): ReactNode {
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('all');
  const [tagId, setTagId] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleClients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return clients.filter((client) => {
      if (!showArchived && client.isArchived) return false;
      if (groupId !== 'all' && client.groupId !== groupId) return false;
      if (tagId !== 'all' && !client.tagIds.includes(tagId as Client['tagIds'][number]))
        return false;
      if (
        normalizedSearch &&
        !`${client.displayName} ${client.email} ${client.phone ?? ''}`
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        return false;
      }
      return true;
    });
  }, [clients, groupId, search, showArchived, tagId]);

  const duplicates = useMemo(() => findPotentialDuplicates(clients), [clients]);
  const hasFilters = Boolean(search || groupId !== 'all' || tagId !== 'all' || showArchived);

  function downloadExport(): void {
    window.location.assign(
      `/api/clients/export?includeArchived=${showArchived ? 'true' : 'false'}`
    );
  }

  function handleImportSelection(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportMessage(
      `${file.name} is ready for secure server-side validation. Upload it from the import workflow to continue.`
    );
    event.target.value = '';
  }

  function clearFilters(): void {
    setSearch('');
    setGroupId('all');
    setTagId('all');
    setShowArchived(false);
  }

  const columns: readonly DataTableColumn<Client>[] = [
    {
      key: 'client',
      header: 'Client',
      cell: (client) => (
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            {client.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <Link
              href={`/clients/${client.id}`}
              className="font-semibold text-foreground hover:text-brand-700 dark:hover:text-brand-300"
            >
              {client.displayName}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{client.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'group',
      header: 'Group',
      cell: (client) => {
        const group = getClientGroup(client.groupId);
        return group ? (
          <Badge variant="neutral">{group.name}</Badge>
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        );
      },
    },
    {
      key: 'tags',
      header: 'Tags',
      cell: (client) => (
        <div className="flex max-w-[14rem] flex-wrap gap-1.5">
          {getClientTags(client.tagIds).map((tag) => (
            <Badge key={tag.id} variant="brand">
              {tag.name}
            </Badge>
          ))}
          {client.tagIds.length === 0 ? <span className="text-muted-foreground">—</span> : null}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Phone',
      cell: (client) => (
        <span className="whitespace-nowrap text-muted-foreground">{client.phone ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (client) => (
        <Badge variant={client.isArchived ? 'neutral' : 'success'}>
          {client.isArchived ? 'Archived' : 'Active'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
            <Users className="h-4 w-4" aria-hidden="true" />
            Customer relationships
          </div>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
            Clients
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Keep contacts, billing history, activity, and follow-up context together in one
            tenant-safe workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={handleImportSelection}
          />
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<FileUp className="h-4 w-4" aria-hidden="true" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Import
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            onClick={downloadExport}
          >
            Export CSV
          </Button>
          <Link href="/clients/new" className={buttonVariants({ size: 'sm' })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add client
          </Link>
        </div>
      </header>

      {importMessage ? (
        <div
          role="status"
          className="rounded-lg border border-info/30 bg-info-subtle px-4 py-3 text-sm text-info-foreground"
        >
          {importMessage}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Client summary">
        <SummaryCard
          icon={<UserRoundCheck className="h-5 w-5" aria-hidden="true" />}
          label="Active clients"
          value={String(clients.filter((client) => !client.isArchived).length)}
          detail="Ready for billing and follow-up"
        />
        <SummaryCard
          icon={<Users className="h-5 w-5" aria-hidden="true" />}
          label="Groups"
          value={String(CLIENT_GROUPS.length)}
          detail="Use groups for focused outreach"
        />
        <SummaryCard
          icon={<Merge className="h-5 w-5" aria-hidden="true" />}
          label="Duplicate review"
          value={String(duplicates.length)}
          detail={duplicates.length ? 'Potential matches need attention' : 'No matches found'}
        />
      </section>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base">Client directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <DataTableToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name, email, or phone"
            resultLabel={`${visibleClients.length} of ${clients.length} clients`}
            hasActiveFilters={hasFilters}
            onClearFilters={clearFilters}
            filterContent={
              <div className="flex flex-wrap gap-2">
                <Select
                  aria-label="Filter by group"
                  value={groupId}
                  onChange={(event) => setGroupId(event.target.value)}
                  className="min-w-36"
                >
                  <option value="all">All groups</option>
                  {CLIENT_GROUPS.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="Filter by tag"
                  value={tagId}
                  onChange={(event) => setTagId(event.target.value)}
                  className="min-w-32"
                >
                  <option value="all">All tags</option>
                  {CLIENT_TAGS.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </Select>
                <label className="flex h-11 items-center gap-2 rounded-md border border-input px-3 text-xs font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(event) => setShowArchived(event.target.checked)}
                  />
                  Archived
                </label>
              </div>
            }
          />
          <DataTable
            rows={visibleClients}
            columns={columns}
            getRowId={(client) => client.id}
            caption="Client directory"
            emptyTitle="No clients match these filters"
            emptyDescription="Clear a filter or add a new client to get started."
            emptyActionLabel="Clear filters"
            onEmptyAction={clearFilters}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}): ReactNode {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          {icon}
        </span>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClientBalance({ amount }: { readonly amount: string }): ReactNode {
  return <span className="font-semibold tabular-nums">{formatCurrency(amount)}</span>;
}
