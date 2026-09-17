-- profiles: 본인 프로필 또는 관리자는 전체 프로필을 조회 가능
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- products: 활성 상품은 누구나(익명 포함) 조회 가능
create policy "products_select_active"
  on public.products for select
  using (is_active = true);

-- orders: 본인 결제 내역 또는 관리자는 전체 결제 내역을 조회 가능
-- exists(...) 서브쿼리는 DB(Postgres) 안에서 평가되므로 클라이언트가
-- 어떤 요청을 보내도 조작할 수 없다 — 관리자 전용 조회의 실제 방어선.
create policy "orders_select_own_or_admin"
  on public.orders for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- orders: 본인 명의로 PENDING 상태의 주문만 생성 가능
create policy "orders_insert_own_pending"
  on public.orders for insert
  with check (
    user_id = auth.uid()
    and status = 'PENDING'
  );

-- update/delete 정책은 authenticated 롤에 부여하지 않는다.
-- 결제 상태(PENDING -> PAID/FAILED) 전환은 오직 service_role
-- (confirm-payment Edge Function 내부)만 RLS를 우회해 수행한다.
