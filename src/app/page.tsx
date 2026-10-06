import { HomePageContent, PublicSiteFrame } from '@/features/marketing';

export const metadata = { title: 'Smart Billing for Modern Business' };

export default function HomePage(): React.ReactNode {
  return (
    <PublicSiteFrame>
      <HomePageContent />
    </PublicSiteFrame>
  );
}
