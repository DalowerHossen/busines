import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient, getAuthenticatedServerUser } from '@/lib/supabase/server';
import { assertTenantAccess } from '@/lib/supabase/tenant';
import {
  ClientDomainError,
  clientImportFailed,
  clientTenantScopeDenied,
} from '@/lib/clients/errors';
import { importClientsFromTabularFile } from '@/lib/clients/import-export';
import { SupabaseClientStore } from '@/lib/clients/supabase-store';
import type { ClientActor } from '@/lib/clients/types';
import type { StaffPermission } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user } = await getAuthenticatedServerUser();
    if (!user) return errorResponse(clientTenantScopeDenied(), 401);
    const companyId = request.headers.get('x-company-id')?.trim() ?? '';
    if (!isUuid(companyId)) return errorResponse(clientTenantScopeDenied(), 403);

    const supabase = await createSupabaseServerClient();
    await assertTenantAccess(supabase, companyId, { write: true });
    const { data: membership, error: membershipError } = await supabase
      .from('company_memberships')
      .select('role, permissions')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();
    if (
      membershipError ||
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'staff')
    ) {
      return errorResponse(clientTenantScopeDenied(), 403);
    }

    const formData = await request.formData();
    const entry = formData.get('file');
    if (!(entry instanceof File)) return errorResponse(clientImportFailed(), 400);
    const buffer = Buffer.from(await entry.arrayBuffer());
    const actor: ClientActor = {
      userId: user.id,
      companyId,
      role: membership.role,
      permissions: Array.isArray(membership.permissions)
        ? membership.permissions.filter(isStaffPermission)
        : [],
    };
    const result = await importClientsFromTabularFile({
      actor,
      file: { fileName: entry.name, mimeType: entry.type, content: buffer },
      store: new SupabaseClientStore(supabase),
    });
    return NextResponse.json({ imported: result.imported }, { status: 201 });
  } catch (error) {
    if (error instanceof ClientDomainError) return errorResponse(error, 400);
    return errorResponse(clientImportFailed(), 400);
  }
}

function errorResponse(error: ClientDomainError, status: number): NextResponse {
  return NextResponse.json({ code: error.code, message: error.message }, { status });
}

function isStaffPermission(value: unknown): value is StaffPermission {
  return (
    typeof value === 'string' &&
    [
      'manage_clients',
      'manage_products',
      'manage_invoices',
      'manage_estimates',
      'manage_expenses',
      'manage_inventory',
      'view_reports',
      'request_send_client_email',
    ].includes(value)
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
