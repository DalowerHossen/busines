import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { exportClientsToCsv } from '@/lib/clients/import-export';
import {
  ClientDomainError,
  clientExportFailed,
  clientTenantScopeDenied,
} from '@/lib/clients/errors';
import { SupabaseClientStore } from '@/lib/clients/supabase-store';
import { createSupabaseServerClient, getAuthenticatedServerUser } from '@/lib/supabase/server';
import { assertTenantAccess } from '@/lib/supabase/tenant';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { user } = await getAuthenticatedServerUser();
    if (!user) return errorResponse(clientTenantScopeDenied(), 401);
    const companyId = request.headers.get('x-company-id')?.trim() ?? '';
    if (!isUuid(companyId)) return errorResponse(clientTenantScopeDenied(), 403);
    const supabase = await createSupabaseServerClient();
    await assertTenantAccess(supabase, companyId);
    const { data: membership, error } = await supabase
      .from('company_memberships')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !membership || (membership.role !== 'owner' && membership.role !== 'staff')) {
      return errorResponse(clientTenantScopeDenied(), 403);
    }
    const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true';
    const clients = await new SupabaseClientStore(supabase).list({ companyId, includeArchived });
    const csv = exportClientsToCsv(clients, { includeArchived });
    return new NextResponse(csv, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': 'attachment; filename="clients.csv"',
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (error) {
    if (error instanceof ClientDomainError) return errorResponse(error, 400);
    return errorResponse(clientExportFailed(), 400);
  }
}

function errorResponse(error: ClientDomainError, status: number): NextResponse {
  return NextResponse.json({ code: error.code, message: error.message }, { status });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
