-- Historical failed-call refunds predate operation IDs. Link only matching recent
-- debits; leave ambiguous older entries untouched. Never change amounts or balances.
do $$
declare r public.credit_ledger%rowtype; debit_id bigint; debit_operation uuid;
begin
 for r in select * from public.credit_ledger where reason='failed-thought-refund' and delta>0 and refund_of is null order by id loop
  select d.id,coalesce(d.operation_id,gen_random_uuid()) into debit_id,debit_operation
   from public.credit_ledger d
   where d.owner_id=r.owner_id and d.ref is not distinct from r.ref and d.delta=-r.delta
    and d.reason in ('thought','stakes','reflection') and d.id<r.id
    and d.created_at between r.created_at-interval '5 minutes' and r.created_at
    and not exists(select 1 from public.credit_ledger x where x.refund_of=d.operation_id)
   order by d.id desc limit 1 for update;
  if debit_id is not null then
   update public.credit_ledger set operation_id=debit_operation where id=debit_id;
   update public.credit_ledger set operation_id=coalesce(operation_id,gen_random_uuid()),refund_of=debit_operation where id=r.id;
  end if;
 end loop;
end;
$$;
