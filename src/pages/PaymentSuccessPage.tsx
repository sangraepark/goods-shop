import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type ConfirmState = 'loading' | 'success' | 'error'

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<ConfirmState>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey')
    const orderId = searchParams.get('orderId')
    const amount = searchParams.get('amount')

    if (!paymentKey || !orderId || !amount) {
      setState('error')
      setMessage('결제 정보가 올바르지 않습니다.')
      return
    }

    supabase.functions
      .invoke('confirm-payment', {
        body: { paymentKey, orderId, amount: Number(amount) },
      })
      .then(({ data, error }) => {
        if (error || !data?.ok) {
          setState('error')
          setMessage(data?.error ?? error?.message ?? '결제 승인에 실패했습니다.')
          return
        }
        setState('success')
      })
  }, [searchParams])

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      {state === 'loading' && <p className="text-slate-500">결제를 확인하는 중...</p>}
      {state === 'success' && (
        <>
          <h1 className="mb-2 text-xl font-semibold text-slate-900">
            결제가 완료되었습니다
          </h1>
          <Link to="/my-payments" className="text-blue-600 underline">
            내 결제 내역 보기
          </Link>
        </>
      )}
      {state === 'error' && (
        <>
          <h1 className="mb-2 text-xl font-semibold text-red-600">
            결제 승인 실패
          </h1>
          <p className="mb-4 text-sm text-slate-500">{message}</p>
          <Link to="/products" className="text-blue-600 underline">
            상품 목록으로 돌아가기
          </Link>
        </>
      )}
    </div>
  )
}
