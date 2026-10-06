// src/components/contracts/contract-editor.tsx
// Writing an agreement: the wording to start from, what it is worth, when it
// runs, and the people who have to put their name to it.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { saveContract } from '@/features/contracts/actions/save-contract';
import { setContractSigners } from '@/features/contracts/actions/set-signers';
import type { ClientChoice } from '@/features/contracts/queries/list-client-choices';
import type { ContractDetailRecord, ContractWordingChoice } from '@/features/contracts/types';

export interface ContractEditorProps {
  /** The wording the business can start from. */
  wording: readonly ContractWordingChoice[];
  /** The clients an agreement can be attached to. */
  clients: readonly ClientChoice[];
  /** The agreement being edited, or nothing when it is new. */
  contract: ContractDetailRecord | null;
  /** Currency used when none is chosen. */
  baseCurrency: string;
}

interface SignerDraft {
  fullName: string;
  email: string;
  roleLabel: string;
  isInternal: boolean;
}

/**
 * Builds the starting list of parties.
 *
 * @param contract The agreement being edited, if there is one.
 * @returns The parties already named, or one empty row.
 */
function startingSigners(contract: ContractDetailRecord | null): SignerDraft[] {
  if (contract === null || contract.signers.length === 0) {
    return [{ fullName: '', email: '', roleLabel: 'Client', isInternal: false }];
  }

  return contract.signers.map((signer) => ({
    fullName: signer.fullName,
    email: signer.email,
    roleLabel: signer.roleLabel,
    isInternal: signer.isInternal,
  }));
}

/**
 * Renders the agreement editor.
 *
 * @param props The wording, the clients and the agreement being edited.
 * @returns The rendered editor.
 */
export function ContractEditor({ wording, clients, contract, baseCurrency }: ContractEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(contract?.title ?? '');
  const [clientId, setClientId] = useState(contract?.clientId ?? '');
  const [bodyHtml, setBodyHtml] = useState(contract?.bodyHtml ?? '');
  const [currency, setCurrency] = useState(contract?.currency ?? baseCurrency);
  const [contractValue, setContractValue] = useState(contract?.contractValue ?? '');
  const [effectiveDate, setEffectiveDate] = useState(contract?.effectiveDate ?? '');
  const [expiryDate, setExpiryDate] = useState(contract?.expiryDate ?? '');
  const [orderEnforced, setOrderEnforced] = useState(contract?.signingOrderEnforced ?? false);
  const [notes, setNotes] = useState(contract?.notes ?? '');
  const [signers, setSigners] = useState<SignerDraft[]>(startingSigners(contract));
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const clientOptions = [
    { value: '', label: 'Not attached to a client' },
    ...clients.map((client) => ({ value: client.clientId, label: client.displayName })),
  ];

  const wordingOptions = [
    { value: '', label: 'Start from a blank page' },
    ...wording.map((choice) => ({ value: choice.templateKey, label: choice.name })),
  ];

  /**
   * Fills the wording from one of the templates on offer.
   *
   * @param templateKey The wording chosen.
   * @returns Nothing.
   */
  function onPickWording(templateKey: string): void {
    const chosen = wording.find((choice) => choice.templateKey === templateKey);

    if (chosen) {
      setBodyHtml(chosen.bodyHtml);

      if (title.trim() === '') {
        setTitle(chosen.name);
      }
    }
  }

  /**
   * Changes one field of one party.
   *
   * @param index Row being edited.
   * @param key Field that changed.
   * @param value The new value.
   * @returns Nothing.
   */
  function onSignerChange(index: number, key: keyof SignerDraft, value: string | boolean): void {
    setSigners(
      signers.map((signer, position) => (position === index ? { ...signer, [key]: value } : signer))
    );
  }

  /**
   * Saves the agreement and the people who have to sign it.
   *
   * @returns Nothing.
   */
  async function onSave(): Promise<void> {
    setIsSaving(true);
    setFailure(null);

    const saved = await saveContract({
      contractId: contract?.contractId,
      title,
      bodyHtml,
      clientId: clientId === '' ? undefined : clientId,
      currency: currency === '' ? undefined : currency.toUpperCase(),
      contractValue: contractValue === '' ? undefined : contractValue,
      effectiveDate: effectiveDate === '' ? undefined : effectiveDate,
      expiryDate: expiryDate === '' ? undefined : expiryDate,
      signingOrderEnforced: orderEnforced,
      notes: notes === '' ? undefined : notes,
    });

    if (!saved.success) {
      setIsSaving(false);
      setFailure(saved.error);

      return;
    }

    const named = signers.filter(
      (signer) => signer.fullName.trim() !== '' && signer.email.trim() !== ''
    );

    if (named.length > 0) {
      const result = await setContractSigners({
        contractId: saved.data.contractId,
        signers: named.map((signer, index) => ({
          fullName: signer.fullName.trim(),
          email: signer.email.trim(),
          roleLabel: signer.roleLabel.trim() === '' ? 'Client' : signer.roleLabel.trim(),
          signingOrder: index + 1,
          isInternal: signer.isInternal,
        })),
      });

      if (!result.success) {
        setIsSaving(false);
        setFailure(result.error);

        return;
      }
    }

    setIsSaving(false);
    notify.success('That agreement is saved.');
    router.push(`${ROUTES.contracts}/${saved.data.contractId}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {failure === null ? null : (
        <Alert tone="danger" title="That could not be saved">
          {failure}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What is being agreed</CardTitle>
          <CardDescription>
            Start from wording the platform ships with, or write your own. Once the agreement is
            sent the wording is frozen, which is what makes a signature mean something.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Title</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Client</span>
              <Select
                value={clientId}
                options={clientOptions}
                onChange={(event) => setClientId(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Start from</span>
              <Select
                value=""
                options={wordingOptions}
                onChange={(event) => onPickWording(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Currency</span>
              <Input
                value={currency}
                maxLength={3}
                onChange={(event) => setCurrency(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Value</span>
              <Input
                inputMode="decimal"
                value={contractValue}
                onChange={(event) => setContractValue(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Starts on</span>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Ends on</span>
              <Input
                type="date"
                value={expiryDate}
                onChange={(event) => setExpiryDate(event.target.value)}
              />
            </label>
          </div>

          <label className="space-y-1 text-sm">
            <span className="font-medium">The wording</span>
            <Textarea
              rows={14}
              value={bodyHtml}
              onChange={(event) => setBodyHtml(event.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Private note</span>
            <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>

          <Switch
            checked={orderEnforced}
            onCheckedChange={setOrderEnforced}
            label="Signatures must be collected in the order listed below"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who has to sign</CardTitle>
          <CardDescription>
            Each person gets their own private link. Nobody can be added once the agreement has gone
            out.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {signers.map((signer, index) => (
            <div key={`signer-${String(index)}`} className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Full name</span>
                <Input
                  value={signer.fullName}
                  onChange={(event) => onSignerChange(index, 'fullName', event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Email</span>
                <Input
                  type="email"
                  value={signer.email}
                  onChange={(event) => onSignerChange(index, 'email', event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Signing as</span>
                <Input
                  value={signer.roleLabel}
                  onChange={(event) => onSignerChange(index, 'roleLabel', event.target.value)}
                />
              </label>
              <div className="flex items-end gap-2">
                <Switch
                  checked={signer.isInternal}
                  onCheckedChange={(checked) => onSignerChange(index, 'isInternal', checked)}
                  label="Our side"
                />
                {signers.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setSigners(signers.filter((_entry, position) => position !== index))
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setSigners([
                ...signers,
                { fullName: '', email: '', roleLabel: 'Client', isInternal: false },
              ])
            }
          >
            Add another party
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          isLoading={isSaving}
          loadingLabel="Saving"
          onClick={() => void onSave()}
        >
          Save the agreement
        </Button>
      </div>
    </div>
  );
}
