// src/components/admin/platform-operations-console.tsx
// Whether this installation is ready, which domains it answers on, and
// whether the DNS behind them is actually correct.
//
// Readiness is computed from the configuration itself, so it cannot claim to
// be finished while the mail is broken. The DNS list is generated from one
// domain name and then checked against the public internet, because the
// difference between "I added the record" and "the record is there" is where
// deliverability goes to die.

'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
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
import { planPlatformDomains } from '@/features/platform/actions/plan-domains';
import { savePlatformSetting } from '@/features/platform/actions/save-setting';
import { verifyPlatformDomain } from '@/features/platform/actions/verify-domain';
import type { OperationsBoard } from '@/features/platform/queries/get-operations';
import { formatDateTime } from '@/lib/dates';
import { formatNumber, humanise } from '@/lib/format';

export interface PlatformOperationsConsoleProps {
  /** Everything the console shows. */
  board: OperationsBoard;
}

/**
 * Renders the operations console.
 *
 * @param props The readiness, domains, health and settings.
 * @returns The rendered console.
 */
export function PlatformOperationsConsole({ board }: PlatformOperationsConsoleProps) {
  const router = useRouter();

  const [rootDomain, setRootDomain] = useState('');
  const [hostTarget, setHostTarget] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [busyDomain, setBusyDomain] = useState<string | null>(null);
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const [settingValues, setSettingValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const remaining = board.requiredCount - board.requiredDone;
  const groups = Array.from(new Set(board.settings.map((entry) => entry.settingGroup))).sort();

  /**
   * Writes out the whole domain plan from one domain name.
   *
   * @returns Nothing.
   */
  async function onPlan(): Promise<void> {
    setIsPlanning(true);
    const result = await planPlatformDomains({ rootDomain, hostTarget });
    setIsPlanning(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(
      `Written out. ${formatNumber(result.data.hostnameCount)} hostnames with the records each one needs.`
    );
    router.refresh();
  }

  /**
   * Checks the DNS of one hostname for real.
   *
   * @param domainId Hostname being checked.
   * @returns Nothing.
   */
  async function onVerify(domainId: string): Promise<void> {
    setBusyDomain(domainId);
    const result = await verifyPlatformDomain({ domainId });
    setBusyDomain(null);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    if (result.data.isVerified) {
      notify.success(result.data.message);
    } else {
      notify.error(result.data.message);
    }

    router.refresh();
  }

  /**
   * Changes one platform setting.
   *
   * @param settingKey Setting being changed.
   * @returns Nothing.
   */
  async function onSaveSetting(settingKey: string): Promise<void> {
    setSavingKey(settingKey);

    const result = await savePlatformSetting({
      settingKey,
      value: settingValues[settingKey] ?? '',
    });

    setSavingKey(null);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Changed. It applies everywhere immediately.');
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>
            {board.isReady
              ? 'This installation is ready to trade'
              : `${formatNumber(remaining)} ${remaining === 1 ? 'thing' : 'things'} left before this installation can trade`}
          </CardTitle>
          <CardDescription>
            Worked out from the configuration itself every time this page loads, so it can never
            claim to be finished while something is actually broken.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {board.steps.map((step) => (
              <li
                key={step.key}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{step.title}</p>
                    {step.isRequired ? (
                      <Badge tone={step.isDone ? 'success' : 'warning'}>
                        {step.isDone ? 'Done' : 'Required'}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">{step.isDone ? 'Done' : 'Recommended'}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                </div>

                {step.isDone ? null : (
                  <Link
                    href={step.href}
                    className="inline-flex min-h-touch items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-xs"
                  >
                    Sort this out
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domains and DNS</CardTitle>
          <CardDescription>
            Enter the domain you own and where this application is served from. Every hostname and
            record is worked out for you, then checked against the public internet rather than taken
            on trust.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="root-domain"
              label="The domain you own"
              hint="For example example.com, without www."
              isRequired
            >
              <Input
                id="root-domain"
                value={rootDomain}
                onChange={(event) => setRootDomain(event.target.value)}
              />
            </FormField>

            <FormField
              id="host-target"
              label="Where this application is served from"
              hint="The hostname your platform gave you, such as your-site.netlify.app."
              isRequired
            >
              <Input
                id="host-target"
                value={hostTarget}
                onChange={(event) => setHostTarget(event.target.value)}
              />
            </FormField>
          </div>

          <Button
            isLoading={isPlanning}
            loadingLabel="Writing it out"
            onClick={() => void onPlan()}
          >
            Write out every record I need
          </Button>

          {board.domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hostnames are written down yet. Enter your domain above and the full list appears
              here.
            </p>
          ) : (
            <ul className="space-y-3">
              {board.domains.map((domain) => (
                <li key={domain.domainId} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{domain.hostname}</p>
                        <Badge tone="neutral">{humanise(domain.purpose)}</Badge>
                        <Badge tone={domain.isVerified ? 'success' : 'warning'}>
                          {domain.isVerified ? 'Verified' : 'Not verified yet'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {domain.lastCheckedAt === null
                          ? 'Never checked.'
                          : `${domain.lastCheckMessage ?? 'Checked.'} (${formatDateTime(domain.lastCheckedAt)})`}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        isLoading={busyDomain === domain.domainId}
                        loadingLabel="Checking"
                        onClick={() => void onVerify(domain.domainId)}
                      >
                        Check the DNS
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setOpenDomain(openDomain === domain.domainId ? null : domain.domainId)
                        }
                      >
                        {openDomain === domain.domainId ? 'Hide records' : 'Show records'}
                      </Button>
                    </div>
                  </div>

                  {openDomain === domain.domainId ? (
                    <div className="mt-4 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Why</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {domain.records.map((record) => (
                            <TableRow key={`${record.type}-${record.name}-${record.value}`}>
                              <TableCell>{record.type}</TableCell>
                              <TableCell className="break-all">{record.name}</TableCell>
                              <TableCell className="break-all">{record.value}</TableCell>
                              <TableCell>
                                {record.purpose}
                                {record.isRequired ? '' : ' Optional.'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}

                  {domain.failingRecords.length === 0 ? null : (
                    <Alert tone="warning" title="These records were not found">
                      {domain.failingRecords.join(', ')}. A new record can take up to an hour to
                      appear everywhere.
                    </Alert>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {board.jobFailures.length === 0 ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Work that was skipped</CardTitle>
            <CardDescription>
              A scheduled job could not finish these and carried on with the rest, which is the
              right behaviour. What is not right is leaving them here: each one is work somebody is
              waiting for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Why it stopped</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {board.jobFailures.map((failure) => (
                  <TableRow key={failure.failureId}>
                    <TableCell>{formatDateTime(failure.occurredAt)}</TableCell>
                    <TableCell>{humanise(failure.jobName)}</TableCell>
                    <TableCell>{humanise(failure.entityType)}</TableCell>
                    <TableCell>{failure.companyName ?? 'The platform itself'}</TableCell>
                    <TableCell>{failure.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent health</CardTitle>
          <CardDescription>
            What the health probe found. An outage should leave a trail rather than an argument.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {board.health.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing has probed this installation yet. Point your monitor at the health endpoint
              and entries appear here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead isNumeric>Database</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Mail</TableHead>
                  <TableHead>Version</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {board.health.map((entry) => (
                  <TableRow key={entry.checkedAt}>
                    <TableCell>{formatDateTime(entry.checkedAt)}</TableCell>
                    <TableCell>
                      <Badge tone={entry.isHealthy ? 'success' : 'danger'}>
                        {entry.isHealthy ? 'Healthy' : 'Degraded'}
                      </Badge>
                    </TableCell>
                    <TableCell isNumeric>
                      {entry.databaseMs === null
                        ? 'Not measured'
                        : `${formatNumber(entry.databaseMs)} ms`}
                    </TableCell>
                    <TableCell>{entry.storageOk === true ? 'Ready' : 'Not configured'}</TableCell>
                    <TableCell>{entry.emailOk === true ? 'Ready' : 'Not configured'}</TableCell>
                    <TableCell>{entry.releaseVersion ?? 'Unknown'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {groups.map((group) => (
        <Card key={group}>
          <CardHeader>
            <CardTitle>{humanise(group)}</CardTitle>
            <CardDescription>
              Changed here and live everywhere within seconds. No deployment, no restart.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {board.settings
              .filter((setting) => setting.settingGroup === group)
              .map((setting) => (
                <div
                  key={setting.settingKey}
                  className="grid gap-3 border-b border-border pb-4 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-end"
                >
                  <FormField
                    id={`setting-${setting.settingKey}`}
                    label={setting.label}
                    hint={setting.description ?? undefined}
                  >
                    <Input
                      id={`setting-${setting.settingKey}`}
                      type={setting.isSecret ? 'password' : 'text'}
                      defaultValue={setting.value}
                      autoComplete="off"
                      onChange={(event) =>
                        setSettingValues({
                          ...settingValues,
                          [setting.settingKey]: event.target.value,
                        })
                      }
                    />
                  </FormField>

                  <Button
                    variant="secondary"
                    isLoading={savingKey === setting.settingKey}
                    loadingLabel="Saving"
                    disabled={settingValues[setting.settingKey] === undefined}
                    onClick={() => void onSaveSetting(setting.settingKey)}
                  >
                    Save
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
