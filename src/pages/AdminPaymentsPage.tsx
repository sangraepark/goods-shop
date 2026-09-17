import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { OrderStatus } from '../types/database'

type AdminOrderRow = {
  id: string
  order_id: string
  amount: number
  status: OrderStatus
  approved_at: string | null
  user_id: string
  products: { name: string } | null
  profiles: { email: string } | null
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  FAILED: '결제 실패',
}

export function AdminPaymentsPage() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      // 관리자(profiles.is_admin = true) 계정으로 조회하면 RLS 정책이
      // 전체 유저의 행을 반환합니다. 별도의 admin 분기 쿼리가 필요 없습니다.
      const { data, error } = await supabase
        .from('orders')
        .select(
          'id, order_id, amount, status, approved_at, user_id, products(name), profiles(email)',
        )
        .order('created_at', { ascending: false })

      if (!active) return
      if (!error && data) setOrders(data as unknown as AdminOrderRow[])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  if (loading) return <div className="p-8 text-center text-slate-500">불러오는 중...</div>

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">
        전체 결제 내역 (관리자)
      </h1>

      {orders.length === 0 ? (
        <p className="text-sm text-slate-500">결제 내역이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-2">구매자</th>
                <th className="px-4 py-2">상품</th>
                <th className="px-4 py-2">금액</th>
                <th className="px-4 py-2">상태</th>
                <th className="px-4 py-2">주문번호</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-2 text-slate-900">
                    {order.profiles?.email ?? order.user_id}
                  </td>
                  <td className="px-4 py-2 text-slate-900">
                    {order.products?.name ?? '-'}
                  </td>
                  <td className="px-4 py-2 text-slate-900">
                    {order.amount.toLocaleString()}원
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        order.status === 'PAID'
                          ? 'text-green-600'
                          : order.status === 'FAILED'
                            ? 'text-red-600'
                            : 'text-slate-400'
                      }
                    >
                      {STATUS_LABEL[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">
                    {order.order_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
