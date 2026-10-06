// src/components/clients/client-profile-card.tsx
// The reference details of one client: who they are, how to reach them and
// where the invoice is addressed.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClientAddressRecord, ClientDetail } from '@/features/clients/types';
import { findCountry } from '@/config/countries';

export interface ClientProfileCardProps {
  /** Client being shown. */
  client: ClientDetail;
}

/**
 * Writes an address as the lines that appear on an invoice.
 *
 * @param address Address to lay out.
 * @returns The lines of the address.
 */
function toAddressLines(address: ClientAddressRecord): string[] {
  const country = findCountry(address.countryCode);

  return [
    address.attentionTo,
    address.addressLine1,
    address.addressLine2,
    [address.city, address.stateRegion, address.postalCode].filter(Boolean).join(', '),
    country?.name ?? address.countryCode,
  ].filter((line): line is string => typeof line === 'string' && line.trim().length > 0);
}

/**
 * Renders the detail card of a client.
 *
 * @param props The client to show.
 * @returns The rendered card.
 */
export function ClientProfileCard({ client }: ClientProfileCardProps) {
  const billingAddress = client.addresses.find((address) => address.addressType === 'billing');

  const rows: { label: string; value: string }[] = [
    { label: 'Client number', value: client.clientNumber },
    { label: 'Type', value: client.clientType === 'business' ? 'Business' : 'Individual' },
    { label: 'Legal name', value: client.legalName ?? client.displayName },
    { label: 'Main contact', value: client.contactPerson ?? 'Not recorded' },
    { label: 'Email', value: client.email ?? 'Not recorded' },
    { label: 'Telephone', value: client.phone ?? client.mobile ?? 'Not recorded' },
    { label: 'Website', value: client.website ?? 'Not recorded' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</dt>
              <dd className="text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Billing address</h3>
          {billingAddress === undefined ? (
            <p className="text-sm text-muted-foreground">
              No billing address yet. Add one so it prints on the invoice.
            </p>
          ) : (
            <address className="text-sm not-italic text-foreground">
              {toAddressLines(billingAddress).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          )}
        </div>

        {client.portalNotes === null ? null : (
          <div>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
              Notes shown to the client
            </h3>
            <p className="whitespace-pre-line text-sm text-foreground">{client.portalNotes}</p>
          </div>
        )}

        {client.internalNotes === null ? null : (
          <div>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
              Internal notes
            </h3>
            <p className="whitespace-pre-line text-sm text-foreground">{client.internalNotes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
