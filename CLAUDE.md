# 굿즈샵 프로젝트

작은 굿즈(머천다이즈) 판매 웹사이트. React+Vite SPA를 GitHub Pages(정적 호스팅)에 배포하고, Supabase(Postgres+Auth+Edge Functions)를 백엔드로 사용한다. 결제는 토스페이먼츠 TEST 모드.

**스택**: React + Vite + TypeScript + Tailwind CSS / Supabase / 토스페이먼츠 위젯 SDK / GitHub Pages + GitHub Actions

## 절대 규칙 (Non-negotiable)

1. **관리자·본인 데이터 접근 제어는 Postgres RLS로만 강제한다.** 프론트 코드의 `if (isAdmin)` 같은 체크는 UI 편의를 위한 것일 뿐, 실제 보안 경계가 아니다 — GitHub Pages는 모두에게 같은 정적 JS를 서빙하므로 클라이언트 체크는 우회 가능하다. 접근 제어 버그를 고칠 때 프론트 체크 추가로 "때우지" 말고 `supabase/migrations/0004_rls_policies.sql`의 정책을 고칠 것.
2. **`TOSS_SECRET_KEY`와 Supabase `service_role` 키는 `supabase/functions/confirm-payment`(Edge Function) 안에서만 존재한다.** 프론트엔드 코드, `.env`/`.env.local`, 커밋되는 어떤 파일, GitHub Actions secrets에도 절대 넣지 않는다. `supabase secrets set`으로만 설정한다.

## 더 자세한 내용은 ARCH.md 참고

폴더 구조, DB 스키마/RLS 전체 DDL, 인증·결제 시퀀스, 배포 파이프라인, 환경변수 표는 [ARCH.md](./ARCH.md)에 있다.

## 한눈에 보기

- 마이그레이션: `supabase/migrations/`
- Edge Function: `supabase/functions/confirm-payment/`
- 페이지: `src/pages/`
- 인증 상태: `src/contexts/AuthContext.tsx`
