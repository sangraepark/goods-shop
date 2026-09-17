# 아키텍처 상세

## 왜 이렇게 구성했는가

GitHub Pages는 정적 파일만 서빙하고 서버 런타임이 없다. 따라서 시크릿 키가 필요한 로직(토스페이먼츠 결제 승인)과 접근 제어(관리자만 전체 결제 내역 조회)는 전부 Supabase 쪽(Postgres RLS, Edge Functions)에서 처리한다. 프론트엔드는 순수 클라이언트 SPA로, `supabase-js`를 통해 Supabase에 직접 접속한다.

## 폴더 구조

```
C:\workspace\
├── CLAUDE.md / ARCH.md
├── .env.example                        # 실제 값 없음, 문서용
├── .github\workflows\deploy.yml        # GitHub Pages 배포 워크플로우
├── src\
│   ├── main.tsx, App.tsx               # HashRouter + 라우트 정의
│   ├── lib\supabaseClient.ts           # createClient(url, anonKey)
│   ├── contexts\AuthContext.tsx        # 세션 + is_admin 상태 (useAuth 훅)
│   ├── routes\ProtectedRoute.tsx       # 비로그인 시 /login 리다이렉트
│   ├── routes\AdminRoute.tsx           # 비관리자 시 /products 리다이렉트 (UI 방어선일 뿐)
│   ├── pages\
│   │   ├── AuthPage.tsx                # 로그인/회원가입 탭
│   │   ├── ProductsPage.tsx            # 상품 목록 + 결제 시작
│   │   ├── PaymentSuccessPage.tsx      # 토스 성공 리다이렉트 → confirm-payment 호출
│   │   ├── PaymentFailPage.tsx
│   │   ├── MyPaymentsPage.tsx          # 내 결제 내역 (RLS로 본인 것만 반환)
│   │   └── AdminPaymentsPage.tsx       # 전체 결제 내역 (RLS로 관리자만 전체 반환)
│   └── types\database.ts               # Profile/Product/Order 타입
├── supabase\
│   ├── migrations\
│   │   ├── 0001_init_profiles.sql      # profiles 테이블 + 신규가입 트리거
│   │   ├── 0002_products.sql
│   │   ├── 0003_orders.sql
│   │   ├── 0004_rls_policies.sql       # 핵심 보안 정책
│   │   └── 0005_seed_products.sql      # 샘플 상품 3종
│   └── functions\confirm-payment\index.ts  # 토스 결제 승인 Edge Function
```

## 알려진 이슈 / 다음 작업

- 연결된 Supabase MCP access token으로 `list_tables`/`get_publishable_keys` 호출 시 `Unauthorized`가 반환된다 (`get_project_url`은 성공). 토큰 권한 범위 재확인이 필요하다. 이 때문에 마이그레이션은 아직 실제 DB에 적용되지 않았다 — 아래 "마이그레이션 적용 방법" 참고.
- 토스페이먼츠 TEST API 키(`VITE_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`)는 아직 발급되지 않았다.
- `.env.local`은 아직 생성되지 않았다 (위 토큰 이슈로 anon key를 자동으로 가져오지 못함). 로컬 개발 시 `.env.example`을 복사해 직접 채워야 한다.
- git 저장소는 초기화했지만 GitHub 원격 저장소는 아직 연결하지 않았다 (저장소 이름/공개 여부는 사용자가 결정).

## DB 스키마 + RLS 전체

### profiles
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, is_admin) values (new.id, new.email, false);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();
```
관리자 승격은 앱 코드로 불가능. Studio SQL 에디터에서 수동으로:
```sql
update public.profiles set is_admin = true where email = 'admin@admin.com';
```

### products
```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price integer not null check (price > 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;
```

### orders
```sql
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id),
  order_id text not null unique,
  amount integer not null check (amount > 0),
  status text not null default 'PENDING' check (status in ('PENDING','PAID','FAILED')),
  payment_key text,
  method text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create index orders_user_id_idx on public.orders(user_id);
```

### RLS 정책
```sql
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "products_select_active" on public.products for select
  using (is_active = true);

create policy "orders_select_own_or_admin" on public.orders for select
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "orders_insert_own_pending" on public.orders for insert
  with check (user_id = auth.uid() and status = 'PENDING');
```
`update`/`delete` 정책은 없음 — `authenticated` 롤은 주문 상태를 바꿀 수 없다. 오직 `service_role`(Edge Function 내부)만 RLS를 우회해 `PAID`/`FAILED`로 갱신한다.

## 인증 흐름

1. `AuthContext`가 마운트 시 `supabase.auth.getSession()` 호출, 이후 `onAuthStateChange`로 세션 변화 구독.
2. 세션이 있으면 `profiles.is_admin`을 조회해 `isAdmin` 상태 노출.
3. `AuthPage`: `signUp`/`signInWithPassword` 후 `/products`로 이동.
4. `ProtectedRoute`: 세션 없으면 `/login`으로. `AdminRoute`: `isAdmin`이 false면 `/products`로 (UI 방어선, 실제 방어는 RLS).
5. 관리자 계정(`admin@admin.com`/`superadmin`)은 일반 회원가입으로 생성 후, Studio에서 `is_admin=true`로 수동 승격.

## 결제 흐름 (토스페이먼츠 TEST)

1. `ProductsPage`: "결제하기" 클릭 → `orderId`(UUID) 생성 → 본인 명의 `PENDING` row를 `orders`에 insert.
2. `@tosspayments/payment-widget-sdk`의 `loadPaymentWidget(clientKey, customerKey)`로 위젯 로드 → `renderPaymentMethods()`로 결제수단 UI 렌더링 → 사용자가 "결제하기" 재확인 버튼 클릭 시 `requestPayment({ orderId, orderName, successUrl, failUrl, customerEmail })` 호출.
3. 토스가 `successUrl`(`#/payment/success?paymentKey=...&orderId=...&amount=...`) 또는 `failUrl`로 리다이렉트.
4. `PaymentSuccessPage` → `supabase.functions.invoke('confirm-payment', { body: { paymentKey, orderId, amount } })` 호출 (세션 JWT 자동 첨부).
5. **`confirm-payment` Edge Function**:
   - `Authorization` 헤더로 호출자 인증 (`auth.getUser`)
   - `order_id`로 `PENDING` row 조회, `user_id` 일치 및 상태 확인
   - row에 저장된 `amount`와 요청받은 `amount` 일치 검증 (클라이언트 위변조 방지)
   - 토스 `/v1/payments/confirm`을 `Authorization: Basic base64(TOSS_SECRET_KEY + ':')`로 호출
   - 성공 시 `service_role` 클라이언트로 `status='PAID'`, `payment_key`, `approved_at` 갱신 / 실패 시 `status='FAILED'`
   - `{ ok, order }` 또는 `{ ok:false, error }` 반환
6. `MyPaymentsPage`/`AdminPaymentsPage`는 `orders`를 그대로 `select`만 하면 RLS가 알아서 본인 것/전체를 반환한다.

## 배포 파이프라인 (GitHub Pages)

- `vite.config.ts`의 `base: './'`(상대 경로)로 설정 — 저장소 이름에 상관없이 프로젝트 페이지(`https://<user>.github.io/<repo>/`)에서 정상 동작.
- 라우터는 `HashRouter` 사용 — GitHub Pages는 서버사이드 리라이트가 없어 `BrowserRouter` 사용 시 새로고침이나 직접 URL 접근 시 404가 나기 때문에, 404 트릭 없이 가장 단순하게 회피.
- `.github/workflows/deploy.yml`: `main` 브랜치 push 시 `npm ci && npm run build` 후 `actions/upload-pages-artifact` + `actions/deploy-pages`로 배포. 빌드 시 `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`VITE_TOSS_CLIENT_KEY`를 GitHub Actions Secrets에서 주입.
- 저장소 Settings → Pages → Source를 "GitHub Actions"로 설정해야 한다.
- 저장소 Settings → Secrets and variables → Actions에 위 세 개 값을 등록해야 한다 (전부 공개되어도 안전한 값).

## 환경변수 표

| 변수명 | 위치 | 공개 가능 여부 | 비고 |
|---|---|---|---|
| `VITE_SUPABASE_URL` | 프론트 빌드 (`.env.local`, GH Actions secret) | 공개 가능 | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | 프론트 빌드 | 공개 가능 | RLS가 실제 보안 경계이므로 anon key 자체는 공개되어도 안전 |
| `VITE_TOSS_CLIENT_KEY` | 프론트 빌드 | 공개 가능 | 토스 TEST 클라이언트 키 (`test_ck_...`) |
| `TOSS_SECRET_KEY` | Supabase Edge Function secret (`supabase secrets set`) | **비공개 필수** | 토스 TEST 시크릿 키 (`test_sk_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions 런타임 자동 주입 | **비공개 필수** | RLS 우회용, 수동 설정 불필요 |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` (Edge Function 내부) | Edge Functions 런타임 자동 주입 | 공개 가능 | 함수 내부에서 `Deno.env.get`으로 사용 |

## 마이그레이션 적용 방법

MCP 토큰 이슈로 `mcp__supabase__apply_migration`이 막혀 있다면, 다음 중 하나로 적용한다:

1. `supabase login` → `supabase link --project-ref qqcjcvchcocvbhhrrjpc` → `supabase db push` (Supabase CLI 설치 필요)
2. MCP 토큰이 복구되면 `mcp__supabase__apply_migration`으로 동일 SQL 파일을 순서대로 적용
3. Supabase Studio의 SQL 에디터에 `supabase/migrations/*.sql`을 순서대로(0001→0005) 붙여넣어 실행 (토큰 문제와 무관하게 항상 가능)
