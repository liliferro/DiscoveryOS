-- Server-only persistence for the cloud MVP. No browser role can read application state.
create table if not exists public.discovery_app_state (
  id text primary key check (char_length(id) between 1 and 80),
  revision bigint not null default 0 check (revision >= 0),
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.discovery_app_state enable row level security;
revoke all on public.discovery_app_state from public, anon, authenticated;
grant select, insert, update on public.discovery_app_state to service_role;

create table if not exists public.discovery_memberships (
  namespace text not null default 'production',
  tenant_id text not null check (tenant_id in ('mood','norte','dental')),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','analyst')),
  active boolean not null default true,
  primary key (namespace, tenant_id, user_id)
);
alter table public.discovery_memberships enable row level security;
revoke all on public.discovery_memberships from public, anon, authenticated;
grant select on public.discovery_memberships to authenticated;
grant select, insert, update, delete on public.discovery_memberships to service_role;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='discovery_memberships' and policyname='discovery_membership_self_read') then
    create policy discovery_membership_self_read on public.discovery_memberships
    for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end $$;
create index if not exists discovery_memberships_user on public.discovery_memberships(user_id,namespace);
create table if not exists public.discovery_owner_invites (
  namespace text not null default 'production',
  email text not null check (email = lower(email)),
  tenant_id text not null check (tenant_id in ('mood','norte','dental')),
  claimed_by uuid references auth.users(id),
  primary key (namespace,email,tenant_id)
);
alter table public.discovery_owner_invites enable row level security;
revoke all on public.discovery_owner_invites from public,anon,authenticated;
grant select,insert,update on public.discovery_owner_invites to service_role;
create or replace function public.discovery_claim_owner(p_namespace text,p_email text,p_user_id uuid,p_tenant_id text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.discovery_owner_invites set claimed_by=p_user_id
  where namespace=p_namespace and email=lower(p_email) and tenant_id=p_tenant_id and claimed_by is null;
  if found then
    insert into public.discovery_memberships(namespace,tenant_id,user_id,role,active)
    values(p_namespace,p_tenant_id,p_user_id,'owner',true);
  end if;
end;
$$;
revoke all on function public.discovery_claim_owner(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.discovery_claim_owner(text,text,uuid,text) to service_role;
notify pgrst, 'reload schema';
