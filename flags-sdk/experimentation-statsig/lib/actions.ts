'use server'

import { revalidatePath } from 'next/cache'
import type { Cart, CartItem } from '@/components/utils/cart-types'
import { delayFlag } from '@/flags'
import { getCartId } from './get-cart-id'

// Using a fallback here so we don't need to make the BACKEND_URL part of the env,
// which makes using the template easy..
const BACKEND_URL =
  process.env.BACKEND_URL || 'https://shirt-shop-api.labs.vercel.dev'

export async function delay(ms: number) {
  const MAX_DELAY_MS = 1000
  let safeMs = Number.isFinite(ms) ? ms : 0
  if (safeMs < 0) {
    safeMs = 0
  } else if (safeMs > MAX_DELAY_MS) {
    safeMs = MAX_DELAY_MS
  }
  return new Promise((resolve) => setTimeout(resolve, safeMs))
}

export async function getCart(): Promise<Cart> {
  const cartId = await getCartId()
  const delayMs = await delayFlag()
  await delay(delayMs)
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
