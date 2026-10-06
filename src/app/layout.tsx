import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://kdsolutionit.com'),
  title: {
    default: 'KD SOLUTION IT',
    template: '%s | KD SOLUTION IT',
  },
  description: 'Smart Billing for Modern Business',
  openGraph: {
    type: 'website',
    siteName: 'KD SOLUTION IT',
    title: 'KD SOLUTION IT — Smart Billing for Modern Business',
    description:
      'Invoices, payments, clients, and the work around them in one clear operating rhythm.',
  },
  twitter: {
    card: 'summary',
    title: 'KD SOLUTION IT — Smart Billing for Modern Business',
    description: 'A clearer operating rhythm for modern business billing.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
