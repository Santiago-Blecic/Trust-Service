create extension if not exists pgcrypto;
create type public.booking_status as enum ('awaiting_payment','paid','completed','cancelled','disputed');
create type public.payment_status as enum ('pending','confirmed','failed');

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null default 'New member' check (char_length(display_name) between 2 and 80), wallet_address text unique, human_verified_at timestamptz, created_at timestamptz not null default now());
create table public.providers (id uuid primary key references public.profiles(id) on delete cascade, bio text not null default '', wallet_address text not null unique, is_published boolean not null default false, created_at timestamptz not null default now());
create table public.services (id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.providers(id) on delete cascade, slug text not null unique, title text not null, description text not null default '', category text not null, price_cents integer not null check(price_cents between 100 and 1000000), is_active boolean not null default true, created_at timestamptz not null default now());
create table public.bookings (id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles(id), provider_id uuid not null references public.providers(id), service_id uuid not null references public.services(id), scheduled_for timestamptz not null, total_cents integer not null check(total_cents > 0), status public.booking_status not null default 'awaiting_payment', customer_confirmed_at timestamptz, provider_confirmed_at timestamptz, created_at timestamptz not null default now(), completed_at timestamptz, check(customer_id <> provider_id));
create table public.payments (id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references public.bookings(id) on delete cascade, xrpl_transaction_hash text not null unique check(xrpl_transaction_hash ~ '^[A-Fa-f0-9]{64}$'), amount_drops bigint not null check(amount_drops > 0), status public.payment_status not null default 'confirmed', verified_at timestamptz not null default now());
create table public.proofs_of_service (id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references public.bookings(id) on delete restrict, proof_hash text not null unique, payment_transaction_hash text not null unique, review_used_at timestamptz, created_at timestamptz not null default now());
create table public.reviews (id uuid primary key default gen_random_uuid(), proof_id uuid not null unique references public.proofs_of_service(id) on delete restrict, author_id uuid not null references public.profiles(id), provider_id uuid not null references public.providers(id), rating smallint not null check(rating between 1 and 5), body text not null check(char_length(body) between 3 and 2000), created_at timestamptz not null default now());
create index bookings_customer_idx on public.bookings(customer_id); create index bookings_provider_idx on public.bookings(provider_id); create index services_provider_idx on public.services(provider_id); create index reviews_provider_idx on public.reviews(provider_id);

alter table public.profiles enable row level security; alter table public.providers enable row level security; alter table public.services enable row level security; alter table public.bookings enable row level security; alter table public.payments enable row level security; alter table public.proofs_of_service enable row level security; alter table public.reviews enable row level security;
revoke all on all tables in schema public from anon, authenticated;
grant select on public.providers, public.services, public.reviews to anon, authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select on public.bookings, public.payments, public.proofs_of_service to authenticated;
create policy "public sees published providers" on public.providers for select to anon,authenticated using(is_published or id=(select auth.uid()));
create policy "public sees active services" on public.services for select to anon,authenticated using(is_active);
create policy "public sees reviews" on public.reviews for select to anon,authenticated using(true);
create policy "users read own profile" on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy "users create own profile" on public.profiles for insert to authenticated with check(id=(select auth.uid()));
create policy "users update own profile" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy "parties see booking" on public.bookings for select to authenticated using(customer_id=(select auth.uid()) or provider_id=(select auth.uid()));
create policy "parties see payments" on public.payments for select to authenticated using(exists(select 1 from public.bookings b where b.id=booking_id and (b.customer_id=(select auth.uid()) or b.provider_id=(select auth.uid()))));
create policy "parties see proofs" on public.proofs_of_service for select to authenticated using(exists(select 1 from public.bookings b where b.id=booking_id and (b.customer_id=(select auth.uid()) or b.provider_id=(select auth.uid()))));
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles(id,display_name) values(new.id,coalesce(nullif(left(new.raw_user_meta_data->>'display_name',80),''),'New member')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.create_booking(p_service_id uuid,p_scheduled_for timestamptz,p_hours integer) returns public.bookings language plpgsql security definer set search_path = public as $$
declare s public.services; created_booking public.bookings;
begin
  if p_hours not between 1 and 8 or p_scheduled_for <= now() then raise exception 'Invalid booking details'; end if;
  select * into s from public.services where id=p_service_id and is_active=true; if not found then raise exception 'Service unavailable'; end if;
  if s.provider_id=(select auth.uid()) then raise exception 'You cannot book your own service'; end if;
  insert into public.bookings(customer_id,provider_id,service_id,scheduled_for,total_cents) values((select auth.uid()),s.provider_id,s.id,p_scheduled_for,s.price_cents*p_hours) returning * into created_booking;
  return created_booking;
end $$;

create or replace function public.record_verified_payment(p_booking_id uuid,p_tx_hash text,p_amount_drops bigint) returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings; expected_drops bigint;
begin select * into b from public.bookings where id=p_booking_id for update; if not found or b.customer_id<>(select auth.uid()) or b.status<>'awaiting_payment' then raise exception 'Booking is not payable'; end if; expected_drops:=round((b.total_cents::numeric/100)*1000000); if p_amount_drops<>expected_drops then raise exception 'Unexpected payment amount'; end if; insert into public.payments(booking_id,xrpl_transaction_hash,amount_drops) values(p_booking_id,p_tx_hash,p_amount_drops); update public.bookings set status='paid' where id=p_booking_id; end $$;
create or replace function public.confirm_booking_completion(p_booking_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare b public.bookings; proof_id uuid;
begin select * into b from public.bookings where id=p_booking_id for update; if not found or (b.customer_id<>(select auth.uid()) and b.provider_id<>(select auth.uid())) or b.status<>'paid' then raise exception 'Booking cannot be confirmed'; end if; if b.customer_id=(select auth.uid()) then update public.bookings set customer_confirmed_at=now() where id=p_booking_id; else update public.bookings set provider_confirmed_at=now() where id=p_booking_id; end if; select * into b from public.bookings where id=p_booking_id; if b.customer_confirmed_at is not null and b.provider_confirmed_at is not null then update public.bookings set status='completed',completed_at=now() where id=p_booking_id; insert into public.proofs_of_service(booking_id,proof_hash,payment_transaction_hash) select b.id,encode(digest(b.id::text||':'||p.xrpl_transaction_hash||':'||b.completed_at::text,'sha256'),'hex'),p.xrpl_transaction_hash from public.payments p where p.booking_id=b.id returning id into proof_id; end if; return proof_id; end $$;
revoke all on function public.create_booking(uuid,timestamptz,integer), public.record_verified_payment(uuid,text,bigint), public.confirm_booking_completion(uuid) from public;
grant execute on function public.create_booking(uuid,timestamptz,integer), public.record_verified_payment(uuid,text,bigint), public.confirm_booking_completion(uuid) to authenticated;
create or replace function public.publish_verified_review(p_proof_id uuid,p_rating smallint,p_body text) returns uuid language plpgsql security definer set search_path = public as $$
declare p public.proofs_of_service; b public.bookings; review_id uuid;
begin
  if p_rating not between 1 and 5 or char_length(trim(p_body)) not between 3 and 2000 then raise exception 'Invalid review'; end if;
  select * into p from public.proofs_of_service where id=p_proof_id for update; if not found or p.review_used_at is not null then raise exception 'Review authorization unavailable'; end if;
  select * into b from public.bookings where id=p.booking_id; if b.customer_id<>(select auth.uid()) or b.status<>'completed' then raise exception 'You cannot review this service'; end if;
  insert into public.reviews(proof_id,author_id,provider_id,rating,body) values(p.id,b.customer_id,b.provider_id,p_rating,trim(p_body)) returning id into review_id;
  update public.proofs_of_service set review_used_at=now() where id=p.id; return review_id;
end $$;
revoke all on function public.handle_new_user(), public.publish_verified_review(uuid,smallint,text) from public;
grant execute on function public.publish_verified_review(uuid,smallint,text) to authenticated;
