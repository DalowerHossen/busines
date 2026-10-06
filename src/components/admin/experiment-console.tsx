// src/components/admin/experiment-console.tsx
// Testing a change on the public site, and reading the result honestly.
//
// The hypothesis field is required before anything can be started. A test
// without one is not a test; it is a search for a number that agrees with a
// decision somebody already made. The conclusion field is required for the
// same reason at the other end.

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
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import {
  concludeExperiment,
  saveExperiment,
  saveExperimentVariant,
  startExperiment,
} from '@/features/experiments/actions/manage-experiments';
import type { ExperimentRow, VariantRow } from '@/features/experiments/types';
import { formatDateTime } from '@/lib/dates';
import { formatNumber, humanise } from '@/lib/format';

export interface ExperimentConsoleProps {
  /** Every test written down. */
  experiments: readonly ExperimentRow[];
  /** The sides of each test. */
  variants: Readonly<Record<string, readonly VariantRow[]>>;
}

const STATUS_TONES: Readonly<Record<string, 'success' | 'warning' | 'neutral'>> = {
  running: 'success',
  draft: 'neutral',
  concluded: 'neutral',
  paused: 'warning',
};

/**
 * Renders the testing console.
 *
 * @param props The tests and their sides.
 * @returns The rendered console.
 */
export function ExperimentConsole({ experiments, variants }: ExperimentConsoleProps) {
  const router = useRouter();

  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [goalEventName, setGoalEventName] = useState('signup_started');
  const [traffic, setTraffic] = useState('100');
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [variantFor, setVariantFor] = useState<string | null>(null);
  const [variantKey, setVariantKey] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantWeight, setVariantWeight] = useState('50');
  const [isControl, setIsControl] = useState(false);

  const [concludingId, setConcludingId] = useState<string | null>(null);
  const [conclusion, setConclusion] = useState('');

  /**
   * Writes down a new test.
   *
   * @returns Nothing.
   */
  async function onSave(): Promise<void> {
    setIsSaving(true);
    setFieldErrors({});

    const result = await saveExperiment({
      key,
      name,
      hypothesis,
      goalEventName,
      trafficPercentage: traffic,
    });

    setIsSaving(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors ?? {});
      notify.error(result.error);

      return;
    }

    notify.success('Written down. Add the two sides before starting it.');
    setKey('');
    setName('');
    setHypothesis('');
    router.refresh();
  }

  /**
   * Adds one side to a test.
   *
   * @param experimentId Test being added to.
   * @returns Nothing.
   */
  async function onAddVariant(experimentId: string): Promise<void> {
    const result = await saveExperimentVariant({
      experimentId,
      key: variantKey,
      name: variantName,
      weight: variantWeight,
      isControl,
    });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Added.');
    setVariantKey('');
    setVariantName('');
    setIsControl(false);
    router.refresh();
  }

  /**
   * Starts splitting traffic on a test.
   *
   * @param experimentId Test being started.
   * @returns Nothing.
   */
  async function onStart(experimentId: string): Promise<void> {
    const result = await startExperiment({ experimentId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Running. It cannot be edited while people are in it.');
    router.refresh();
  }

  /**
   * Finishes a test and records what was decided.
   *
   * @param experimentId Test being concluded.
   * @param winningVariantId The side that won, if one did.
   * @returns Nothing.
   */
  async function onConclude(experimentId: string, winningVariantId?: string): Promise<void> {
    const result = await concludeExperiment({ experimentId, winningVariantId, conclusion });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Finished. What you decided is on the record.');
    setConcludingId(null);
    setConclusion('');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Alert tone="info" title="A test is written down before it is run">
        What you expect to happen goes in before the first visitor sees anything, and what you
        decided goes in at the end. Without both, a test is a way of finding a number that agrees
        with a decision already made.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Write down a test</CardTitle>
          <CardDescription>
            Name the change, say what you expect, and name the thing a visitor has to do for it to
            count as working.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="experiment-key"
              label="Short name"
              hint="Used in the code and the reports, such as hero_wording."
              errors={fieldErrors['key']}
              isRequired
            >
              <Input
                id="experiment-key"
                value={key}
                onChange={(event) => setKey(event.target.value)}
              />
            </FormField>

            <FormField
              id="experiment-name"
              label="What you are changing"
              errors={fieldErrors['name']}
              isRequired
            >
              <Input
                id="experiment-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>

            <FormField
              id="experiment-goal"
              label="What counts as success"
              hint="The event name, such as signup_started."
              errors={fieldErrors['goalEventName']}
              isRequired
            >
              <Input
                id="experiment-goal"
                value={goalEventName}
                onChange={(event) => setGoalEventName(event.target.value)}
              />
            </FormField>

            <FormField
              id="experiment-traffic"
              label="Share of visitors to include"
              hint="A hundred means everybody."
              errors={fieldErrors['trafficPercentage']}
            >
              <Input
                id="experiment-traffic"
                type="number"
                min="1"
                max="100"
                value={traffic}
                onChange={(event) => setTraffic(event.target.value)}
              />
            </FormField>
          </div>

          <FormField
            id="experiment-hypothesis"
            label="What you expect to happen, and why"
            errors={fieldErrors['hypothesis']}
            isRequired
          >
            <Textarea
              id="experiment-hypothesis"
              rows={2}
              value={hypothesis}
              onChange={(event) => setHypothesis(event.target.value)}
            />
          </FormField>

          <Button isLoading={isSaving} loadingLabel="Saving" onClick={() => void onSave()}>
            Write this test down
          </Button>
        </CardContent>
      </Card>

      {experiments.length === 0 ? (
        <EmptyState
          title="No test has been written down"
          description="Write one above. Nothing changes on the public site until you add the two sides and start it."
        />
      ) : (
        <ul className="space-y-4">
          {experiments.map((experiment) => {
            const sides = variants[experiment.experimentId] ?? [];
            const weightTotal = sides.reduce((running, side) => running + side.weight, 0);

            return (
              <li key={experiment.experimentId}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle>{experiment.name}</CardTitle>
                          <Badge tone={STATUS_TONES[experiment.status] ?? 'neutral'}>
                            {humanise(experiment.status)}
                          </Badge>
                          <Badge tone="neutral">{experiment.key}</Badge>
                        </div>
                        <CardDescription>
                          {experiment.hypothesis ?? 'No hypothesis was written down.'}
                        </CardDescription>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {experiment.status === 'draft' ? (
                          <Button
                            variant="secondary"
                            onClick={() => void onStart(experiment.experimentId)}
                          >
                            Start it
                          </Button>
                        ) : null}

                        {experiment.status === 'running' ? (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setConcludingId(
                                concludingId === experiment.experimentId
                                  ? null
                                  : experiment.experimentId
                              )
                            }
                          >
                            {concludingId === experiment.experimentId ? 'Close' : 'Finish it'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="tabular text-sm text-muted-foreground">
                      {`${formatNumber(experiment.totalAssignments)} visitors, ${formatNumber(
                        experiment.totalConversions
                      )} did ${experiment.goalEventName}, on ${formatNumber(
                        experiment.trafficPercentage
                      )}% of traffic${
                        experiment.startedAt === null
                          ? ''
                          : `, since ${formatDateTime(experiment.startedAt)}`
                      }`}
                    </p>

                    {sides.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No sides yet. A test needs at least two, one of them the control.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Side</TableHead>
                            <TableHead isNumeric>Share</TableHead>
                            <TableHead isNumeric>Visitors</TableHead>
                            <TableHead isNumeric>Did the thing</TableHead>
                            <TableHead isNumeric>Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sides.map((side) => (
                            <TableRow key={side.variantId}>
                              <TableCell>
                                {side.name}
                                {side.isControl ? ' (control)' : ''}
                              </TableCell>
                              <TableCell isNumeric>{`${formatNumber(side.weight)}%`}</TableCell>
                              <TableCell isNumeric>{formatNumber(side.assignmentCount)}</TableCell>
                              <TableCell isNumeric>{formatNumber(side.conversionCount)}</TableCell>
                              <TableCell isNumeric>{`${side.conversionRate}%`}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}

                    {experiment.status === 'draft' && weightTotal !== 100 && sides.length > 0 ? (
                      <Alert tone="warning" title="The sides do not add up to the whole">
                        {`They come to ${formatNumber(weightTotal)}%. A test cannot start until every visitor in it lands somewhere.`}
                      </Alert>
                    ) : null}

                    {experiment.conclusion === null ? null : (
                      <Alert tone="info" title="What was decided">
                        {experiment.conclusion}
                      </Alert>
                    )}

                    {experiment.status === 'draft' ? (
                      <div className="space-y-3 border-t border-border pt-4">
                        {variantFor === experiment.experimentId ? (
                          <div className="grid gap-4 sm:grid-cols-4">
                            <FormField
                              id={`variant-key-${experiment.experimentId}`}
                              label="Short name"
                            >
                              <Input
                                id={`variant-key-${experiment.experimentId}`}
                                value={variantKey}
                                onChange={(event) => setVariantKey(event.target.value)}
                              />
                            </FormField>

                            <FormField
                              id={`variant-name-${experiment.experimentId}`}
                              label="What it is"
                            >
                              <Input
                                id={`variant-name-${experiment.experimentId}`}
                                value={variantName}
                                onChange={(event) => setVariantName(event.target.value)}
                              />
                            </FormField>

                            <FormField
                              id={`variant-weight-${experiment.experimentId}`}
                              label="Share of the test"
                            >
                              <Input
                                id={`variant-weight-${experiment.experimentId}`}
                                type="number"
                                min="1"
                                max="100"
                                value={variantWeight}
                                onChange={(event) => setVariantWeight(event.target.value)}
                              />
                            </FormField>

                            <div className="flex items-end">
                              <Checkbox
                                id={`variant-control-${experiment.experimentId}`}
                                label="This is the control"
                                checked={isControl}
                                onChange={(event) => setIsControl(event.target.checked)}
                              />
                            </div>

                            <div className="sm:col-span-4">
                              <Button onClick={() => void onAddVariant(experiment.experimentId)}>
                                Add this side
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => setVariantFor(experiment.experimentId)}
                          >
                            Add a side
                          </Button>
                        )}
                      </div>
                    ) : null}

                    {concludingId === experiment.experimentId ? (
                      <div className="space-y-3 border-t border-border pt-4">
                        <FormField
                          id={`conclusion-${experiment.experimentId}`}
                          label="What did you decide, and why"
                          isRequired
                        >
                          <Textarea
                            id={`conclusion-${experiment.experimentId}`}
                            rows={2}
                            value={conclusion}
                            onChange={(event) => setConclusion(event.target.value)}
                          />
                        </FormField>

                        <div className="flex flex-wrap gap-2">
                          {sides.map((side) => (
                            <Button
                              key={side.variantId}
                              variant="secondary"
                              onClick={() =>
                                void onConclude(experiment.experimentId, side.variantId)
                              }
                            >
                              {`${side.name} won`}
                            </Button>
                          ))}

                          <Button
                            variant="ghost"
                            onClick={() => void onConclude(experiment.experimentId)}
                          >
                            Nothing won
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
