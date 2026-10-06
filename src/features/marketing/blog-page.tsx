import Link from 'next/link';
import { ArrowRight, BookOpen, CalendarDays } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';
import { PUBLIC_BLOG_POSTS } from './public-pages-data';

export function BlogPageContent(): ReactNode {
  return (
    <>
      <section className="mx-auto max-w-content px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pt-28">
        <div className="flex items-center gap-3 text-brand-700 dark:text-brand-300">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-[0.18em]">
            The KD SOLUTION IT journal
          </span>
        </div>
        <h1 className="mt-6 max-w-4xl font-heading text-5xl font-semibold tracking-[-0.06em] sm:text-7xl">
          Useful ideas for the work around the work.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          Practical notes about billing operations, accountable payment records, and calmer merchant
          workflows.
        </p>
      </section>
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            {PUBLIC_BLOG_POSTS.map((post, index) => (
              <Card
                key={post.slug}
                className={cn(
                  'border-sidebar-border bg-white/[0.05] text-sidebar-foreground',
                  index === 0 && 'lg:row-span-2'
                )}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-4 text-xs font-bold uppercase tracking-[0.14em] text-brand-300">
                    <span>{post.category}</span>
                    <span>{post.readTime}</span>
                  </div>
                  <CardTitle
                    className={cn(
                      'mt-8 text-2xl text-sidebar-foreground',
                      index === 0 && 'lg:text-4xl'
                    )}
                  >
                    {post.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col">
                  <p className="text-sm leading-7 text-sidebar-muted">{post.excerpt}</p>
                  <span className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-brand-300">
                    Read the perspective <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-surface-muted p-7 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-[0.14em]">Editorial note</span>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Public articles are managed through the platform CMS as that module is brought online.
              The editorial standard is practical, specific, and honest about the workflow boundary.
            </p>
          </div>
          <Link
            href="/contact"
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'shrink-0')}
          >
            Suggest a topic
          </Link>
        </div>
      </section>
    </>
  );
}
