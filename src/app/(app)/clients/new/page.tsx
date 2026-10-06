import { ClientForm } from '@/features/clients';

export const metadata = { title: 'Add client' };

export default function NewClientRoute(): React.ReactNode {
  return <ClientForm />;
}
