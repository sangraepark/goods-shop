-- 회원 프로필 테이블: auth.users 1:1, is_admin 플래그로 관리자 여부를 구분한다.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- auth.users에 새 유저가 생기면 자동으로 profiles row를 생성한다.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (new.id, new.email, false);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- is_admin은 이 마이그레이션 이후 앱 코드에서 절대 변경할 수 없다.
-- 관리자 승격은 Supabase Studio에서 수동 SQL로만 수행한다:
--   update public.profiles set is_admin = true where email = 'admin@admin.com';
