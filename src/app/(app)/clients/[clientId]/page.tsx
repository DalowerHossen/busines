import { notFound } from 'next/navigation';
import { ClientDetailPage, getClient } from '@/features/clients';

export function generateMetadata({ params }: { readonly params: { readonly clientId: string } }) {
  const client = getClient(params.clientId);
  return { title: client ? `${client.displayName} · Clients` : 'Client not found' };
}

export default function ClientDetailRoute({
  params,
}: {
  readonly params: { readonly clientId: string };
}): React.ReactNode {
  const client = getClient(params.clientId);
  if (!client) notFound();
  return <ClientDetailPage client={client} />;
}
