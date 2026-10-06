import assert from 'node:assert/strict';
import { getNavItemsForRole } from '@/config/navigation';
import { getNavIcon } from '@/components/layouts/nav-icons';
import {
  buildBreadcrumbs,
  flattenNavigation,
  getVisibleNavigation,
} from '@/components/layouts/navigation-utils';

const ownerItems = getVisibleNavigation('owner');
const accountantItems = getVisibleNavigation('accountant');
const adminItems = getVisibleNavigation('super_admin');

assert.ok(ownerItems.some((item) => item.key === 'dashboard'));
assert.ok(!ownerItems.some((item) => item.key === 'affiliate'));
assert.ok(!accountantItems.some((item) => item.key === 'clients'));
assert.ok(adminItems.some((item) => item.key === 'admin'));
assert.equal(getNavItemsForRole('affiliate').length, 1);
assert.ok(flattenNavigation(adminItems).some((item) => item.key === 'admin-kyc'));
assert.deepEqual(
  buildBreadcrumbs('/admin/kyc', 'super_admin').map((item) => item.label),
  ['Super Admin', 'KYC Review']
);
assert.deepEqual(
  buildBreadcrumbs('/invoices/abc?view=details', 'owner').map((item) => item.label),
  ['Invoices', 'Abc']
);
assert.ok(['function', 'object'].includes(typeof getNavIcon('LayoutDashboard')));
assert.ok(['function', 'object'].includes(typeof getNavIcon('UnknownIcon')));

process.stdout.write('Phase 40 layout and role-navigation smoke test passed.\n');
