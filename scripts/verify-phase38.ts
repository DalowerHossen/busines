import assert from 'node:assert/strict';
import { badgeVariants, buttonVariants } from '@/components/ui';
import { cn } from '@/lib/utils';

assert.match(buttonVariants({ variant: 'primary', size: 'lg' }), /bg-primary/u);
assert.match(buttonVariants({ variant: 'danger', size: 'sm' }), /bg-destructive/u);
assert.match(badgeVariants({ variant: 'success' }), /bg-success-subtle/u);
assert.equal(cn('rounded-md', 'rounded-xl', 'text-foreground'), 'rounded-xl text-foreground');

process.stdout.write('Phase 38 UI primitive smoke test passed.\n');
