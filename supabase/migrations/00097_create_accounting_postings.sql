-- supabase/migrations/00097_create_accounting_postings.sql
-- Turning documents into ledger entries, and the ledger into reports.
--
-- Each routine is written so that running it twice cannot double post: the
-- entry carries the document it came from, and the routine checks for it
-- first. That matters because webhooks and retries are a fact of life.

-- Posts an issued invoice: receivable up, revenue and tax recognised.
create or replace function public.post_invoice_to_ledger(p_invoice_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_lines jsonb;
  v_receivable uuid;
  v_revenue uuid;
  v_tax uuid;
  v_entry_id uuid;
begin
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id and deleted_at is null;

  if not found or v_invoice.status in ('draft', 'cancelled') then
    return null;
  end if;

  if exists (
    select 1 from public.journal_entries
     where source_type = 'invoice'
       and source_id = p_invoice_id
       and status = 'posted'
       and deleted_at is null
  ) then
    return null;
  end if;

  v_receivable := public.system_account_id(v_invoice.company_id, 'accounts_receivable');
  v_revenue := public.system_account_id(v_invoice.company_id, 'sales_revenue');
  v_tax := public.system_account_id(v_invoice.company_id, 'tax_payable');

  if v_receivable is null or v_revenue is null then
    return null;
  end if;

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_receivable,
      'debit', v_invoice.total_amount,
      'credit', 0,
      'description', 'Invoice ' || v_invoice.invoice_number,
      'client_id', v_invoice.client_id
    ),
    jsonb_build_object(
      'account_id', v_revenue,
      'debit', 0,
      'credit', v_invoice.total_amount - v_invoice.tax_amount,
      'description', 'Revenue on invoice ' || v_invoice.invoice_number,
      'client_id', v_invoice.client_id
    )
  );

  if v_invoice.tax_amount > 0 and v_tax is not null then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_id', v_tax,
        'debit', 0,
        'credit', v_invoice.tax_amount,
        'description', 'Tax on invoice ' || v_invoice.invoice_number,
        'client_id', v_invoice.client_id
      )
    );
  end if;

  v_entry_id := public.post_journal_entry(
    v_invoice.company_id,
    v_lines,
    'Invoice ' || v_invoice.invoice_number,
    v_invoice.issue_date,
    'invoice',
    p_invoice_id,
    v_invoice.invoice_number
  );

  return v_entry_id;
end;
$$;

comment on function public.post_invoice_to_ledger(uuid) is
  'Recognises the revenue and the tax of an issued invoice, once.';

-- Posts a received payment: cash up, receivable down, processing fee expensed.
create or replace function public.post_payment_to_ledger(p_payment_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_lines jsonb;
  v_cash uuid;
  v_receivable uuid;
  v_fees uuid;
  v_net numeric;
begin
  select * into v_payment
    from public.payments
   where id = p_payment_id and deleted_at is null;

  if not found or v_payment.status <> 'succeeded' then
    return null;
  end if;

  if exists (
    select 1 from public.journal_entries
     where source_type = 'payment'
       and source_id = p_payment_id
       and status = 'posted'
       and deleted_at is null
  ) then
    return null;
  end if;

  v_cash := coalesce(
    public.system_account_id(v_payment.company_id, 'bank'),
    public.system_account_id(v_payment.company_id, 'cash')
  );
  v_receivable := public.system_account_id(v_payment.company_id, 'accounts_receivable');
  v_fees := public.system_account_id(v_payment.company_id, 'processing_fees');

  if v_cash is null or v_receivable is null then
    return null;
  end if;

  v_net := v_payment.amount - coalesce(v_payment.gateway_fee_amount, 0);

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_cash,
      'debit', v_net,
      'credit', 0,
      'description', 'Payment received',
      'client_id', v_payment.client_id
    ),
    jsonb_build_object(
      'account_id', v_receivable,
      'debit', 0,
      'credit', v_payment.amount,
      'description', 'Settlement of receivable',
      'client_id', v_payment.client_id
    )
  );

  if coalesce(v_payment.gateway_fee_amount, 0) > 0 and v_fees is not null then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_id', v_fees,
        'debit', v_payment.gateway_fee_amount,
        'credit', 0,
        'description', 'Payment processing fee'
      )
    );
  end if;

  return public.post_journal_entry(
    v_payment.company_id,
    v_lines,
    'Payment received',
    coalesce(v_payment.value_date, v_payment.received_at::date),
    'payment',
    p_payment_id,
    v_payment.payment_number
  );
end;
$$;

comment on function public.post_payment_to_ledger(uuid) is
  'Moves a received payment into cash, clears the receivable, expenses the fee.';

-- Posts an approved expense against the account its category points at.
create or replace function public.post_expense_to_ledger(p_expense_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_expense public.expenses%rowtype;
  v_expense_account uuid;
  v_credit_account uuid;
  v_tax uuid;
  v_lines jsonb;
  v_entry_id uuid;
begin
  select * into v_expense
    from public.expenses
   where id = p_expense_id and deleted_at is null;

  if not found or v_expense.status <> 'approved' then
    return null;
  end if;

  if exists (
    select 1 from public.journal_entries
     where source_type = 'expense'
       and source_id = p_expense_id
       and status = 'posted'
       and deleted_at is null
  ) then
    return null;
  end if;

  v_expense_account := coalesce(
    v_expense.ledger_account_id,
    (select ledger_account_id from public.expense_categories
      where id = v_expense.category_id),
    public.system_account_id(v_expense.company_id, 'software_expense')
  );

  -- Paid on the spot leaves the bank; otherwise the supplier is owed.
  v_credit_account := case
    when v_expense.is_paid then coalesce(
      v_expense.payment_account_id,
      public.system_account_id(v_expense.company_id, 'bank'),
      public.system_account_id(v_expense.company_id, 'cash')
    )
    else public.system_account_id(v_expense.company_id, 'accounts_payable')
  end;

  if v_expense_account is null or v_credit_account is null then
    return null;
  end if;

  v_tax := public.system_account_id(v_expense.company_id, 'tax_payable');

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_expense_account,
      'debit', v_expense.total_amount - v_expense.tax_amount,
      'credit', 0,
      'description', v_expense.description,
      'vendor_id', v_expense.vendor_id,
      'project_id', v_expense.project_id
    ),
    jsonb_build_object(
      'account_id', v_credit_account,
      'debit', 0,
      'credit', v_expense.total_amount,
      'description', v_expense.description,
      'vendor_id', v_expense.vendor_id
    )
  );

  if v_expense.tax_amount > 0 and v_tax is not null then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_id', v_tax,
        'debit', v_expense.tax_amount,
        'credit', 0,
        'description', 'Recoverable tax on ' || v_expense.expense_number
      )
    );
  end if;

  v_entry_id := public.post_journal_entry(
    v_expense.company_id,
    v_lines,
    'Expense ' || v_expense.expense_number,
    v_expense.expense_date,
    'expense',
    p_expense_id,
    v_expense.expense_number
  );

  update public.expenses
     set journal_entry_id = v_entry_id,
         updated_at = now()
   where id = p_expense_id;

  return v_entry_id;
end;
$$;

comment on function public.post_expense_to_ledger(uuid) is
  'Posts an approved expense to its account and to cash or the payable.';

-- Writes off a receivable that is never going to arrive.
create or replace function public.write_off_invoice(
  p_invoice_id uuid,
  p_reason text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_bad_debt uuid;
  v_receivable uuid;
begin
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id and deleted_at is null for update;

  if not found then
    raise exception 'Invoice % was not found', p_invoice_id using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_company_owner(v_invoice.company_id)) then
    raise exception 'Only the account owner can write off a debt'
      using errcode = '42501';
  end if;

  if v_invoice.balance_due <= 0 then
    raise exception 'There is nothing outstanding to write off'
      using errcode = '22023';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Please say why the debt is being written off'
      using errcode = '22023';
  end if;

  v_bad_debt := public.system_account_id(v_invoice.company_id, 'bad_debt');
  v_receivable := public.system_account_id(v_invoice.company_id, 'accounts_receivable');

  update public.invoices
     set status = 'written_off',
         updated_at = now()
   where id = p_invoice_id;

  if v_bad_debt is null or v_receivable is null then
    return null;
  end if;

  return public.post_journal_entry(
    v_invoice.company_id,
    jsonb_build_array(
      jsonb_build_object(
        'account_id', v_bad_debt,
        'debit', v_invoice.balance_due,
        'credit', 0,
        'description', 'Written off: ' || p_reason,
        'client_id', v_invoice.client_id
      ),
      jsonb_build_object(
        'account_id', v_receivable,
        'debit', 0,
        'credit', v_invoice.balance_due,
        'description', 'Receivable written off on ' || v_invoice.invoice_number,
        'client_id', v_invoice.client_id
      )
    ),
    'Write off of invoice ' || v_invoice.invoice_number,
    current_date,
    'write_off',
    p_invoice_id,
    v_invoice.invoice_number
  );
end;
$$;

comment on function public.write_off_invoice(uuid, text) is
  'Closes an uncollectable invoice and charges it to bad debt.';

-- -----------------------------------------------------------------------------
-- Reports
-- -----------------------------------------------------------------------------

-- Income and expenditure over a period, with the result at the end.
create or replace function public.profit_and_loss(
  p_company_id uuid,
  p_from date,
  p_to date
)
returns table (
  section text,
  account_code text,
  account_name text,
  amount numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case a.account_type
           when 'income' then 'Income'
           when 'expense' then
             case when a.account_subtype = 'cost_of_sales'
                  then 'Cost of sales'
                  else 'Expenses'
             end
         end,
         a.code,
         a.name,
         case when a.account_type = 'income'
              then round(coalesce(sum(l.credit_amount - l.debit_amount), 0), 4)
              else round(coalesce(sum(l.debit_amount - l.credit_amount), 0), 4)
         end
    from public.ledger_accounts as a
    join public.journal_lines as l on l.account_id = a.id
    join public.journal_entries as e
      on e.id = l.entry_id
     and e.status = 'posted'
     and e.deleted_at is null
     and e.entry_date between p_from and p_to
   where a.company_id = p_company_id
     and a.account_type in ('income', 'expense')
     and a.deleted_at is null
   group by a.account_type, a.account_subtype, a.code, a.name, a.display_order
   order by a.account_type desc, a.display_order;
$$;

comment on function public.profit_and_loss(uuid, date, date) is
  'Lists income, cost of sales and expenses for a period.';

-- What the business owns and owes on one date.
create or replace function public.balance_sheet(
  p_company_id uuid,
  p_as_of date default current_date
)
returns table (
  section text,
  account_code text,
  account_name text,
  amount numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select initcap(a.account_type::text),
         a.code,
         a.name,
         case when a.account_type = 'asset'
              then round(coalesce(sum(l.debit_amount - l.credit_amount), 0), 4)
              else round(coalesce(sum(l.credit_amount - l.debit_amount), 0), 4)
         end
    from public.ledger_accounts as a
    join public.journal_lines as l on l.account_id = a.id
    join public.journal_entries as e
      on e.id = l.entry_id
     and e.status = 'posted'
     and e.deleted_at is null
     and e.entry_date <= p_as_of
   where a.company_id = p_company_id
     and a.account_type in ('asset', 'liability', 'equity')
     and a.deleted_at is null
   group by a.account_type, a.code, a.name, a.display_order
   order by a.account_type, a.display_order;
$$;

comment on function public.balance_sheet(uuid, date) is
  'Lists assets, liabilities and equity as they stood on one date.';

-- Confirms that the ledger of a tenant balances, which it always should.
create or replace function public.verify_ledger_balance(p_company_id uuid)
returns table (is_balanced boolean, debit_total numeric, credit_total numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select round(coalesce(sum(l.debit_amount), 0), 4)
           = round(coalesce(sum(l.credit_amount), 0), 4),
         round(coalesce(sum(l.debit_amount), 0), 4),
         round(coalesce(sum(l.credit_amount), 0), 4)
    from public.journal_lines as l
    join public.journal_entries as e on e.id = l.entry_id
   where l.company_id = p_company_id
     and e.status = 'posted'
     and e.deleted_at is null;
$$;

comment on function public.verify_ledger_balance(uuid) is
  'Checks that every posted debit of a tenant is answered by a credit.';
