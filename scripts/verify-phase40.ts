import assert from 'node:assert/strict';
import { getNavItemsForRole } from '@/config/navigation';
import { getNavIcon } from '@/components/layout/nav-icons';
import {
  buildBreadcrumbs,
  flattenNavigation,
  getVisibleNavigation,
} from '@/components/layout/navigation-utils';

const ownerItems = getVisibleNavigation('owner');
const accountantItems = getVisibleNavigation('accountant');
const adminItems = getVisibleNavigation('super_admin');

assert.ok(ownerItems.some((item) => item.key === 'dashboard'));
assert.ok(!ownerItems.some((item) => item.key === 'affiliate'));
assert.ok(!accountantItems.some((item) => item.key === 'clients'));
assert.ok(adminItems.some((item) => item.key === 'admin'));
assert.equal(getNavItemsForRole('affiliate').length, 1);
assert.ok(flattenNavigation(adminItems).some((item) => item.key === 'admin-verification'));
assert.deepEqual(
  buildBreadcrumbs('/admin/verification', 'super_admin').map((item) => item.label),
  ['Super Admin', 'KYC Review']
);
assert.deepEqual(
  buildBreadcrumbs('/dashboard/invoices/abc?view=details', 'owner').map((item) => item.label),
  ['Dashboard', 'Invoices', 'Abc']
);
assert.ok(['function', 'object'].includes(typeof getNavIcon('LayoutDashboard')));
assert.ok(['function', 'object'].includes(typeof getNavIcon('UnknownIcon')));

process.stdout.write('Phase 40 layout and role-navigation smoke test passed.\n');
