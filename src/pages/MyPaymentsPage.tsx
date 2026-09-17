import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { OrderStatus } from '../types/database'

type MyOrderRow = {
  id: string
  order_id: string
  amount: number
  status: OrderStatus
  approved_at: string | null
  products: { name: string; image_url: string | null } | null
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  FAILED: '결제 실패',
}

export function MyPaymentsPage() {
  const [orders, setOrders] = useState<MyOrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      // RLS(orders_select_own_or_admin) 정책이 본인 행만 반환하도록 강제하므로
      // 여기서 user_id로 추가 필터링할 필요가 없습니다.
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_id, amount, status, approved_at, products(name, image_url)')
        .order('created_at', { ascending: false })

      if (!active) return
      if (!error && data) setOrders(data as unknown as MyOrderRow[])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  if (loading) return <div className="p-8 text-center text-slate-500">불러오는 중...</div>

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">내 결제 내역</h1>

      {orders.length === 0 ? (
        <p className="text-sm text-slate-500">결제 내역이 없습니다.</p>
      ) : (
        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {orders.map((order) => (
            <div key={order.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-slate-900">
                  {order.products?.name ?? '상품 정보 없음'}
                </p>
                <p className="text-xs text-slate-400">{order.order_id}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-900">
                  {order.amount.toLocaleString()}원
                </p>
                <p
                  className={`text-xs ${
                    order.status === 'PAID'
                      ? 'text-green-600'
                      : order.status === 'FAILED'
                        ? 'text-red-600'
                        : 'text-slate-400'
                  }`}
                >
                  {STATUS_LABEL[order.status]}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
