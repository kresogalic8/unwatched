-- Run against the migrated database. Fixtures and transactions are rolled back.
begin;
do $$
declare owner text:='subscription-test-'||gen_random_uuid(); op uuid:=gen_random_uuid(); refund uuid:=gen_random_uuid(); r jsonb; blocked boolean:=false;
begin
 insert into owner_wallets(owner_id,plan,credits) values(owner,'visitor',100);
 r:=change_credits(owner,-4,'stakes','fixture',op);
 if (r->>'ok')::boolean then raise exception 'Extra spending must default off'; end if;
 insert into credit_settings(owner_id,auto_spend,daily_limit) values(owner,true,5);
 r:=change_credits(owner,-4,'stakes','fixture',op);
 if not (r->>'ok')::boolean or (r->>'credits')::int<>96 then raise exception 'Debit failed'; end if;
 r:=change_credits(owner,-4,'stakes','fixture',op);
 if (r->>'credits')::int<>96 then raise exception 'Duplicate debit'; end if;
 r:=change_credits(owner,-4,'stakes','fixture',gen_random_uuid());
 if (r->>'ok')::boolean then raise exception 'Daily cap exceeded'; end if;
 r:=change_credits(owner,4,'failed-thought-refund','fixture',refund,op);
 r:=change_credits(owner,4,'failed-thought-refund','fixture',gen_random_uuid(),op);
 if (r->>'credits')::int<>100 then raise exception 'Refund was not idempotent'; end if;
 if (credit_spending(owner)->>'spentToday')::int<>0 then raise exception 'Refund did not restore daily limit'; end if;
 perform change_credits(owner,100,'purchase','fixture-checkout',gen_random_uuid());
 r:=change_credits(owner,100,'purchase','fixture-checkout',gen_random_uuid());
 if (r->>'credits')::int<>200 then raise exception 'Duplicate checkout grant'; end if;
 perform claim_subscription_citizen(owner,owner||'-a');
 perform claim_subscription_citizen(owner,owner||'-a');
 begin perform claim_subscription_citizen(owner,owner||'-b');exception when others then blocked:=true;end;
 if not blocked then raise exception 'Second citizen admitted';end if;
 if subscription_available(owner,owner||'-b') then raise exception 'Second seat shown as available';end if;
 if not subscription_available(owner,owner||'-a') then raise exception 'Existing seat cannot resume';end if;
 if has_function_privilege('anon','public.change_credits(text,integer,text,text,uuid,uuid)','execute') or has_function_privilege('authenticated','public.claim_subscription_citizen(text,text,text)','execute') then raise exception 'Private billing RPC exposed';end if;
 if has_table_privilege('authenticated','public.credit_settings','insert') or has_table_privilege('anon','public.subscription_citizens','select') then raise exception 'Private billing table exposed';end if;
end;
$$;
rollback;
