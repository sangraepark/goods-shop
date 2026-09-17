export type Profile = {
  id: string
  email: string
  is_admin: boolean
  created_at: string
}

export type Product = {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_active: boolean
  created_at: string
}

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED'

export type Order = {
  id: string
  user_id: string
  product_id: string
  order_id: string
  amount: number
  status: OrderStatus
  payment_key: string | null
  approved_at: string | null
  created_at: string
}
