-- supabase/migrations/00114_grant_project_privileges.sql
-- Table and routine privileges for projects, time tracking and stock.

grant select, insert, update on public.projects to authenticated;
grant select, insert, update on public.project_members to authenticated;
grant select, insert, update on public.project_tasks to authenticated;
grant select, insert, update on public.time_entries to authenticated;
grant select, insert, update on public.timesheets to authenticated;
grant select, insert, update on public.project_milestones to authenticated;
grant select, insert, update on public.retainer_agreements to authenticated;
grant select, insert, update on public.retainer_periods to authenticated;

grant select, insert, update on public.warehouses to authenticated;
grant select, insert, update on public.stock_levels to authenticated;
-- The history is written through the movement routine and never rewritten.
grant select, insert on public.stock_movements to authenticated;
grant select, insert, update on public.stock_counts to authenticated;
grant select, insert, update on public.stock_count_items to authenticated;

-- -----------------------------------------------------------------------------
-- Projects and time
-- -----------------------------------------------------------------------------

grant execute on function public.project_hourly_rate(uuid, uuid) to authenticated;
grant execute on function public.project_cost_rate(uuid, uuid) to authenticated;
grant execute on function public.project_task_summary(uuid) to authenticated;
grant execute on function public.set_task_status(uuid, text) to authenticated;

grant execute on function public.start_time_entry(uuid, text, uuid, boolean)
  to authenticated;
grant execute on function public.stop_time_entry(uuid) to authenticated;
grant execute on function public.log_time_entry(
  uuid, integer, text, date, uuid, boolean
) to authenticated;
grant execute on function public.time_summary(uuid, date, date, uuid)
  to authenticated;

grant execute on function public.build_timesheet(uuid, date) to authenticated;
grant execute on function public.refresh_timesheet_totals(uuid) to authenticated;
grant execute on function public.submit_timesheet(uuid) to authenticated;
grant execute on function public.review_timesheet(uuid, boolean, text)
  to authenticated;

grant execute on function public.complete_milestone(uuid, date) to authenticated;
grant execute on function public.milestone_progress(uuid) to authenticated;

grant execute on function public.open_retainer_period(uuid, date) to authenticated;
grant execute on function public.draw_retainer_hours(uuid, numeric) to authenticated;
grant execute on function public.close_retainer_period(uuid) to authenticated;

grant execute on function public.uninvoiced_project_work(uuid) to authenticated;
grant execute on function public.invoice_project_work(uuid, date, date)
  to authenticated;
grant execute on function public.release_project_work(uuid) to authenticated;
grant execute on function public.project_profitability(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Stock
-- -----------------------------------------------------------------------------

grant execute on function public.default_warehouse_id(uuid) to authenticated;
grant execute on function public.record_stock_movement(
  uuid, public.stock_movement_type, numeric, numeric, uuid, text, uuid, text,
  date, text
) to authenticated;
grant execute on function public.transfer_stock(uuid, uuid, uuid, numeric, text)
  to authenticated;
grant execute on function public.apply_stock_count(uuid) to authenticated;
grant execute on function public.low_stock_report(uuid) to authenticated;
grant execute on function public.inventory_valuation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Reserved for the trusted server layer
-- -----------------------------------------------------------------------------

revoke all on function public.release_invoice_stock(uuid) from anon, authenticated;
revoke all on function public.receive_stock_from_purchase(uuid)
  from anon, authenticated;
revoke all on function public.post_cost_of_goods_sold(uuid) from anon, authenticated;
