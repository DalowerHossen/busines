import { ClientForm, getClient } from '@/features/clients';
import { notFound } from 'next/navigation';

export function generateMetadata({ params }: { readonly params: { readonly clientId: string } }) {
  const client = getClient(params.clientId);
  return { title: client ? `Edit ${client.displayName}` : 'Client not found' };
}

export default function EditClientRoute({
  params,
}: {
  readonly params: { readonly clientId: string };
}): React.ReactNode {
  if (!getClient(params.clientId)) notFound();
  return <ClientForm clientId={params.clientId} />;
}
