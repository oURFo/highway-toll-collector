// ===== 遊戲常數與素材（全部以 SVG / HTML 繪製，免外部圖檔） =====
const GAME_TIME = 180;
const SPAWN_EVERY = 7;
const PATIENCE = 20;
const EMERGENCY_PATIENCE = 8;
const RACER_WINDOW = 3;
const PASS_TARGET = 18;
const CRASH_REPAIR = 300;
const GAME_DATE = { y: 88, m: 2, d: 15, label: '88年2月15日・春節連假' };

const FARES = { small: 40, big: 50, trailer: 65, emergency: 0 };

const TICKETS = {
  blue:   { cls: '小型車', value: 40, name: '藍票' },
  green:  { cls: '大型車', value: 50, name: '綠票' },
  orange: { cls: '聯結車', value: 65, name: '橘票' },
};
const TYPE_TICKET = { small: 'blue', big: 'green', trailer: 'orange' };

const FAKE_KINDS = ['blur', 'torn', 'expired', 'nostamp'];
const VALID_DATES = ['89.06.30', '89.12.31', '90.03.31', '88.12.31'];
const EXPIRED_DATES = ['87.12.31', '86.06.30', '88.01.31', '87.06.30'];

const CASH_OPTIONS = {
  small:   [40, 40, 50, 50, 100, 100, 60],
  big:     [50, 50, 100, 100, 60, 70],
  trailer: [65, 70, 100, 100, 80],
};
const SHORT_CASH = { small: [30, 35], big: [40, 45], trailer: [50, 55, 60] };

const DENOMS = [1000, 500, 100, 50, 10, 5];
const CHANGE_DENOMS = [500, 100, 50, 10, 5];

const CAR_COLORS = ['#c0392b', '#2e86c1', '#f1c40f', '#ecf0f1', '#27ae60', '#7f8c8d', '#8e44ad', '#e67e22', '#1f3a5f', '#d35400'];
const BOX_COLORS = ['#ecf0f1', '#f5d76e', '#d5dbdb', '#a9cce3'];
const CONTAINER_COLORS = ['#c0392b', '#2e86c1', '#1e8449', '#b9770e', '#5b2c6f'];
const RACER_COLORS = ['#a3e635', '#f97316', '#facc15', '#22d3ee', '#f43f5e'];
const DRIVERS = ['🧑', '👨', '👩', '🧔', '👴', '👵', '👱', '👨‍🦱', '👩‍🦰', '🧓'];
const PLATE_PREFIX = ['AB', 'CK', 'DR', 'EF', 'GH', 'KL', 'MN', 'QS', 'TT', 'XZ'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.random() * (b - a);

// ---------- 車輛 SVG（側視，車頭朝左） ----------
function wheel(cx, cy, r) {
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#17171b"/><circle cx="${cx}" cy="${cy}" r="${r * 0.52}" fill="#a7b0ba"/><circle cx="${cx}" cy="${cy}" r="${r * 0.2}" fill="#3a3f45"/></g>`;
}
const GLASS = '#a8d8ef';
const shadow = (w, y) => `<ellipse cx="${w / 2}" cy="${y}" rx="${w / 2 - 4}" ry="3.5" fill="rgba(0,0,0,.35)"/>`;
const lightbar = (x, y) => `<rect class="lb-red" x="${x}" y="${y}" width="9" height="5" rx="1.5"/><rect class="lb-blue" x="${x + 10}" y="${y}" width="9" height="5" rx="1.5"/>`;

const VEHICLES = {
  sedan: {
    w: 120, h: 60, driver: [42, 34],
    svg: (c) => `${shadow(120, 56)}
      <path d="M5,47 L5,35 Q6,29 18,28 L33,26 L45,13 Q47,11 51,11 L86,11 Q91,11 94,15 L104,27 L111,29 Q116,31 116,37 L116,47 Z" fill="${c.body}" stroke="rgba(0,0,0,.45)" stroke-width="1"/>
      <path d="M48,15 L60,15 L60,26 L37,26 Z" fill="${GLASS}"/>
      <path d="M64,15 L86,15 Q89,15 91,18 L97,26 L64,26 Z" fill="${GLASS}"/>
      <line x1="62" y1="28" x2="62" y2="44" stroke="rgba(0,0,0,.3)"/>
      <rect x="5" y="33" width="6" height="4" rx="1" fill="#ffe680"/>
      <rect x="112" y="33" width="4" height="5" fill="#e33"/>
      <rect x="5" y="42" width="111" height="3" fill="rgba(0,0,0,.25)"/>
      ${wheel(27, 47, 9)}${wheel(93, 47, 9)}`,
  },
  police: {
    w: 120, h: 60, driver: [42, 34],
    svg: () => `${shadow(120, 56)}
      <path d="M5,47 L5,35 Q6,29 18,28 L33,26 L45,13 Q47,11 51,11 L86,11 Q91,11 94,15 L104,27 L111,29 Q116,31 116,37 L116,47 Z" fill="#f4f6f7" stroke="rgba(0,0,0,.45)" stroke-width="1"/>
      <path d="M48,15 L60,15 L60,26 L37,26 Z" fill="${GLASS}"/>
      <path d="M64,15 L86,15 Q89,15 91,18 L97,26 L64,26 Z" fill="${GLASS}"/>
      <rect x="5" y="31" width="111" height="5" fill="#1d4ed8"/>
      <text x="62" y="43" font-size="7" font-weight="900" fill="#1d4ed8" text-anchor="middle">警察 POLICE</text>
      ${lightbar(56, 6)}
      <rect x="5" y="33" width="6" height="4" rx="1" fill="#ffe680"/>
      ${wheel(27, 47, 9)}${wheel(93, 47, 9)}`,
  },
  bus: {
    w: 170, h: 70, driver: [9, 33],
    svg: (c) => `${shadow(170, 66)}
      <rect x="3" y="6" width="164" height="52" rx="8" fill="${c.body}" stroke="rgba(0,0,0,.45)"/>
      <path d="M5,12 L24,10 L24,34 L4,35 Z" fill="${GLASS}"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${30 + i * 22.5}" y="12" width="19" height="19" rx="2" fill="${GLASS}"/>`).join('')}
      <rect x="3" y="37" width="164" height="6" fill="${c.accent}"/>
      <text x="100" y="53" font-size="7" font-weight="900" fill="${c.accent}" text-anchor="middle">國光號 遊覽車</text>
      <rect x="4" y="44" width="6" height="4" fill="#ffe680"/>
      ${wheel(34, 58, 9.5)}${wheel(138, 58, 9.5)}`,
  },
  truck: {
    w: 170, h: 70, driver: [14, 36],
    svg: (c) => `${shadow(170, 66)}
      <rect x="51" y="4" width="116" height="47" fill="${c.box}" stroke="rgba(0,0,0,.4)"/>
      <text x="109" y="32" font-size="11" font-weight="900" fill="#b03a2e" text-anchor="middle">大發通運</text>
      <rect x="4" y="50" width="163" height="6" fill="#2b2b2b"/>
      <path d="M4,58 L4,30 Q4,18 12,16 L44,14 L49,14 L49,58 Z" fill="${c.body}" stroke="rgba(0,0,0,.45)"/>
      <path d="M7,31 L12,19 L31,18 L31,32 Z" fill="${GLASS}"/>
      <rect x="4" y="44" width="6" height="4" fill="#ffe680"/>
      ${wheel(24, 58, 9)}${wheel(120, 58, 9)}${wheel(144, 58, 9)}`,
  },
  trailer: {
    w: 240, h: 72, driver: [9, 36],
    svg: (c) => `${shadow(240, 68)}
      <rect x="58" y="8" width="178" height="46" fill="${c.box}" stroke="rgba(0,0,0,.45)"/>
      ${Array.from({ length: 16 }, (_, i) => `<line x1="${66 + i * 11}" y1="10" x2="${66 + i * 11}" y2="52" stroke="rgba(0,0,0,.18)"/>`).join('')}
      <text x="147" y="36" font-size="11" font-weight="900" fill="rgba(255,255,255,.85)" text-anchor="middle">太平洋貨櫃</text>
      <rect x="4" y="54" width="232" height="5" fill="#2b2b2b"/>
      <path d="M4,60 L4,30 Q4,16 14,14 L48,12 L53,12 L53,60 Z" fill="${c.body}" stroke="rgba(0,0,0,.45)"/>
      <path d="M7,31 L13,18 L32,17 L32,32 Z" fill="${GLASS}"/>
      <rect x="4" y="46" width="6" height="4" fill="#ffe680"/>
      ${wheel(22, 62, 8)}${wheel(42, 62, 8)}${wheel(176, 62, 8)}${wheel(196, 62, 8)}${wheel(216, 62, 8)}`,
  },
  ambulance: {
    w: 135, h: 64, driver: [24, 33],
    svg: () => `${shadow(135, 60)}
      <path d="M4,54 L4,32 Q5,26 14,25 L28,14 Q30,12 34,12 L130,12 L130,54 Z" fill="#fbfcfc" stroke="rgba(0,0,0,.45)"/>
      <path d="M30,16 L44,16 L44,27 L20,27 Z" fill="${GLASS}"/>
      <rect x="4" y="38" width="126" height="5" fill="#d62828"/>
      <rect x="88" y="17" width="8" height="18" fill="#d62828"/><rect x="83" y="22" width="18" height="8" fill="#d62828"/>
      <text x="60" y="34" font-size="8" font-weight="900" fill="#d62828" text-anchor="middle">救護車</text>
      ${lightbar(50, 6)}
      <rect x="4" y="33" width="6" height="4" fill="#ffe680"/>
      ${wheel(27, 54, 9)}${wheel(108, 54, 9)}`,
  },
  fire: {
    w: 175, h: 70, driver: [12, 32],
    svg: () => `${shadow(175, 66)}
      <rect x="42" y="14" width="130" height="44" fill="#c0392b" stroke="rgba(0,0,0,.45)"/>
      <rect x="50" y="5" width="118" height="4" fill="#d0d3d4"/><rect x="50" y="10" width="118" height="2" fill="#d0d3d4"/>
      ${Array.from({ length: 12 }, (_, i) => `<rect x="${52 + i * 10}" y="5" width="2" height="7" fill="#d0d3d4"/>`).join('')}
      <rect x="42" y="38" width="130" height="4" fill="#f4f6f7"/>
      <text x="107" y="32" font-size="10" font-weight="900" fill="#fdebd0" text-anchor="middle">消防局</text>
      <path d="M4,58 L4,28 Q5,18 14,16 L40,14 L40,58 Z" fill="#c0392b" stroke="rgba(0,0,0,.45)"/>
      <path d="M7,29 L13,19 L30,18 L30,30 Z" fill="${GLASS}"/>
      ${lightbar(10, 9)}
      <rect x="4" y="44" width="6" height="4" fill="#ffe680"/>
      ${wheel(24, 58, 9)}${wheel(128, 58, 9)}${wheel(150, 58, 9)}`,
  },
  racer: {
    w: 125, h: 50, driver: [50, 42],
    svg: (c) => `${shadow(125, 47)}
      <path d="M3,40 L3,33 Q10,26 30,24 L50,16 Q54,14 60,14 L88,15 Q96,16 102,22 L116,24 L118,15 L124,15 L123,40 Z" fill="${c.body}" stroke="rgba(0,0,0,.5)"/>
      <path d="M54,18 L86,18 L94,24 L42,25 Z" fill="#1f2937"/>
      <path d="M20,32 L40,30 L34,34 L52,33 L30,37 Z" fill="#111" opacity=".55"/>
      <rect x="3" y="31" width="7" height="3" fill="#fff9c4"/>
      ${wheel(26, 40, 8)}${wheel(100, 40, 8)}`,
  },
};

function vehicleSVG(kind, colors) {
  const v = VEHICLES[kind];
  return `<svg viewBox="0 0 ${v.w} ${v.h}" xmlns="http://www.w3.org/2000/svg">${v.svg(colors || {})}</svg>`;
}

// ---------- 回數票 ----------
function ticketHTML(p, opts = {}) {
  const t = TICKETS[p.color];
  const fake = p.fake;
  const valid = fake === 'expired' ? p.expired : p.valid;
  const cls = ['ticket', `t-${p.color}`];
  if (fake) cls.push(`fake-${fake}`);
  if (opts.small) cls.push('t-small');
  if (opts.accepted) cls.push('t-accepted');
  return `<div class="${cls.join(' ')}">
    <div class="t-top">交通部臺灣區國道高速公路局</div>
    <div class="t-main"><span class="t-title">${fake === 'blur' ? '回數栗' : '回數票'}</span><span class="t-value">${t.value}<small>元</small></span></div>
    <div class="t-cls">${t.cls}專用</div>
    <div class="t-foot"><span>No.${p.serial}</span><span>有效期限至 ${valid}</span></div>
    ${fake === 'nostamp' ? '' : '<div class="t-stamp">高公局<br>驗訖</div>'}
    ${opts.accepted ? '<div class="t-done">✓ 已收票</div>' : ''}
  </div>`;
}

// ---------- 現金 ----------
function splitCash(amount) {
  const out = [];
  let left = amount;
  for (const d of DENOMS) {
    while (left >= d) { out.push(d); left -= d; }
  }
  return out;
}
function moneyChip(v) {
  return v >= 100
    ? `<span class="bill b${v}"><b>${v}</b><i>中華民國</i></span>`
    : `<span class="coin c${v}"><b>${v}</b></span>`;
}
function cashHTML(amount) {
  return `<div class="cash-stack">${splitCash(amount).map(moneyChip).join('')}</div>
    <div class="cash-total">現金 <b>$${amount}</b></div>`;
}

// ---------- 新聞頭條 ----------
const NEWS = {
  ambulance: {
    head: '《公憤》收費員竟攔截鳴笛救護車索討 40 元！全網怒轟：沒血沒淚',
    body: '救護車受阻畫面曝光引爆民怨，高公局緊急鞠躬道歉並宣布即刻開除該員。',
    art: '🚑🚧😡',
  },
  escape: {
    head: '《誇張》國道收費站淪無政府狀態！柵欄遭撞飛、飆車族爽免錢',
    body: '民眾直擊多輛車高速闖關竟無人舉發，議員痛批公帑流失，要求全面改裝電子收費。',
    art: '🏎️💨🚧',
  },
  loss: {
    head: '《奇聞》佛心收費亭大放送！繳 40 元過路費竟找回 500 元',
    body: '駕駛笑稱「開一趟國道還倒賺」，站長對帳崩潰，當場扣光該員薪水。',
    art: '💸😏💸',
  },
  complaints: {
    head: '《塞爆》收費員頻頻找錯錢引爆口角！國道連假回堵長達十公里',
    body: '用路人氣炸下車理論，後方喇叭聲震天響，成為史上最慘塞車噩夢。',
    art: '🚗🚙🚌📢',
  },
  perfect: {
    head: '《神技》三分鐘狂收百車零失誤！傳奇收費員手速快過電腦',
    body: '網友讚嘆「根本不需要蓋 eTag」，高公局表態將頒發終身榮譽勳章。',
    art: '🏅🛣️✨',
  },
};

const GRADES = {
  S: { title: '國道傳說神手', desc: '0 客訴、0 損失、車流暢通，獲高公局公開表揚！', color: '#f5c542' },
  A: { title: '資深站務員', desc: '極少失誤，車流順暢，站長很放心。', color: '#4ade80' },
  B: { title: '過勞約聘員', desc: '偶有找錯錢或小回堵，收到站長口頭叮嚀。', color: '#60a5fa' },
  C: { title: '賠錢扣薪族', desc: '虧損過多，本月獎金全數充公。', color: '#fb923c' },
  F: { title: '記過解雇', desc: '高公局人事室已寄出解雇通知，明天不用來了。', color: '#ef4444' },
};
