import { Link, useSearchParams } from 'react-router-dom'

export function PaymentFailPage() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const message = searchParams.get('message')

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-2 text-xl font-semibold text-red-600">결제 실패</h1>
      {code && <p className="text-sm text-slate-500">코드: {code}</p>}
      {message && <p className="mb-4 text-sm text-slate-500">{message}</p>}
      <Link to="/products" className="text-blue-600 underline">
        상품 목록으로 돌아가기
      </Link>
    </div>
  )
}
