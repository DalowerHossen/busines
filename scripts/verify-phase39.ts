import assert from 'node:assert/strict';
import {
  Accordion,
  Dialog,
  DropdownMenu,
  Popover,
  RadioGroup,
  Sheet,
  Switch,
  Tabs,
  Tooltip,
} from '@/components/ui';

for (const primitive of [
  Accordion,
  Dialog,
  DropdownMenu,
  Popover,
  RadioGroup,
  Sheet,
  Switch,
  Tabs,
  Tooltip,
]) {
  assert.ok(typeof primitive === 'function' || typeof primitive === 'object');
}

process.stdout.write('Phase 39 UI primitive smoke test passed.\n');
