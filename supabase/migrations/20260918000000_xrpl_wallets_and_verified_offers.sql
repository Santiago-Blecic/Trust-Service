-- Run this after 20260917000000_proofly.sql. It removes the demo-only publishing path.
alter table public.profiles add column if not exists account_type text check (account_type in ('buyer','provider'));
alter table public.profiles add column if not exists wallet_created_at timestamptz;
alter table public.providers add column if not exists verification_status text not null default 'pending' check (verification_status in ('pending','approved','rejected'));
alter table public.reviews add column if not exists blockchain_mint_transaction_hash text unique check (blockchain_mint_transaction_hash ~ '^[A-Fa-f0-9]{64}$');

revoke insert, update on public.profiles from authenticated;
drop policy if exists "users create own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;

create or replace function public.register_wallet(p_address text, p_account_type text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_address !~ '^r[1-9A-HJ-NP-Za-km-z]{24,34}$' then raise exception 'Invalid XRPL address'; end if;
  if p_account_type not in ('buyer','provider') then raise exception 'Invalid account type'; end if;
  update public.profiles
    set wallet_address = p_address, account_type = p_account_type, wallet_created_at = now()
    where id = (select auth.uid()) and wallet_address is null;
  if not found then raise exception 'A wallet already exists for this account'; end if;
end $$;

create or replace function public.apply_as_provider(p_bio text, p_title text, p_description text, p_category text, p_price_cents integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare profile_record public.profiles; service_id uuid; safe_slug text;
begin
  select * into profile_record from public.profiles where id = (select auth.uid()) for update;
  if not found or profile_record.wallet_address is null or profile_record.account_type <> 'provider' then raise exception 'Create a provider wallet first'; end if;
  if char_length(trim(p_bio)) < 30 or char_length(trim(p_title)) < 3 or char_length(trim(p_description)) < 30 or char_length(trim(p_category)) < 3 or p_price_cents not between 100 and 1000000 then raise exception 'Invalid provider application'; end if;
  insert into public.providers(id,bio,wallet_address,is_published,verification_status)
    values(profile_record.id,trim(p_bio),profile_record.wallet_address,false,'pending')
    on conflict (id) do update set bio=excluded.bio, is_published=false, verification_status='pending';
  safe_slug := lower(regexp_replace(trim(p_title), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(replace(gen_random_uuid()::text,'-',''),8);
  insert into public.services(provider_id,slug,title,description,category,price_cents,is_active)
    values(profile_record.id,safe_slug,trim(p_title),trim(p_description),trim(p_category),p_price_cents,false)
    returning id into service_id;
  return service_id;
end $$;

drop function if exists public.publish_verified_review(uuid,smallint,text);
create function public.publish_verified_review(p_proof_id uuid,p_rating smallint,p_body text,p_blockchain_mint_transaction_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare p public.proofs_of_service; b public.bookings; review_id uuid;
begin
  if p_rating not between 1 and 5 or char_length(trim(p_body)) not between 3 and 2000 then raise exception 'Invalid review'; end if;
  if p_blockchain_mint_transaction_hash !~ '^[A-Fa-f0-9]{64}$' then raise exception 'Invalid blockchain transaction'; end if;
  select * into p from public.proofs_of_service where id=p_proof_id for update; if not found or p.review_used_at is not null then raise exception 'Review authorization unavailable'; end if;
  select * into b from public.bookings where id=p.booking_id; if b.customer_id<>(select auth.uid()) or b.status<>'completed' then raise exception 'You cannot review this service'; end if;
  insert into public.reviews(proof_id,author_id,provider_id,rating,body,blockchain_mint_transaction_hash) values(p.id,b.customer_id,b.provider_id,p_rating,trim(p_body),upper(p_blockchain_mint_transaction_hash)) returning id into review_id;
  update public.proofs_of_service set review_used_at=now() where id=p.id; return review_id;
end $$;

revoke all on function public.register_wallet(text,text), public.apply_as_provider(text,text,text,text,integer), public.publish_verified_review(uuid,smallint,text,text) from public;
grant execute on function public.register_wallet(text,text), public.apply_as_provider(text,text,text,text,integer), public.publish_verified_review(uuid,smallint,text,text) to authenticated;
