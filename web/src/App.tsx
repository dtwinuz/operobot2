import { lazy, Suspense, useEffect } from 'react'
import { ToastHost, useHash, Skeleton } from './lib'
import { Landing } from './pages/Landing'
import { AuthPage } from './pages/Auth'

const Shell = lazy(() => import('./app/Shell'))

export function App() {
  const hash = useHash()
  useEffect(() => { if (!hash.startsWith('/app')) window.scrollTo(0, 0) }, [hash])
  let page
  if (hash.startsWith('/app')) page = <Suspense fallback={<div className="o2-boot"><Skeleton rows={6} /></div>}><Shell path={hash} /></Suspense>
  else if (hash === '/login') page = <AuthPage mode="login" />
  else if (hash === '/signup') page = <AuthPage mode="signup" />
  else page = <Landing />
  return <ToastHost>{page}</ToastHost>
}
