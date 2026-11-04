import { useState, type FormEvent } from 'react'
import { Copy, UserPlus } from 'lucide-react'
import { del, get, patch, post } from '../api/client'
import type { Member, Role } from '../api/types'
import { t } from '../i18n'
import { ago, Avatar, copy, ErrorBox, errText, Skeleton, useLoad, useToast } from '../lib'
import { useApp } from './ctx'

const T = t.team

export function TeamPage() {
  const { me } = useApp()
  const toast = useToast()
  const { data, setData, error, reload } = useLoad(() => get<Member[]>('/members'))
  const [f, setF] = useState({ name: '', email: '', role: 'operator' as Role })
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const canEdit = me.role === 'owner' || me.role === 'admin'

  async function invite(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    try {
      const r = await post<{ member: Member; tempPassword: string }>('/members', f)
      setData(l => [...(l ?? []), r.member]); setTemp({ email: r.member.email, password: r.tempPassword }); setF({ name: '', email: '', role: 'operator' })
    } catch (er) { toast(errText(er), 'err') } finally { setBusy(false) }
  }
  async function setRole(m: Member, role: Role) {
    try { await patch(`/members/${m.userId}`, { role }); setData(l => l?.map(x => (x.userId === m.userId ? { ...x, role } : x)) ?? l) } catch (e) { toast(errText(e), 'err') }
  }
  async function remove(m: Member) {
    try { await del(`/members/${m.userId}`); setData(l => l?.filter(x => x.userId !== m.userId) ?? l) } catch (e) { toast(errText(e), 'err') }
  }

  return (
    <>
      <div className="o2-page-h"><h1 className="o2-h1">{T.title}</h1><span className="o2-mono">{data?.length ?? ''}</span></div>
      {canEdit && (
        <form className="o2-card o2-inline-form" onSubmit={invite}>
          <label className="o2-field"><span>{t.common.name}</span><input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
          <label className="o2-field"><span>{t.common.email}</span><input required type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
          <label className="o2-field"><span>{t.common.role}</span><select value={f.role} onChange={e => setF({ ...f, role: e.target.value as Role })}><option value="operator">{t.roles.operator}</option><option value="admin">{t.roles.admin}</option></select></label>
          <div className="o2-row end"><button className="o2-btn primary sm" disabled={busy}><UserPlus size={14} /> {T.invite}</button></div>
        </form>
      )}
      {temp && <div className="o2-banner ok"><span>{T.tempPassword}: <b>{temp.email}</b> / <code>{temp.password}</code></span><button className="o2-icon-btn sm" onClick={() => void copy(temp.password, toast)} aria-label={t.common.copy}><Copy size={13} /></button></div>}
      <div className="o2-card flush">
        {error ? <ErrorBox text={error} retry={reload} /> : !data ? <Skeleton rows={4} /> : (
          <div className="o2-table-wrap">
            <table className="o2-table">
              <thead><tr><th>{t.common.name}</th><th className="hide-sm">{t.common.email}</th><th>{t.common.role}</th><th className="hide-sm">{T.lastSeen}</th><th /></tr></thead>
              <tbody>
                {data.map(m => {
                  const self = m.userId === me.user.id
                  return (
                    <tr key={m.userId}>
                      <td><span className="o2-cell-name"><Avatar name={m.name} size={26} /><b>{m.name}</b>{self && <small>({T.you})</small>}</span></td>
                      <td className="hide-sm">{m.email}</td>
                      <td>{canEdit && !self && m.role !== 'owner'
                        ? <select className="o2-input sm" value={m.role} onChange={e => void setRole(m, e.target.value as Role)}><option value="operator">{t.roles.operator}</option><option value="admin">{t.roles.admin}</option></select>
                        : <span className="o2-tag mute">{t.roles[m.role]}</span>}</td>
                      <td className="hide-sm">{ago(m.lastSeenAt)}</td>
                      <td>{canEdit && !self && m.role !== 'owner' && <button className="o2-btn sm ghost" onClick={() => void remove(m)}>{T.remove}</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
