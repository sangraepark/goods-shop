// Supabase Edge Function: 토스페이먼츠 결제 승인
//
// 이 함수만이 TOSS_SECRET_KEY와 service_role 키를 다룬다. 프론트엔드는
// 절대 이 값들을 알아서는 안 된다.
//
// 필요한 시크릿 (supabase secrets set 로 설정):
//   TOSS_SECRET_KEY   - 토스페이먼츠 TEST 시크릿 키
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY는
// Edge Functions 런타임이 자동으로 주입한다.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOSS_SECRET_KEY = Deno.env.get('TOSS_SECRET_KEY')!

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ ok: false, error: '인증 정보가 없습니다.' }, 401)
  }

  let body: { paymentKey?: string; orderId?: string; amount?: number }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: '잘못된 요청 본문입니다.' }, 400)
  }

  const { paymentKey, orderId, amount } = body
  if (!paymentKey || !orderId || typeof amount !== 'number') {
    return json({ ok: false, error: '필수 파라미터가 누락되었습니다.' }, 400)
  }

  // 호출자 신원 확인 (RLS를 사용하는 일반 클라이언트)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return json({ ok: false, error: '사용자 인증에 실패했습니다.' }, 401)
  }

  // service_role 클라이언트: RLS를 우회해 상태를 직접 갱신하기 위함
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select('id, user_id, amount, status')
    .eq('order_id', orderId)
    .single()

  if (orderError || !order) {
    return json({ ok: false, error: '주문 정보를 찾을 수 없습니다.' }, 404)
  }
  if (order.user_id !== user.id) {
    return json({ ok: false, error: '본인의 주문이 아닙니다.' }, 403)
  }
  if (order.status !== 'PENDING') {
    return json({ ok: false, error: '이미 처리된 주문입니다.' }, 409)
  }
  if (order.amount !== amount) {
    return json({ ok: false, error: '결제 금액이 일치하지 않습니다.' }, 400)
  }

  const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${TOSS_SECRET_KEY}:`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  })

  const tossData = await tossRes.json()

  if (!tossRes.ok) {
    await adminClient
      .from('orders')
      .update({ status: 'FAILED' })
      .eq('id', order.id)

    return json(
      { ok: false, error: tossData?.message ?? '토스 결제 승인에 실패했습니다.' },
      400,
    )
  }

  const { data: updatedOrder, error: updateError } = await adminClient
    .from('orders')
    .update({
      status: 'PAID',
      payment_key: paymentKey,
      method: tossData?.method ?? null,
      approved_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .select()
    .single()

  if (updateError) {
    return json({ ok: false, error: '결제 상태 업데이트에 실패했습니다.' }, 500)
  }

  return json({ ok: true, order: updatedOrder })
})
