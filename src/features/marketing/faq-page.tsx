import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
} from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';
import { FAQ_ITEMS } from './marketing-data';

export function FaqPageContent(): ReactNode {
  return (
    <>
      <section className="mx-auto max-w-content px-4 pb-14 pt-20 sm:px-6 lg:px-8 lg:pt-28">
        <Badge variant="brand">Questions, answered</Badge>
        <h1 className="mt-6 max-w-3xl font-heading text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">
          Good questions make better systems.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          A few practical answers about plans, client access, payments, storage, and the way the
          platform keeps boundaries clear.
        </p>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        <Accordion type="single" defaultValue={[]}>
          <div className="rounded-2xl border border-border bg-card px-5 shadow-sm sm:px-7">
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </div>
        </Accordion>
        <div className="mt-10 rounded-2xl bg-sidebar p-8 text-sidebar-foreground sm:p-10">
          <h2 className="font-heading text-2xl font-semibold">Still have a question?</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-sidebar-muted">
            Tell us what you are trying to build and the support team can point you toward the right
            workflow.
          </p>
          <a
            href="mailto:support@kdsolutionit.com"
            className={cn(
              buttonVariants({ variant: 'secondary' }),
              'mt-6 border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-active/20'
            )}
          >
            Contact support <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
      <section className="border-t border-border bg-surface-muted">
        <div className="mx-auto max-w-content px-4 py-14 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">Ready to see it in your own workflow?</p>
          <Link href="/signup" className={cn(buttonVariants({ variant: 'primary' }), 'mt-4')}>
            Create your workspace
          </Link>
        </div>
      </section>
    </>
  );
}
