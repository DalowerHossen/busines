// src/components/clients/client-contacts-card.tsx
// The people at the client who receive invoices and reminders.

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClientContactRecord } from '@/features/clients/types';

export interface ClientContactsCardProps {
  /** Contacts held against the client. */
  contacts: readonly ClientContactRecord[];
  /** Email address on the client record itself. */
  fallbackEmail: string | null;
}

/**
 * Renders the contacts of a client.
 *
 * @param props The contacts and the fallback email address.
 * @returns The rendered card.
 */
export function ClientContactsCard({ contacts, fallbackEmail }: ClientContactsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>People</CardTitle>
        <CardDescription>
          Everyone who receives an invoice, a reminder or a statement for this client.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {fallbackEmail === null
              ? 'No one is listed yet, so invoices for this client cannot be emailed.'
              : `Invoices are sent to ${fallbackEmail}, the address on the client record.`}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{contact.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {contact.jobTitle ?? 'No job title recorded'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {contact.email ?? contact.phone ?? 'No contact details recorded'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {contact.isPrimary ? <Badge tone="brand">Primary</Badge> : null}
                  {contact.receivesInvoices ? <Badge tone="neutral">Invoices</Badge> : null}
                  {contact.receivesReminders ? <Badge tone="neutral">Reminders</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
