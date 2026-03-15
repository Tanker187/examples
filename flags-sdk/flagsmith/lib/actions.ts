'use server'

import { revalidatePath } from 'next/cache'
import type { Cart, CartItem } from '@/components/utils/cart-types'
import { getCartId } from './get-cart-id'

// Using a fallback here so we don't need to make the BACKEND_URL part of the env,
// which makes using the template easy..
const BACKEND_URL =
  process.env.BACKEND_URL || 'https://shirt-shop-api.labs.vercel.dev'

export async function delay(ms: number) {
  const MAX_DELAY_MS = 60_000
  const numericMs = Number(ms)
  const safeMs = Math.min(
    MAX_DELAY_MS,
    Math.max(0, Number.isFinite(numericMs) ? numericMs : 0)
  )
  return new Promise((resolve) => setTimeout(resolve, safeMs))
}

export async function getCart(): Promise<Cart> {
  const cartId = await getCartId()

  return fetch(`${BACKEND_URL}/api/cart/${cartId.value}`).then((res) =>
    res.json()
  )
}

export async function addToCart(item: CartItem) {
  const cartId = await getCartId()
  await fetch(`${BACKEND_URL}/api/cart/${cartId.value}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  })
  revalidatePath('/cart')
}

export async function removeFromCart(item: CartItem) {
  const cartId = await getCartId()
  await fetch(`${BACKEND_URL}/api/cart/${cartId.value}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  })
  revalidatePath('/cart')
}
