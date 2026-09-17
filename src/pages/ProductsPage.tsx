import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import type { Product } from '../types/database'

const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY as
  | string
  | undefined

// @tosspayments/payment-widget-sdk의 위젯 인스턴스는 결제수단 UI를 DOM에
// 렌더링한 뒤 requestPayment()를 호출하는 방식이라, 상품 카드 버튼 하나로
// 바로 결제창을 띄우는 대신 선택된 상품 아래에 결제수단 패널을 펼칩니다.
type PaymentWidgetInstance = {
  renderPaymentMethods: (selector: string, amount: { value: number }) => void
  requestPayment: (params: {
    orderId: string
    orderName: string
    successUrl: string
    failUrl: string
    customerEmail?: string
  }) => Promise<void>
}

export function ProductsPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const widgetRef = useRef<PaymentWidgetInstance | null>(null)
  const orderIdRef = useRef<string>('')

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (!active) return
      if (!error && data) setProducts(data)
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  async function startCheckout(product: Product) {
    setCheckoutError(null)
    setCheckoutProduct(product)
    widgetRef.current = null

    if (!TOSS_CLIENT_KEY) {
      setCheckoutError(
        '토스페이먼츠 클라이언트 키(VITE_TOSS_CLIENT_KEY)가 설정되지 않았습니다.',
      )
      return
    }
    if (!user) return

    setPreparing(true)
    try {
      const orderId = crypto.randomUUID()
      orderIdRef.current = orderId

      const { error: insertError } = await supabase.from('orders').insert({
        user_id: user.id,
        product_id: product.id,
        order_id: orderId,
        amount: product.price,
        status: 'PENDING',
      })
      if (insertError) throw insertError

      const { loadPaymentWidget } = await import(
        '@tosspayments/payment-widget-sdk'
      )
      const widget = await loadPaymentWidget(TOSS_CLIENT_KEY, user.id)
      widget.renderPaymentMethods('#toss-payment-method', {
        value: product.price,
      })
      widgetRef.current = widget as unknown as PaymentWidgetInstance
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : '결제 준비 중 오류가 발생했습니다.',
      )
    } finally {
      setPreparing(false)
    }
  }

  async function confirmCheckout() {
    if (!checkoutProduct || !widgetRef.current) return
    setCheckoutError(null)

    const base = `${location.origin}${location.pathname}`
    try {
      await widgetRef.current.requestPayment({
        orderId: orderIdRef.current,
        orderName: checkoutProduct.name,
        successUrl: `${base}#/payment/success`,
        failUrl: `${base}#/payment/fail`,
        customerEmail: user?.email,
      })
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : '결제 요청 중 오류가 발생했습니다.',
      )
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">상품을 불러오는 중...</div>
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">상품 목록</h1>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="h-40 w-full object-cover"
              />
            )}
            <div className="flex flex-1 flex-col gap-2 p-4">
              <h2 className="font-medium text-slate-900">{product.name}</h2>
              {product.description && (
                <p className="text-sm text-slate-500">{product.description}</p>
              )}
              <p className="mt-auto text-lg font-semibold text-slate-900">
                {product.price.toLocaleString()}원
              </p>
              <button
                type="button"
                onClick={() => startCheckout(product)}
                className="mt-2 rounded-md bg-slate-900 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                결제하기
              </button>
            </div>
          </div>
        ))}
      </div>

      {checkoutProduct && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 font-medium text-slate-900">
            {checkoutProduct.name} — {checkoutProduct.price.toLocaleString()}원 결제
          </h3>
          {preparing && <p className="text-sm text-slate-500">결제 위젯을 불러오는 중...</p>}
          {checkoutError && (
            <p className="mb-3 text-sm text-red-600">{checkoutError}</p>
          )}
          <div id="toss-payment-method" />
          {!preparing && widgetRef.current && (
            <button
              type="button"
              onClick={confirmCheckout}
              className="mt-4 w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              {checkoutProduct.price.toLocaleString()}원 결제하기
            </button>
          )}
        </div>
      )}
    </div>
  )
}
