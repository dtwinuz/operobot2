import { useEffect, useRef } from 'react'
import type { ServerEvent } from './types'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

type Opts = { method?: string; body?: unknown; noRedirect?: boolean }

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    credentials: 'include',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let data: unknown = null
  if (text) { try { data = JSON.parse(text) } catch { data = { error: text.slice(0, 200) } } }
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : '') || `HTTP ${res.status}`
    if (res.status === 401 && !opts.noRedirect && location.hash.startsWith('#/app')) location.hash = '#/login'
    throw new ApiError(msg, res.status)
  }
  return data as T
}

export const get = <T>(p: string, noRedirect = false) => api<T>(p, { noRedirect })
export const post = <T>(p: string, body: unknown = {}) => api<T>(p, { method: 'POST', body })
export const patch = <T>(p: string, body: unknown) => api<T>(p, { method: 'PATCH', body })
export const del = <T>(p: string) => api<T>(p, { method: 'DELETE' })

/** Subscribes to /api/events (SSE). Handler may change between renders without reconnecting. */
export function useEvents(handler: (e: ServerEvent) => void, enabled = true) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return
    let es: EventSource | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let dead = false
    const open = () => {
      es = new EventSource('/api/events', { withCredentials: true })
      es.onmessage = ev => { try { ref.current(JSON.parse(ev.data) as ServerEvent) } catch { /* ignore malformed */ } }
      es.onerror = () => { es?.close(); if (!dead) retry = setTimeout(open, 4000) }
    }
    open()
    return () => { dead = true; clearTimeout(retry); es?.close() }
  }, [enabled])
}
