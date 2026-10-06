// src/components/projects/project-board.tsx
// The work a business has on, and the clock that turns it into money.
//
// The timer is the point of this screen. An hour that was worked and never
// written down is an hour nobody is paid for, so starting one is a single
// press from the list, and whatever is running follows you across the
// screen until you stop it.

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import { saveProject, startTimer, stopTimer } from '@/features/projects/actions/manage-projects';
import type { ProjectSummary, TimeEntryRow } from '@/features/projects/types';
import { BILLING_TYPES, PROJECT_STATUSES } from '@/features/projects/validation/project';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface ProjectBoardProps {
  /** The projects of this business. */
  projects: readonly ProjectSummary[];
  /** The timer running for this person, if there is one. */
  runningEntry: TimeEntryRow | null;
  /** Clients this business could attach a project to. */
  clients: readonly { id: string; name: string }[];
  /** True when the viewer may create and change projects. */
  canEdit: boolean;
  /** Currency this business works in. */
  currency: string;
}

type ProjectStatus = (typeof PROJECT_STATUSES)[number];
type BillingType = (typeof BILLING_TYPES)[number];

const STATUS_TONES: Readonly<Record<string, 'success' | 'warning' | 'neutral'>> = {
  active: 'success',
  planning: 'neutral',
  on_hold: 'warning',
  completed: 'neutral',
  cancelled: 'neutral',
};

/**
 * Describes how far a project is through its budget.
 *
 * @param project The project.
 * @returns A sentence about the budget, or null when there is none.
 */
function budgetNote(project: ProjectSummary): string | null {
  if (project.budgetHours === null) {
    return null;
  }

  const budget = Number.parseFloat(project.budgetHours);
  const logged = Number.parseFloat(project.loggedHours);

  if (budget <= 0) {
    return null;
  }

  const share = Math.round((logged / budget) * 100);

  return `${formatNumber(logged, 2)} of ${formatNumber(budget, 2)} budgeted hours used, ${formatNumber(share)}%`;
}

/**
 * Renders the project board.
 *
 * @param props The projects, the running timer and who may change things.
 * @returns The rendered board.
 */
export function ProjectBoard({
  projects,
  runningEntry,
  clients,
  canEdit,
  currency,
}: ProjectBoardProps) {
  const router = useRouter();

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [billingType, setBillingType] = useState<BillingType>('time_and_materials');
  const [hourlyRate, setHourlyRate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [timerProject, setTimerProject] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [elapsed, setElapsed] = useState(0);

  // The clock on screen ticks on its own so the person can see the time
  // accruing; the real figure is always the one the database works out.
  useEffect(() => {
    if (runningEntry === null) {
      return;
    }

    const handle = window.setInterval(() => {
      setElapsed((previous) => previous + 1);
    }, 60000);

    return () => {
      window.clearInterval(handle);
    };
  }, [runningEntry]);

  /**
   * Creates a project.
   *
   * @returns Nothing.
   */
  async function onCreate(): Promise<void> {
    setIsSaving(true);
    setFieldErrors({});

    const result = await saveProject({
      name,
      clientId: clientId === '' ? undefined : clientId,
      status,
      billingType,
      hourlyRate: hourlyRate === '' ? undefined : hourlyRate,
    });

    setIsSaving(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors ?? {});
      notify.error(result.error);

      return;
    }

    notify.success('Created. Start the clock whenever you begin.');
    setName('');
    setHourlyRate('');
    setIsCreating(false);
    router.refresh();
  }

  /**
   * Starts the clock on one project.
   *
   * @param projectId Project being worked on.
   * @returns Nothing.
   */
  async function onStart(projectId: string): Promise<void> {
    const result = await startTimer({ projectId, description, isBillable: true });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Running. It keeps counting until you stop it.');
    setTimerProject(null);
    setDescription('');
    setElapsed(0);
    router.refresh();
  }

  /**
   * Stops whatever is running.
   *
   * @returns Nothing.
   */
  async function onStop(): Promise<void> {
    if (runningEntry === null) {
      return;
    }

    const result = await stopTimer({ entryId: runningEntry.entryId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(
      `Stopped at ${formatNumber(result.data.minutes)} minutes. It is on the project.`
    );
    setElapsed(0);
    router.refresh();
  }

  const clientOptions = [
    { value: '', label: 'No client yet' },
    ...clients.map((client) => ({ value: client.id, label: client.name })),
  ];

  return (
    <div className="space-y-6">
      {runningEntry === null ? null : (
        <Alert tone="info" title="A clock is running">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {`${runningEntry.description} — ${formatNumber(runningEntry.minutes + elapsed)} minutes so far.`}
            </span>
            <Button variant="secondary" onClick={() => void onStop()}>
              Stop the clock
            </Button>
          </div>
        </Alert>
      )}

      {canEdit ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Projects</CardTitle>
                <CardDescription>
                  A project holds the hours, the budget and what has been billed against it.
                </CardDescription>
              </div>
              <Button onClick={() => setIsCreating(!isCreating)}>
                {isCreating ? 'Cancel' : 'New project'}
              </Button>
            </div>
          </CardHeader>

          {isCreating ? (
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="project-name" label="Name" errors={fieldErrors['name']} isRequired>
                  <Input
                    id="project-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </FormField>

                <FormField id="project-client" label="Client">
                  <Select
                    id="project-client"
                    value={clientId}
                    options={clientOptions}
                    onChange={(event) => setClientId(event.target.value)}
                  />
                </FormField>

                <FormField id="project-status" label="State">
                  <Select
                    id="project-status"
                    value={status}
                    options={PROJECT_STATUSES.map((entry) => ({
                      value: entry,
                      label: humanise(entry),
                    }))}
                    onChange={(event) => setStatus(event.target.value as ProjectStatus)}
                  />
                </FormField>

                <FormField id="project-billing" label="How it is billed">
                  <Select
                    id="project-billing"
                    value={billingType}
                    options={BILLING_TYPES.map((entry) => ({
                      value: entry,
                      label: humanise(entry),
                    }))}
                    onChange={(event) => setBillingType(event.target.value as BillingType)}
                  />
                </FormField>

                <FormField
                  id="project-rate"
                  label={`Hourly rate (${currency})`}
                  hint="Left empty, the rate on the client or the business is used."
                  errors={fieldErrors['hourlyRate']}
                >
                  <Input
                    id="project-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={hourlyRate}
                    onChange={(event) => setHourlyRate(event.target.value)}
                  />
                </FormField>
              </div>

              <Button isLoading={isSaving} loadingLabel="Creating" onClick={() => void onCreate()}>
                Create this project
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState
          title="No project yet"
          description="A project is where hours, budget and billing meet. Create one and the clock has somewhere to go."
        />
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li key={project.projectId} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/projects/${project.projectId}`}
                      className="font-medium text-brand-700 underline"
                    >
                      {project.name}
                    </Link>
                    <Badge tone={STATUS_TONES[project.status] ?? 'neutral'}>
                      {humanise(project.status)}
                    </Badge>
                    <Badge tone="neutral">{humanise(project.billingType)}</Badge>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {`${project.projectCode}${
                      project.clientName === null ? '' : ` for ${project.clientName}`
                    }`}
                  </p>

                  <p className="tabular text-sm text-muted-foreground">
                    {`${formatNumber(Number(project.loggedHours), 2)} hours logged, ${formatMoney(
                      project.uninvoicedAmount,
                      project.currency
                    )} not yet invoiced, ${formatMoney(project.billedAmount, project.currency)} billed`}
                  </p>

                  {budgetNote(project) === null ? null : (
                    <p className="tabular text-sm text-muted-foreground">{budgetNote(project)}</p>
                  )}
                </div>

                {runningEntry === null ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setTimerProject(timerProject === project.projectId ? null : project.projectId)
                    }
                  >
                    {timerProject === project.projectId ? 'Close' : 'Start the clock'}
                  </Button>
                ) : null}
              </div>

              {timerProject === project.projectId ? (
                <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
                  <div className="min-w-0 flex-1">
                    <FormField
                      id={`timer-${project.projectId}`}
                      label="What are you working on"
                      hint="This ends up on the invoice line, so write it for your client."
                      isRequired
                    >
                      <Input
                        id={`timer-${project.projectId}`}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                      />
                    </FormField>
                  </div>

                  <Button onClick={() => void onStart(project.projectId)}>Start</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
