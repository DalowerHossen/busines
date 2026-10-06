'use client';

import { ArrowLeft, Check, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui';
import { CLIENT_GROUPS } from './clients-data';

export function ClientForm({ clientId }: { readonly clientId?: string }): ReactNode {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(clientId ? 'Acme Studio' : '');
  const [email, setEmail] = useState(clientId ? 'hello@acmestudio.example' : '');
  const [phone, setPhone] = useState(clientId ? '+1 415 555 0188' : '');
  const [currency, setCurrency] = useState('USD');
  const [group, setGroup] = useState('');
  const [notes, setNotes] = useState('');

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => router.push(clientId ? `/clients/${clientId}` : '/clients'), 450);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <header className="flex items-start gap-3 border-b border-border pb-6">
        <Link
          href={clientId ? `/clients/${clientId}` : '/clients'}
          className="mt-1 rounded-md p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          aria-label="Back to clients"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Client workspace
          </div>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.045em]">
            {clientId ? 'Edit client' : 'Add a client'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Capture billing details once, then use the client record as the source of truth for
            future work.
          </p>
        </div>
      </header>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact details</CardTitle>
            <CardDescription>
              These details are used for invoices and client communication.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="client-name" required>
                Display name
              </Label>
              <Input
                id="client-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Studio"
                required
                maxLength={160}
              />
            </div>
            <div>
              <Label htmlFor="client-email" required>
                Email address
              </Label>
              <Input
                id="client-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="billing@example.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="client-phone">Phone number</Label>
              <Input
                id="client-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+1 555 000 0000"
              />
            </div>
            <div>
              <Label htmlFor="client-currency" required>
                Default currency
              </Label>
              <Select
                id="client-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="BDT">BDT — Bangladeshi Taka</option>
                <option value="GBP">GBP — Pound Sterling</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="client-group">Group</Label>
              <Select
                id="client-group"
                value={group}
                onChange={(event) => setGroup(event.target.value)}
              >
                <option value="">No group</option>
                {CLIENT_GROUPS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Internal context</CardTitle>
            <CardDescription>
              Private notes are visible only to your workspace team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="client-notes">Notes</Label>
            <Textarea
              id="client-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add useful context for the team"
              maxLength={10000}
            />
          </CardContent>
        </Card>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {saved ? (
            <span role="status" className="text-sm font-medium text-success-foreground">
              Client saved securely.
            </span>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(clientId ? `/clients/${clientId}` : '/clients')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={saved}
            loadingLabel="Saving"
            leftIcon={!saved ? <Check className="h-4 w-4" aria-hidden="true" /> : undefined}
          >
            {saved ? 'Saved' : clientId ? 'Save changes' : 'Create client'}
          </Button>
        </div>
      </form>
    </div>
  );
}
