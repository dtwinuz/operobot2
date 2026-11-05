import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Building2, CreditCard, Inbox, KanbanSquare, LayoutDashboard, LogOut, Menu, Moon, PhoneOutgoing, Plug, Settings, Sun, Users, Contact as ContactIcon, X } from 'lucide-react'
import { get, post, useEvents } from '../api/client'
import type { Me, ServerEvent } from '../api/types'
import { t } from '../i18n'
import { errText, go, Skeleton, useTheme, useToast, LangSwitch } from '../lib'
import { Ctx } from './ctx'
import { Dashboard } from './Dashboard'
import { InboxPage } from './Inbox'
import { BoardPage } from './Board'
import { ContactsPage } from './Contacts'
import { CallsPage } from './Calls'
import { AgentsPage } from './Agents'
import { ChannelsPage } from './Channels'
import { TeamPage } from './Team'
import { BillingPage } from './Billing'
import { SettingsPage } from './Settings'

const N = t.shell.nav
const NAV = [
  { p: '', label: N.dashboard, icon: LayoutDashboard },
  { p: 'inbox', label: N.inbox, icon: Inbox },
  { p: 'board', label: N.board, icon: KanbanSquare },
  { p: 'contacts', label: N.contacts, icon: ContactIcon },
  { p: 'calls', label: N.calls, icon: PhoneOutgoing },
  { p: 'agents', label: N.agents, icon: Bot },
  { p: 'channels', label: N.channels, icon: Plug },
  { p: 'team', label: N.team, icon: Users },
  { p: 'billing', label: N.billing, icon: CreditCard },
  { p: 'settings', label: N.settings, icon: Settings },
]

export default function Shell({ path }: { path: string }) {
  const [me, setMe] = useState<Me | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [theme, toggle] = useTheme()
  const toast = useToast()
  const subs = useRef(new Set<(e: ServerEvent) => void>())

  const reloadMe = useCallback(() => {
    get<Me>('/me', true).then(setMe).catch(() => go('/login'))
  }, [])
  useEffect(() => { reloadMe() }, [reloadMe])
  useEvents(e => { for (const fn of subs.current) fn(e) }, !!me)
  const on = useCallback((fn: (e: ServerEvent) => void) => { subs.current.add(fn); return () => { subs.current.delete(fn) } }, [])

  const seg = path.replace(/^\/app\/?/, '').split('/')
  const page = seg[0] ?? ''
  useEffect(() => { setDrawer(false) }, [path])

  if (!me) return <div className="o2-boot"><Skeleton rows={6} /></div>

  async function logout() {
    try { await post('/auth/logout') } catch { /* ignore */ }
    go('/')
  }
  async function switchOrg(orgId: string) {
    try { setMe(await post<Me>('/orgs/switch', { orgId })); go('/app') } catch (e) { toast(errText(e), 'err') }
  }

  let body
  switch (page) {
    case 'inbox': body = <InboxPage id={seg[1]} />; break
    case 'board': body = <BoardPage />; break
    case 'contacts': body = <ContactsPage />; break
    case 'calls': body = <CallsPage />; break
    case 'agents': body = <AgentsPage />; break
    case 'channels': body = <ChannelsPage />; break
    case 'team': body = <TeamPage />; break
    case 'billing': body = <BillingPage />; break
    case 'settings': body = <SettingsPage />; break
    default: body = <Dashboard />
  }

  return (
    <Ctx.Provider value={{ me, reloadMe, on }}>
      <div className={`o2-shell${drawer ? ' drawer' : ''}`}>
        <aside className="o2-side">
          <div className="o2-side-h">
            <a className="o2-logo" href="#/app"><img src="/favicon.svg" alt="" width={24} height={24} /><b>operobot</b><i>2</i></a>
            <button className="o2-icon-btn show-sm" onClick={() => setDrawer(false)} aria-label={t.common.close}><X size={18} /></button>
          </div>
          <nav className="o2-nav">
            {NAV.map(n => {
              const Icon = n.icon
              return <a key={n.p} href={`#/app${n.p ? '/' + n.p : ''}`} className={page === n.p ? 'on' : ''}><Icon size={17} /><span>{n.label}</span></a>
            })}
          </nav>
          <div className="o2-side-f">
            <div className="o2-me"><b>{me.user.name}</b><small>{me.user.email} · {t.roles[me.role]}</small></div>
          </div>
        </aside>
        {drawer && <div className="o2-scrim" onClick={() => setDrawer(false)} />}
        <div className="o2-main">
          <header className="o2-top">
            <button className="o2-icon-btn show-sm" onClick={() => setDrawer(true)} aria-label={t.shell.menu}><Menu size={18} /></button>
            <div className="o2-top-org">
              <Building2 size={16} />
              {me.orgs.length > 1 ? (
                <select aria-label={t.shell.switchOrg} value={me.org.id} onChange={e => void switchOrg(e.target.value)}>
                  {me.orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : <b>{me.org.name}</b>}
              <span className="o2-tag mute">{me.org.plan}</span>
              {me.org.demo && <span className="o2-tag demo" title={t.shell.demoNote}>{t.shell.demo}<em className="hide-sm"> · {t.shell.demoNote}</em></span>}
            </div>
            <span className="o2-flex" />
            <LangSwitch />
            <button className="o2-icon-btn" onClick={toggle} aria-label={t.common.theme}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button className="o2-icon-btn" onClick={() => void logout()} aria-label={t.common.logout} title={t.common.logout}><LogOut size={16} /></button>
          </header>
          <main className={`o2-page p-${page || 'dashboard'}`}>{body}</main>
        </div>
      </div>
    </Ctx.Provider>
  )
}
