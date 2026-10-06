import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';
import { PublicSiteFrame } from '@/features/marketing';
import { Badge } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';

export default function NotFound(): React.ReactNode {
  return (
    <PublicSiteFrame>
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <SearchX className="h-9 w-9" aria-hidden="true" />
        </div>
        <Badge variant="brand" className="mt-8">
          Page not found
        </Badge>
        <h1 className="mt-5 font-heading text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">
          That page took a wrong turn.
        </h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
          The link may be outdated, or the page may have moved. Start again from the public home
          page or browse the platform.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className={cn(buttonVariants({ size: 'lg' }))}>
            Back to home <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/features" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            Explore features
          </Link>
        </div>
      </main>
    </PublicSiteFrame>
  );
}
