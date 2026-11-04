import { post } from './api/client'
import type { Me } from './api/types'
import { go } from './lib'

/** Creates a per-visitor sandbox org and opens the app. */
export async function openDemo(): Promise<void> {
  await post<Me>('/auth/demo')
  go('/app')
}
