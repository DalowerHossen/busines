import { PublicSiteFrame } from '@/features/marketing';

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  return <PublicSiteFrame>{children}</PublicSiteFrame>;
}
