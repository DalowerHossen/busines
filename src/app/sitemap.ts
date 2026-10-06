import type { MetadataRoute } from 'next';

const PUBLIC_PATHS = [
  '',
  '/features',
  '/pricing',
  '/testimonials',
  '/faq',
  '/merchant-onboarding',
  '/about',
  '/contact',
  '/guides',
  '/blog',
  '/status',
  '/api-docs',
  '/terms',
  '/privacy',
  '/refund',
  '/security',
  '/dpa',
  '/accessibility',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kdsolutionit.com';
  return PUBLIC_PATHS.map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency: path === '/status' ? 'hourly' : 'weekly',
    priority: path === '' ? 1 : path === '/pricing' || path === '/features' ? 0.9 : 0.6,
  }));
}
