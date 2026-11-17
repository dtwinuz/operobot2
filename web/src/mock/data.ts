// Seed for the static demo (vite build --mode demo). Every person, company and number is fictional (+998 00 ...),
// all times are relative to Date.now(), so the demo never looks stale.
import type { Agent, Call, CallStatus, Campaign, Channel, ChannelKind, Contact, Conversation, Interest, Invoice, Lead, Member, Message, Plan, Stage } from '../api/types'

export const NOW = Date.now()
export const ago = (min: number) => new Date(NOW - min * 60_000).toISOString()
export const ahead = (h: number) => new Date(NOW + h * 3600_000).toISOString()

let n = 0
export const id = (p: string) => `${p}_${(++n).toString(36).padStart(4, '0')}`

export const NAMES = ['Dilnoza Rahimova', 'Aziz Valiyev', 'Jasur Toshmatov', 'Nodira Karimova', 'Sardor Mirzayev', 'Kamola Aliyeva', 'Bobur Sobirov', 'Gulnora Xasanova',
  'Rustam Yusupov', 'Malika Olimova', 'Sherzod Qodirov', 'Zarina Usmonova', 'Otabek Nurmatov', 'Feruza Ismoilova', "Ulug'bek Sattorov", 'Madina Ergasheva',
  'Javohir Rasulov', 'Shahnoza Tursunova', 'Doniyor Abdullayev', 'Sevara Mahmudova', 'Akmal Jo‘rayev', 'Dildora Po‘latova', 'Bekzod Rahmonov', 'Mohinur Komilova',
  'Farrux Zokirov', 'Gavhar Nazarova', 'Temur Oripov', 'Munisa Bakirova', 'Sanjar Eshonqulov', 'Robiya Qurbonova', 'Elyor Murodov', 'Hilola Saidova',
  'Islom G‘aniyev', 'Lola Davronova', 'Nilufar Tojiboyeva', 'Behruz Xolmatov', 'Charos Yo‘ldosheva', 'Anvar Hakimov', 'Yulduz Fayzullayeva', 'Shohruh Normatov',
  'Oydin Sharipova', 'Firdavs Islomov', 'Nargiza Bozorova', 'Jamshid Ochilov', 'Durdona Raximjonova', 'Ravshan Karimov', 'Komila Tursunboyeva', 'Ibrohim Qosimov']

export const phone = (i: number) => `+998 00 ${String(100 + ((i * 37) % 900))} ${String(10 + ((i * 13) % 90))} ${String(10 + ((i * 7) % 90))}`
const username = (name: string, i: number) => name.split(' ')[0]!.toLowerCase().replace(/[^a-z]/g, '') + (i + 7)

export const ME_ID = 'u_owner'
export const MEMBERS: Member[] = [
  { userId: ME_ID, name: 'Aziza Rahimova', email: 'aziza@namuna.uz', role: 'owner', lastSeenAt: ago(0) },
  { userId: 'u_mohira', name: 'Mohira Yo‘ldosheva', email: 'mohira@namuna.uz', role: 'admin', lastSeenAt: ago(4) },
  { userId: 'u_umid', name: 'Umid Hasanov', email: 'umid@namuna.uz', role: 'operator', lastSeenAt: ago(1) },
  { userId: 'u_dilshod', name: 'Dilshod Ergashev', email: 'dilshod@namuna.uz', role: 'operator', lastSeenAt: ago(12) },
  { userId: 'u_nigora', name: 'Nigora Saidova', email: 'nigora@namuna.uz', role: 'operator', lastSeenAt: ago(55) },
  { userId: 'u_kamron', name: 'Kamron Aliyev', email: 'kamron@namuna.uz', role: 'operator', lastSeenAt: ago(60 * 5) },
  { userId: 'u_sevinch', name: 'Sevinch Tojiyeva', email: 'sevinch@namuna.uz', role: 'admin', lastSeenAt: ago(60 * 26) },
  { userId: 'u_jahongir', name: 'Jahongir Bobomurodov', email: 'jahongir@namuna.uz', role: 'operator', lastSeenAt: null },
]
const OPS = MEMBERS.filter(m => m.role !== 'owner')
const opName = (uid: string | null) => MEMBERS.find(m => m.userId === uid)?.name ?? null

export const STAGES: Stage[] = [
  { id: 'st_yangi', key: 'yangi', name: 'Yangi', color: '#0891b2', position: 0, kind: 'open' },
  { id: 'st_qiziqdi', key: 'qiziqdi', name: 'Qiziqdi', color: '#7c3aed', position: 1, kind: 'open' },
  { id: 'st_uchrashuv', key: 'uchrashuv', name: 'Uchrashuv', color: '#d97706', position: 2, kind: 'open' },
  { id: 'st_qayta', key: 'qayta', name: "Qayta bog'lanish", color: '#64748b', position: 3, kind: 'open' },
  { id: 'st_yutildi', key: 'yutildi', name: 'Yutildi', color: '#059669', position: 4, kind: 'won' },
  { id: 'st_yutqazildi', key: 'yutqazildi', name: 'Yutqazildi', color: '#db2777', position: 5, kind: 'lost' },
]
export const stageId = (key: string) => STAGES.find(s => s.key === key)!.id

export const CHANNELS: Channel[] = [
  { id: 'ch_widget', kind: 'widget', name: 'Sayt vidjeti', status: 'connected', info: 'namuna.uz va do‘kon sahifalarida', webhookUrl: null, widgetKey: 'wk_9f2c41ab7d', createdAt: ago(60 * 24 * 60) },
  { id: 'ch_tg', kind: 'telegram', name: '@namuna_servis_bot', status: 'connected', info: 'Bot: Namuna Servis · 1 284 obunachi', webhookUrl: `https://operobot2.dtwin.uz/api/hooks/telegram/ch_tg`, widgetKey: null, createdAt: ago(60 * 24 * 58) },
  { id: 'ch_tg2', kind: 'telegram', name: '@namuna_market_bot', status: 'demo', info: 'Demo kanal: xabarlar tashqariga chiqmaydi', webhookUrl: `https://operobot2.dtwin.uz/api/hooks/telegram/ch_tg2`, widgetKey: null, createdAt: ago(60 * 24 * 3) },
  { id: 'ch_wa', kind: 'whatsapp', name: 'WhatsApp Business', status: 'connected', info: 'Raqam: +998 00 555 12 34', webhookUrl: `https://operobot2.dtwin.uz/api/hooks/whatsapp/ch_wa`, widgetKey: null, createdAt: ago(60 * 24 * 40) },
  { id: 'ch_ig', kind: 'instagram', name: '@namuna.servis', status: 'connected', info: 'Direct va izohlar · 8 412 obunachi', webhookUrl: `https://operobot2.dtwin.uz/api/hooks/instagram/ch_ig`, widgetKey: null, createdAt: ago(60 * 24 * 33) },
  { id: 'ch_sms', kind: 'sms', name: 'SMS 1234', status: 'error', info: 'Shlyuz javob bermadi (HTTP 503), 2 soat oldin. Token muddatini tekshiring.', webhookUrl: `https://operobot2.dtwin.uz/api/hooks/sms/ch_sms`, widgetKey: null, createdAt: ago(60 * 24 * 21) },
]
const chanOf = (kind: ChannelKind) => CHANNELS.find(c => c.kind === kind)!

export const AGENTS: Agent[] = [
  { id: 'ag_zarina', name: 'Zarina', kind: 'chat', enabled: true, prompt: "Mijozning ehtiyojini aniqlang, qisqa javob bering, telefon raqami va qulay vaqtini so'rang. Narxni o'ylab topmang: aniq narxni menejer aytadi.\nIsh vaqti 09:00–18:00. Bepul ko'rik har kuni, shanba 14:00 gacha.", greeting: 'Assalomu alaykum! Namuna Servis yordamchisi Zarina. Sizga qanday yordam bera olaman?', handoff: ['operator', 'odam bilan', 'menejer'], channelIds: ['ch_widget', 'ch_tg', 'ch_wa', 'ch_sms'], voice: null, stats: { replies: 1284, handoffs: 96 } },
  { id: 'ag_malika', name: 'Malika (Instagram)', kind: 'chat', enabled: true, prompt: "Instagram direct va izohlarga javob bering. Narxni so'rasa, raqam so'rang va menejerga topshiring. Emoji kam ishlating.", greeting: 'Salom! Namuna Servis, Malika. Qaysi xizmat qiziqtiryapti?', handoff: ['operator', 'menejer', 'shikoyat'], channelIds: ['ch_ig'], voice: null, stats: { replies: 642, handoffs: 51 } },
  { id: 'ag_sardor', name: 'Sardor', kind: 'voice', enabled: true, prompt: "Chiquvchi qo'ng'iroqda aksiyani qisqa aytib bering. Mijoz qiziqsa 1 ni bosishni yoki 'ha' deyishni so'rang va operatorga ulang.", greeting: 'Assalomu alaykum! Namuna Servisdan qo‘ng‘iroq qilyapmiz, sizga kuzgi aksiya haqida aytmoqchimiz.', handoff: ['operator'], channelIds: [], voice: 'uz-UZ-SardorNeural', stats: { replies: 418, handoffs: 73 } },
  { id: 'ag_madina', name: 'Madina (eslatma)', kind: 'voice', enabled: true, prompt: "Ertangi uchrashuvni eslating, vaqtni tasdiqlating. Mijoz ko'chirmoqchi bo'lsa operatorga ulang.", greeting: 'Assalomu alaykum! Namuna Servis, ertangi ko‘rik haqida eslatmoqchimiz.', handoff: ['operator', "ko'chirish"], channelIds: [], voice: 'uz-UZ-MadinaNeural', stats: { replies: 212, handoffs: 18 } },
  { id: 'ag_night', name: 'Kechki navbat', kind: 'chat', enabled: false, prompt: "18:00 dan keyin yozganlarga: ertaga 09:00 da operator bog'lanishini ayting va raqam so'rang.", greeting: 'Xayrli kech! Hozir ish vaqti tugagan, ertaga 09:00 da bog‘lanamiz.', handoff: [], channelIds: ['ch_tg', 'ch_widget'], voice: null, stats: { replies: 0, handoffs: 0 } },
]

type Turn = [a: 'c' | 'a' | 'u' | 's', text: string]
type Script = { kind: ChannelKind; stage: string; interest: Interest | null; value: number | null; next: string | null; dueH: number | null; summary: string | null; mode: 'ai' | 'human'; op: string | null; msgs: Turn[]; title: string }
const S = (kind: ChannelKind, stage: string, title: string, interest: Interest | null, value: number | null, next: string | null, dueH: number | null, summary: string | null, mode: 'ai' | 'human', op: string | null, msgs: Turn[]): Script =>
  ({ kind, stage, title, interest, value, next, dueH, summary, mode, op, msgs })

const SCRIPTS: Script[] = [
  S('telegram', 'yangi', 'Kurslar haqida', null, null, null, null, null, 'ai', null, [['c', 'Assalomu alaykum, kurslaringiz bormi?'], ['a', 'Assalomu alaykum! Namuna Servis yordamchisi Zarina. Qaysi yo‘nalish qiziqtiryapti?']]),
  S('instagram', 'qiziqdi', 'Konditsioner o‘rnatish, 2 xona', "o'rta", 1_200_000, 'Narx ro‘yxatini yuborish', null, 'Mijoz narx bilan qiziqdi. (AI Malika)', 'ai', null, [['c', 'Salom, narxlar qancha?'], ['a', 'Narx xizmat turiga va hajmga bog‘liq. Qaysi xizmat kerakligini va telefon raqamingizni yozsangiz, aniq hisob-kitobni yuboramiz.'], ['c', 'Konditsioner o‘rnatish, 2 ta xonaga']]),
  S('whatsapp', 'uchrashuv', 'Usta chaqirish, Yunusobod', 'yuqori', 2_400_000, 'Uchrashuvni tasdiqlash, bir kun oldin eslatma', 20, 'Mijoz ertaga soat 11:00 ga kelishdi. (AI Zarina)', 'ai', null, [['c', 'Assalomu alaykum, usta qachon kela oladi?'], ['a', 'Assalomu alaykum! Qaysi kun va soat qulay?'], ['c', 'ertaga soat 11 da bo‘ladimi?'], ['a', 'Ajoyib! Ertaga soat 11:00 ga yozib qo‘ydim. Bir kun oldin eslatma yuboramiz.']]),
  S('telegram', 'qiziqdi', 'Ofis uchun 5 ta kompyuter', 'yuqori', 3_500_000, 'Qo‘ng‘iroq qilish', 2, 'Mijoz raqamini qoldirdi, qo‘ng‘iroq kutyapti. (AI Zarina)', 'human', 'u_mohira', [['c', 'Ofis uchun 5 ta kompyuter kerak, chegirma bormi?'], ['a', 'Narx hajmga bog‘liq. Telefon raqamingizni qoldirsangiz, menejer aniq taklif beradi.'], ['c', '+998 00 412 55 67'], ['a', 'Rahmat! Menejerimiz shu raqamga tez orada qo‘ng‘iroq qiladi.'], ['u', 'Assalomu alaykum, men Mohira. 15 daqiqada qo‘ng‘iroq qilaman.']]),
  S('sms', 'qayta', 'Keyinroq gaplashish', "o'rta", null, 'Qayta bog‘lanish', 30, 'Mijoz keyinroq gaplashishni so‘radi. (AI Zarina)', 'ai', null, [['c', 'Hozir bandman, keyinroq yozaman'], ['a', 'Mayli, qachon qulay? Kun va soatni yozing, o‘sha paytda bog‘lanamiz.']]),
  S('widget', 'yangi', 'Ish vaqti so‘rovi', null, null, null, null, null, 'ai', null, [['c', 'Ish vaqtingiz qanaqa?'], ['a', 'Biz har kuni 09:00–18:00 ishlaymiz. Uchrashuv uchun qulay kun va soatni yozing, manzilni yuboramiz.']]),
  S('instagram', 'yutildi', 'Shartnoma, 3 blok', 'yuqori', 4_800_000, null, null, 'Shartnoma imzolandi, oldindan to‘lov qilindi.', 'human', 'u_umid', [['c', 'Kecha gaplashgan edik, shartnomani yuboring'], ['u', 'Yubordim, tekshirib ko‘ring. Rahmat!'], ['c', 'Imzoladim, to‘lov qildim 👍']]),
  S('whatsapp', 'yutqazildi', 'Narx qimmat', 'past', null, null, null, 'Mijoz hozircha rad etdi. (AI Zarina)', 'ai', null, [['c', 'Qimmat ekan, kerak emas'], ['a', 'Tushundim, rahmat! Kerak bo‘lsa shu yerga yozing, doim yordam beramiz.']]),
  S('telegram', 'qiziqdi', 'Kafolat savoli', 'yuqori', 900_000, 'Operator javob beradi', 1, 'Mijoz operator bilan gaplashmoqchi. (AI Zarina)', 'human', null, [['c', 'Kafolat necha yil? Operator bilan gaplashsam bo‘ladimi'], ['a', 'Albatta, sizni operatorga ulayman. Bir daqiqa kuting.'], ['s', 'Zarina suhbatni operatorga topshirdi.']]),
  S('sms', 'uchrashuv', 'Juma ko‘rik', 'yuqori', 1_700_000, 'Uchrashuvni tasdiqlash', 50, 'Qo‘ng‘iroqdan keyin juma kuni ko‘rikka yozildi.', 'human', 'u_mohira', [['u', 'Namuna Servis: juma 15:00 ko‘rik tasdiqlandi.'], ['c', 'Rahmat, boraman']]),
  S('telegram', 'uchrashuv', 'Showroom tashrifi', 'yuqori', 6_200_000, 'Showroom: shanba 12:00', 72, 'Mijoz shanba kuni showroomga keladi. (AI Zarina)', 'ai', null, [['c', 'Showroomingiz qayerda?'], ['a', 'Toshkent, Mirzo Ulug‘bek tumani. Qaysi kun kelasiz?'], ['c', 'shanba soat 12:00'], ['a', 'Ajoyib! Shanba 12:00 ga yozib qo‘ydim, manzilni yuboraman.']]),
  S('instagram', 'qiziqdi', 'Ulgurji narx', "o'rta", 12_000_000, 'Ulgurji narx varag‘ini yuborish', 6, 'Ulgurji xaridor, 40 dona so‘radi. (AI Malika)', 'human', 'u_dilshod', [['c', 'Ulgurji olsak chegirma bormi? 40 dona'], ['a', 'Ulgurji narxni menejer aytadi. Raqamingizni qoldirasizmi?'], ['c', '+998 00 731 20 44'], ['u', 'Dilshod, menejer. Narx varag‘ini 1 soatda yuboraman.']]),
  S('widget', 'qiziqdi', 'Yetkazib berish', "o'rta", 450_000, 'Yetkazish narxini aytish', null, 'Samarqandga yetkazib berishni so‘radi. (AI Zarina)', 'ai', null, [['c', 'Samarqandga yetkazib berasizmi?'], ['a', 'Ha, viloyatlarga 2–3 kunda yetkazamiz. Manzil va raqamingizni yozing.'], ['c', 'Samarqand, Registon ko‘chasi, 0091 155 22 11']]),
  S('telegram', 'yutildi', 'Servis shartnomasi, yillik', 'yuqori', 7_900_000, null, null, 'Yillik servis shartnomasi imzolandi.', 'human', 'u_umid', [['c', 'Yillik servis shartnomasini uzaytirmoqchimiz'], ['u', 'Albatta, yangi shartnomani yubordim.'], ['c', 'Imzolandi, rahmat!'], ['u', 'Rahmat! Hisob-faktura emailga keladi.']]),
  S('whatsapp', 'qayta', 'Oilasi bilan maslahat', "o'rta", 2_100_000, '3 kundan keyin qayta yozish', 70, 'Mijoz oilasi bilan maslahatlashadi.', 'human', 'u_nigora', [['c', 'Oilam bilan maslahatlashib javob beraman'], ['u', 'Mayli, payshanba kuni o‘zim yozaman.']]),
  S('instagram', 'yangi', 'Izohdan kelgan savol', null, null, null, null, null, 'ai', null, [['c', 'Bu modelning qora rangi bormi?'], ['a', 'Ha, qora va kumush ranglari bor. Qaysi biri yoqdi?'], ['c', 'Qorasi']]),
  S('telegram', 'yutqazildi', 'Boshqa joydan oldi', 'past', null, null, null, 'Mijoz boshqa kompaniyadan xarid qildi.', 'human', 'u_dilshod', [['c', 'Rahmat, boshqa joydan oldik'], ['u', 'Tushundim, xizmat kerak bo‘lsa yozing.']]),
  S('sms', 'yangi', 'SMS javob', null, null, null, null, null, 'ai', null, [['c', 'Aksiya hali bormi?'], ['a', 'Ha, kuzgi aksiya oy oxirigacha davom etadi. Qaysi xizmat kerak?']]),
  S('widget', 'uchrashuv', 'Onlayn taqdimot', 'yuqori', 3_300_000, 'Bugun 17:30 onlayn taqdimot', 3, 'Mijoz bugun 17:30 da onlayn taqdimotga yozildi. (AI Zarina)', 'ai', null, [['c', 'Onlayn ko‘rsatib bera olasizmi?'], ['a', 'Albatta. Bugun 17:30 qulaymi?'], ['c', 'bugun 17:30 bo‘ladi'], ['a', 'Ajoyib! Havolani 17:00 da yuboramiz.']]),
  S('telegram', 'qiziqdi', 'Bo‘lib to‘lash', "o'rta", 5_400_000, 'Bo‘lib to‘lash jadvalini yuborish', 26, 'Mijoz 6 oyga bo‘lib to‘lashni so‘radi.', 'human', 'u_kamron', [['c', 'Bo‘lib to‘lash bormi? 6 oyga'], ['a', 'Bo‘lib to‘lash shartlarini menejer aytadi. Ulayman.'], ['s', 'Zarina suhbatni operatorga topshirdi.'], ['u', 'Kamron, menejer. 6 oyga ustamasiz variant bor, jadvalni yuboraman.']]),
]

const OPENERS = ['Assalomu alaykum, narxlar qancha?', 'Salom, xizmatlaringiz haqida ma’lumot bering', 'Yetkazib berish bormi?', 'Assalomu alaykum, bugun ishlaysizmi?', 'Chegirma bormi hozir?', 'Qayerda joylashgansiz?', 'Kafolat beriladimi?', 'Naqd to‘lov bo‘ladimi?']
const AI_ANS = ['Narx xizmat turiga va hajmga bog‘liq. Qaysi xizmat kerakligini va telefon raqamingizni yozsangiz, aniq hisob-kitobni yuboramiz.', 'Biz har kuni 09:00–18:00 ishlaymiz. Qulay kun va soatni yozing.', 'Ha, Toshkent bo‘yicha bepul yetkazamiz. Manzilingizni yozing.']

export const CONTACTS: Contact[] = []
export const CONVS: Conversation[] = []
export const MESSAGES = new Map<string, Message[]>()
export const LEADS: Lead[] = []

function addContact(i: number, kind: Contact['channel'], minAgo: number): Contact {
  const name = NAMES[i % NAMES.length]!
  const c: Contact = {
    id: id('ct'), name, phone: kind === 'sms' || kind === 'whatsapp' || kind === 'manual' || i % 3 === 0 ? phone(i) : null,
    username: kind === 'telegram' || kind === 'instagram' ? username(name, i) : null, channel: kind,
    tags: i % 7 === 0 ? ['VIP'] : i % 5 === 0 ? ['ulgurji'] : i % 6 === 0 ? ['qayta mijoz', 'Chilonzor'] : [],
    createdAt: ago(minAgo + 60 * 24 * (i % 20)), lastSeenAt: ago(minAgo), leads: 0, doNotCallAt: i % 17 === 4 ? ago(60 * 24 * 2) : null,
  }
  CONTACTS.push(c)
  return c
}

function addConversation(c: Contact, kind: ChannelKind, msgs: Turn[], start: number, mode: 'ai' | 'human', op: string | null, closed: boolean): Conversation {
  const conv: Conversation = {
    id: id('cv'), channel: kind, channelName: chanOf(kind).name, status: closed ? 'closed' : 'open', mode, assigneeId: op, assigneeName: opName(op),
    unread: 0, leadId: null, contact: { id: c.id, name: c.name, phone: c.phone, username: c.username }, last: null,
  }
  let t = start
  const list: Message[] = msgs.map(([a, text]) => {
    const author = a === 'c' ? 'contact' : a === 'a' ? 'ai' : a === 'u' ? 'user' : 'system'
    const direction = author === 'contact' ? 'in' : 'out'
    const m: Message = { id: id('m'), direction, author, userName: author === 'user' ? opName(op) : null, text, at: ago(t), status: direction === 'in' ? 'received' : 'sent' }
    t -= 2 + (start % 3)
    return m
  })
  if (kind === 'sms' && list.length > 2) list[list.length - 2]!.status = 'failed' // an SMS the gateway refused
  const last = list[list.length - 1]!
  conv.last = { text: last.text, at: last.at, direction: last.direction }
  conv.unread = last.direction === 'in' && !closed ? 1 + (start % 3) : 0
  MESSAGES.set(conv.id, list)
  CONVS.push(conv)
  return conv
}

function addLead(c: Contact, conv: Conversation | null, s: { stage: string; title: string; value: number | null; interest: Interest | null; next: string | null; dueH: number | null; summary: string | null; op: string | null; source: Lead['source'] }, minAgo: number): Lead {
  const l: Lead = {
    id: id('ld'), title: s.title, value: s.value, stageId: stageId(s.stage), interest: s.interest, nextAction: s.next, dueAt: s.dueH == null ? null : ahead(s.dueH),
    assigneeId: s.op, assigneeName: opName(s.op), source: s.source, summary: s.summary, conversationId: conv?.id ?? null,
    contact: { id: c.id, name: c.name, phone: c.phone }, createdAt: ago(minAgo + 120), updatedAt: ago(minAgo),
  }
  if (conv) conv.leadId = l.id
  c.leads++
  LEADS.push(l)
  return l
}

// 20 scripted conversations with leads
SCRIPTS.forEach((s, i) => {
  const start = 8 + i * 37 + s.msgs.length * 3
  const c = addContact(i, s.kind, start - s.msgs.length * 3)
  const closed = s.stage === 'yutildi' || s.stage === 'yutqazildi'
  const conv = addConversation(c, s.kind, s.msgs, start, s.mode, s.op, closed)
  addLead(c, conv, { ...s, source: s.kind }, start)
})
// 14 short AI-only chats without a lead yet
for (let k = 0; k < 14; k++) {
  const i = 20 + k
  const kinds: ChannelKind[] = ['telegram', 'instagram', 'widget', 'whatsapp', 'telegram', 'sms']
  const kind = kinds[k % kinds.length]!
  const start = 60 * 3 + k * 95
  const c = addContact(i, kind, start)
  addConversation(c, kind, k % 3 === 0 ? [['c', OPENERS[k % OPENERS.length]!]] : [['c', OPENERS[k % OPENERS.length]!], ['a', AI_ANS[k % AI_ANS.length]!]], start, 'ai', null, k % 4 === 3)
}
// 14 leads from calls and manual entry (no chat)
const CALL_LEADS: [string, string, number | null, Interest | null, string | null, number | null, string | null][] = [
  ['qiziqdi', 'Kuzgi aksiya: 1 ni bosdi', 1_500_000, 'yuqori', 'Operator qayta qo‘ng‘iroq qiladi', 1.5, 'Qo‘ng‘iroqda 1 ni bosdi, narxni so‘radi.'],
  ['uchrashuv', 'Bepul ko‘rik, Chilonzor', 2_000_000, 'yuqori', 'Ko‘rik: ertaga 10:00', 26, 'Qo‘ng‘iroqdan keyin ko‘rikka yozildi.'],
  ['qayta', 'Rulda edi', null, "o'rta", 'Kechqurun qo‘ng‘iroq', -2, 'Mijoz rulda edi, kechqurun gaplashishni so‘radi.'],
  ['yangi', 'Operator band edi', null, "o'rta", '30 daqiqada qayta qo‘ng‘iroq', 0.5, 'Mijoz 1 ni bosdi, operatorlar band edi.'],
  ['yutildi', 'Aksiya bo‘yicha xarid', 3_100_000, 'yuqori', null, null, 'Qo‘ng‘iroqdan keyin to‘lov qildi.'],
  ['yutqazildi', '2 ni bosdi', null, 'past', null, null, 'Mijoz 2 ni bosdi: qiziqmaydi.'],
  ['qiziqdi', 'Ofis uchun servis', 8_400_000, 'yuqori', 'Tijorat taklifi', 5, 'Ofis menejeri, 12 ta blok uchun servis.'],
  ['uchrashuv', 'Showroom: juma', 4_200_000, 'yuqori', 'Juma 16:00 showroom', 52, null],
  ['yangi', 'Ko‘rgazmadan kontakt', 600_000, null, 'Tanishtiruv xati', null, null],
  ['qayta', 'Oy oxirida qaror', 2_700_000, "o'rta", 'Oy oxirida qo‘ng‘iroq', 240, 'Byudjet oy oxirida tasdiqlanadi.'],
  ['yutildi', 'Tavsiya bo‘yicha', 1_900_000, 'yuqori', null, null, 'Do‘stining tavsiyasi bilan keldi.'],
  ['qiziqdi', 'Restoran uchun 4 blok', 9_600_000, 'yuqori', 'O‘lchov uchun usta', 30, 'Yangi restoran, 4 ta blok va ventilyatsiya.'],
  ['yangi', 'Saytdan qo‘ng‘iroq so‘rovi', null, null, 'Qo‘ng‘iroq qilish', -0.5, null],
  ['uchrashuv', 'Maktab uchun taklif', 14_500_000, "o'rta", 'Direktor bilan uchrashuv', 98, 'Xususiy maktab, 9 ta sinf xonasi.'],
]
CALL_LEADS.forEach(([stage, title, value, interest, next, dueH, summary], k) => {
  const c = addContact(34 + k, 'manual', 60 * 2 + k * 70)
  addLead(c, null, { stage, title, value, interest, next, dueH, summary, op: OPS[k % OPS.length]!.userId, source: k % 3 === 2 ? 'manual' : 'call' }, 60 * 2 + k * 70)
})
CONVS.sort((a, b) => Date.parse(b.last?.at ?? '0') - Date.parse(a.last?.at ?? '0'))
CONVS.find(c => c.mode === 'human' && c.status === 'open')!.assigneeId = ME_ID // something under "Mening"
for (const c of CONVS) c.assigneeName = opName(c.assigneeId)

// campaigns and calls
export const CAMPAIGNS: Campaign[] = [
  { id: 'cp_kuz', name: 'Kuzgi aksiya', status: 'running', agentId: 'ag_sardor', total: 240, called: 0, answered: 0, connected: 0, createdAt: ago(60 * 5) },
  { id: 'cp_vip', name: 'VIP mijozlar: qayta aloqa', status: 'paused', agentId: 'ag_sardor', total: 60, called: 0, answered: 0, connected: 0, createdAt: ago(60 * 28) },
  { id: 'cp_eslatma', name: 'Ertangi ko‘riklar eslatmasi', status: 'running', agentId: 'ag_madina', total: 18, called: 0, answered: 0, connected: 0, createdAt: ago(60 * 2) },
  { id: 'cp_okt', name: 'Oktabr: eski mijozlar', status: 'done', agentId: 'ag_sardor', total: 320, called: 0, answered: 0, connected: 0, createdAt: ago(60 * 24 * 19) },
  { id: 'cp_sen', name: 'Sentabr: javobsiz lidlar', status: 'done', agentId: null, total: 140, called: 0, answered: 0, connected: 0, createdAt: ago(60 * 24 * 41) },
  { id: 'cp_yil', name: 'Yangi yil oldidan', status: 'draft', agentId: 'ag_sardor', total: 410, called: 0, answered: 0, connected: 0, createdAt: ago(60 * 6) },
]
export const CALLS: Call[] = []
const CALL_SUM: Partial<Record<CallStatus, string[]>> = {
  connected: ['Mijoz 1 ni bosdi, operator bilan gaplashdi.', 'Mijoz ko‘rikka yozildi: ertaga 10:00.', 'Narxni so‘radi, tijorat taklifi yuboriladi.', 'Ko‘rik vaqtini tasdiqladi.'],
  answered: ['Javob berdi, lekin tugma bosmadi.', 'Agent bilan gaplashdi, keyinroq qaror qiladi.'],
  declined: ['Mijoz 2 ni bosdi: qiziqmaydi.'],
  operator_busy: ['1 ni bosdi, operatorlar band edi: qayta qo‘ng‘iroq rejalandi.'],
  blocked: ['Raqam "qo‘ng‘iroq qilmang" ro‘yxatida, o‘tkazib yuborildi.'],
  failed: ['SIP 503: trunk javob bermadi.'],
}
const MIX: CallStatus[] = ['connected', 'no_answer', 'answered', 'busy', 'connected', 'no_answer', 'declined', 'connected', 'operator_busy', 'no_answer', 'answered', 'failed', 'connected', 'busy', 'blocked', 'no_answer']
function mkCall(cp: Campaign | null, k: number, st: CallStatus, minAgo: number | null): Call {
  const i = (k * 7 + (cp ? cp.name.length : 3)) % NAMES.length
  const dur = st === 'connected' ? 48 + ((k * 37) % 240) : st === 'answered' || st === 'declined' || st === 'operator_busy' ? 9 + (k % 20) : 0
  const sums = CALL_SUM[st]
  return { id: id('cl'), campaignId: cp?.id ?? null, direction: cp ? 'out' : 'in', status: st, durationSec: dur, startedAt: minAgo == null ? null : ago(minAgo), summary: sums ? sums[k % sums.length]! : null, contact: { id: `ct_call_${i}`, name: NAMES[i]!, phone: phone(100 + k + i) } }
}
const plan: [string, number, number][] = [['cp_kuz', 46, 2], ['cp_eslatma', 9, 1], ['cp_vip', 22, 60 * 27], ['cp_okt', 30, 60 * 24 * 18], ['cp_sen', 12, 60 * 24 * 40]]
for (const [cid, count, base] of plan) {
  const cp = CAMPAIGNS.find(c => c.id === cid)!
  for (let k = 0; k < count; k++) CALLS.push(mkCall(cp, k, MIX[(k + cid.length) % MIX.length]!, base + k * (cid === 'cp_kuz' ? 6 : 9)))
  // the history of a campaign is bigger than the 100 calls the log shows: scale the counters
  const scale = cid === 'cp_okt' ? 320 / count : cid === 'cp_sen' ? 140 / count : cid === 'cp_vip' ? 1 : 1
  const done = CALLS.filter(c => c.campaignId === cid)
  cp.called = Math.round(done.length * scale)
  cp.answered = Math.round(done.filter(c => ['answered', 'connected', 'declined', 'operator_busy'].includes(c.status)).length * scale)
  cp.connected = Math.round(done.filter(c => c.status === 'connected').length * scale)
}
// inbound calls (operobot dialer callbacks)
for (let k = 0; k < 6; k++) CALLS.push(mkCall(null, k, k % 3 ? 'connected' : 'no_answer', 20 + k * 85))
// queued calls of the running campaigns
for (let k = 0; k < 8; k++) CALLS.push(mkCall(CAMPAIGNS[0]!, 100 + k, 'queued', null))
CALLS.sort((a, b) => (b.startedAt ? Date.parse(b.startedAt) : 0) - (a.startedAt ? Date.parse(a.startedAt) : 0))

export const PLANS: Plan[] = [
  { key: 'start', name: 'Start', priceMonth: 0, limits: { operators: 1, channels: 2, messages: 300, aiReplies: 100, callMinutes: 0 }, features: ['Inbox va doska', '2 ta kanal', 'AI javob: 100 / oy', 'Sayt vidjeti'] },
  { key: 'biznes', name: 'Biznes', priceMonth: 149_000, limits: { operators: 3, channels: 4, messages: 5_000, aiReplies: 2_000, callMinutes: 300 }, features: ['3 operator', 'Telegram, WhatsApp, Instagram, SMS', 'AI javob: 2 000 / oy', "Chiquvchi qo'ng'iroq: 300 daqiqa", 'MCP va API'] },
  { key: 'pro', name: 'Pro', priceMonth: 449_000, limits: { operators: 10, channels: -1, messages: 30_000, aiReplies: 15_000, callMinutes: 2_000 }, features: ['10 operator', 'Barcha kanallar', 'AI javob: 15 000 / oy', 'Ovozli AI agent', "Qo'ng'iroq: 2 000 daqiqa", 'Tahlil va eksport'] },
  { key: 'korporativ', name: 'Korporativ', priceMonth: null, limits: { operators: -1, channels: -1, messages: -1, aiReplies: -1, callMinutes: -1 }, features: ['Cheksiz', "O'z SIP trunki", 'Alohida server (O‘zbekistonda)', 'SLA va shaxsiy menejer'] },
]
export const USAGE = { operators: MEMBERS.length - 1, channels: CHANNELS.length, messages: 18_420, aiReplies: 13_960, callMinutes: 1_386 }
export const INVOICES: Invoice[] = [
  { id: id('inv'), plan: 'pro', months: 1, amount: 449_000, provider: 'payme', status: 'paid', createdAt: ago(60 * 24 * 9) },
  { id: id('inv'), plan: 'pro', months: 1, amount: 449_000, provider: 'click', status: 'failed', createdAt: ago(60 * 24 * 9 + 30) },
  { id: id('inv'), plan: 'pro', months: 1, amount: 449_000, provider: 'payme', status: 'paid', createdAt: ago(60 * 24 * 39) },
  { id: id('inv'), plan: 'biznes', months: 1, amount: 149_000, provider: 'click', status: 'paid', createdAt: ago(60 * 24 * 69) },
  { id: id('inv'), plan: 'biznes', months: 1, amount: 149_000, provider: 'payme', status: 'paid', createdAt: ago(60 * 24 * 99) },
  { id: id('inv'), plan: 'biznes', months: 12, amount: 1_430_400, provider: 'click', status: 'pending', createdAt: ago(60 * 24 * 100) },
  { id: id('inv'), plan: 'biznes', months: 1, amount: 149_000, provider: 'payme', status: 'paid', createdAt: ago(60 * 24 * 129) },
]
