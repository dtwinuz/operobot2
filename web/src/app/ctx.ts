import { createContext, useContext } from 'react'
import type { Me, ServerEvent } from '../api/types'

export type AppCtx = { me: Me; reloadMe: () => void; on: (fn: (e: ServerEvent) => void) => () => void }
export const Ctx = createContext<AppCtx>(null as unknown as AppCtx)
export const useApp = () => useContext(Ctx)
