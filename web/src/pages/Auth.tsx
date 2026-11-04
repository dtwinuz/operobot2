import { useState, type FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { post } from '../api/client'
import type { Me } from '../api/types'
import { t } from '../i18n'
import { errText, go, useToast } from '../lib'
import { openDemo } from '../demo'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const A = t.auth
  const toast = useToast()
  const [f, setF] = useState({ name: '', email: '', password: '', company: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'login') await post<Me>('/auth/login', { email: f.email, password: f.password })
      else await post<Me>('/auth/signup', f)
      go('/app')
    } catch (err) { toast(errText(err), 'err') } finally { setBusy(false) }
  }

  return (
    <div className="o2-auth">
      <div className="o2-land-bg" aria-hidden="true"><i /><i /><i /></div>
      <form className="o2-auth-card" onSubmit={submit}>
        <a className="o2-auth-back" href="#/"><ArrowLeft size={14} /> {A.back}</a>
        <a className="o2-logo" href="#/"><img src="/favicon.svg" alt="" width={26} height={26} /><b>operobot</b><i>2</i></a>
        <h1>{mode === 'login' ? A.loginTitle : A.signupTitle}</h1>
        {mode === 'signup' && <>
          <label className="o2-field"><span>{A.yourName}</span><input required value={f.name} onChange={set('name')} autoComplete="name" /></label>
          <label className="o2-field"><span>{A.company}</span><input required value={f.company} onChange={set('company')} autoComplete="organization" /></label>
        </>}
        <label className="o2-field"><span>{t.common.email}</span><input required type="email" value={f.email} onChange={set('email')} autoComplete="email" /></label>
        <label className="o2-field"><span>{A.password}</span><input required type="password" minLength={mode === 'signup' ? 8 : 1} value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        <button className="o2-btn primary lg" disabled={busy}>{busy ? t.common.loading : mode === 'login' ? A.submitLogin : A.submitSignup}</button>
        <p className="o2-auth-alt">
          {mode === 'login' ? <>{A.noAccount} <a href="#/signup">{t.landing.signup}</a></> : <>{A.haveAccount} <a href="#/login">{t.landing.login}</a></>}
          {' · '}
          <button type="button" className="o2-link" onClick={() => openDemo().catch(e => toast(errText(e), 'err'))}>{A.orDemo}</button>
        </p>
      </form>
    </div>
  )
}
