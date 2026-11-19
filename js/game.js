(() => {
  const $ = (s) => document.querySelector(s);
  const el = {
    app: $('#app'), scene: $('#scene'), lane: $('#lane'), farLane: $('#farLane'), gate: $('#gate'),
    timer: $('#timer'), date: $('#dateTag'), queue: $('#queueCount'), pass: $('#passCount'), mute: $('#btnMute'),
    lightGate: $('#lightGate'), lightSiren: $('#lightSiren'), lightRacer: $('#lightRacer'), racerWarn: $('#racerWarn'),
    flash: $('#flash'), handItem: $('#handItem'), trayState: $('#trayState'), cashBadge: $('#cashBadge'),
    paidInfo: $('#paidInfo'), givenInfo: $('#givenInfo'), changeTotal: $('#changeTotal'), changeChips: $('#changeChips'),
    toast: $('#toast'), timeUp: $('#timeUp'), start: $('#startScreen'), result: $('#resultScreen'), resultBody: $('#resultBody'),
  };

  let S = null;
  let session = 0;
  let scale = 0.8;
  let stopX = 60;
  let toastTimer = null;

  function newState(tut = false) {
    return {
      tut: tut ? { i: 0 } : null,
      running: false, t: GAME_TIME, spawnIn: 0, nextHonk: 4, convoyLeft: 0, convoyCd: 0,
      queue: [], booth: null, racer: null, gateBusy: false, gateBroken: false,
      tray: [], seq: 0, lastTick: 0, photoCd: 0,
      stats: { passed: 0, loss: 0, complaints: 0, duty: 0, ambulance: 0, escapes: 0, crashes: 0, caught: 0, overpay: 0, underpay: 0, wrongTicket: 0, misReject: 0, spawned: 0, convoys: 0 },
      log: [],
    };
  }

  // ---------- 工具 ----------
  const later = (ms, fn) => { const s = session; setTimeout(() => { if (s === session && S && S.running) fn(); }, ms); };
  const clock = () => { const e = GAME_TIME - S.t; return `${Math.floor(e / 60)}:${String(Math.floor(e % 60)).padStart(2, '0')}`; };
  function log(text, kind = '') { S.log.push({ at: clock(), text, kind }); }
  function toast(msg, kind = '') {
    el.toast.textContent = msg;
    el.toast.className = `show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.className = ''; }, 1500);
  }
  const plate = () => `${pick(PLATE_PREFIX)}-${String(Math.floor(rand(1000, 9999)))}`;
  const serial = () => String(Math.floor(rand(1000000, 9999999)));

  // ---------- 車輛生成 ----------
  function makeTicket(color, fake = null) {
    return { kind: 'ticket', color, fake, serial: serial(), valid: pick(VALID_DATES), expired: pick(EXPIRED_DATES) };
  }

  function genPayment(car, mode) {
    const tt = TYPE_TICKET[car.type];
    if (mode === 'bigbill') return { kind: 'cash', amount: pick([500, 500, 1000]), tag: 'bigbill' };
    if (mode === 'mischief') {
      const opts = [() => makeTicket(tt, pick(FAKE_KINDS)), () => ({ kind: 'cash', amount: pick(SHORT_CASH[car.type]), tag: 'short' })];
      if (car.type === 'big') opts.push(() => makeTicket('blue'), () => makeTicket('blue'));
      if (car.type === 'trailer') opts.push(() => makeTicket(pick(['blue', 'green'])), () => makeTicket(pick(['blue', 'green'])));
      const p = pick(opts)();
      p.mischief = true;
      return p;
    }
    if (Math.random() < 0.45) return makeTicket(tt);
    return { kind: 'cash', amount: pick(CASH_OPTIONS[car.type]) };
  }

  function makeCar() {
    const id = ++S.seq;
    const r = Math.random();
    const car = { id, plate: plate(), driver: pick(DRIVERS), changeGiven: 0, accepted: false, phase: 'queue' };
    if (id > 2 && r < 0.10 && !S.racer) return Object.assign(car, racerSpec());
    if (id > 1 && r < 0.20) {
      const kind = pick(['ambulance', 'ambulance', 'fire', 'police']);
      return Object.assign(car, { type: 'emergency', emergency: true, kind, fare: 0, payment: null, maxPatience: EMERGENCY_PATIENCE });
    }
    const tr = Math.random();
    const type = tr < 0.55 ? 'small' : tr < 0.83 ? 'big' : 'trailer';
    let kind = 'sedan';
    let colors = { body: pick(CAR_COLORS) };
    if (type === 'big') {
      kind = Math.random() < 0.5 ? 'bus' : 'truck';
      colors = kind === 'bus' ? { body: pick(['#f4f6f7', '#f9e79f', '#aed6f1']), accent: pick(['#1f618d', '#b03a2e', '#117a65']) } : { body: pick(CAR_COLORS), box: pick(BOX_COLORS) };
    } else if (type === 'trailer') {
      kind = 'trailer';
      colors = { body: pick(['#1f3a5f', '#c0392b', '#f4f6f7', '#145a32']), box: pick(CONTAINER_COLORS) };
    }
    Object.assign(car, { type, kind, colors, fare: FARES[type], maxPatience: PATIENCE });
    const m = Math.random();
    let mode = 'normal';
    if (m < 0.19) mode = 'mischief';
    else if (m < 0.50 && (type === 'small' || Math.random() < 0.3)) mode = 'bigbill';
    car.payment = genPayment(car, mode);
    return car;
  }

  function racerSpec() {
    return { racer: true, kind: 'racer', colors: { body: pick(RACER_COLORS) }, driver: '😎' };
  }

  function spawnCustom(spec) {
    const car = Object.assign({ id: ++S.seq, plate: plate(), driver: pick(DRIVERS), changeGiven: 0, accepted: false, phase: 'queue', maxPatience: PATIENCE }, spec);
    car.fare = FARES[car.type];
    createCarEl(car);
    car.el.style.left = `${el.scene.clientWidth + 30}px`;
    el.lane.appendChild(car.el);
    void car.el.offsetWidth;
    S.queue.push(car);
    layout();
  }

  function paymentValid(car) {
    const p = car.payment;
    if (!p) return true;
    if (p.kind === 'ticket') return !p.fake && TICKETS[p.color].value >= car.fare;
    return p.amount >= car.fare;
  }

  function offerLine(car) {
    if (car.emergency) return '🚨 喔伊喔伊～借過借過！';
    const p = car.payment;
    if (p.kind === 'ticket') return p.mischief ? pick(['票啦票啦，快點～', '趕時間！票給你']) : pick(['回數票～', '票給你', '麻煩了']);
    if (p.tag === 'bigbill') return pick(['只有大鈔，找得開吧？', '歹勢，沒零錢']);
    if (p.tag === 'short') return pick(['錢給你～', '零錢都在這了']);
    return p.amount === car.fare ? `剛好 ${p.amount}` : pick(['找錢喔', '麻煩找一下']);
  }

  // ---------- 車輛 DOM ----------
  function carSize(car) {
    const v = VEHICLES[car.kind];
    return { w: v.w * scale, h: v.h * scale };
  }

  function createCarEl(car, far = false) {
    const v = VEHICLES[car.kind];
    const { w, h } = carSize(car);
    const d = document.createElement('div');
    d.className = `veh${car.emergency ? ' emergency' : ''}${far ? ' far' : ''}`;
    d.style.width = `${w}px`;
    d.style.height = `${h}px`;
    d.innerHTML = `${vehicleSVG(car.kind, car.colors)}
      <span class="driver" style="left:${v.driver[0]}%;top:${v.driver[1]}%;font-size:${Math.max(12, h * 0.26)}px">${car.driver}</span>
      ${far ? '' : '<div class="pbar hidden"><i></i></div><div class="bubble hidden"></div>'}`;
    car.el = d;
    car.w = w;
    return d;
  }

  function setLeft(car, x, dur = 0.7, ease = 'ease-out') {
    car.el.style.transition = `left ${dur}s ${ease}`;
    car.el.style.left = `${x}px`;
  }

  function layout() {
    let x = stopX;
    if (S.booth) {
      if (S.booth.phase !== 'leaving') setLeft(S.booth, stopX, 0.9);
      x = stopX + S.booth.w + 10;
    }
    S.queue.forEach((c) => { setLeft(c, x, 0.9); x += c.w + 10; });
    el.queue.textContent = `排隊 ${S.queue.length}`;
    el.queue.classList.toggle('warn', S.queue.length >= 3);
  }

  function bubble(car, text, kind = '') {
    const b = car.el && car.el.querySelector('.bubble');
    if (!b) return;
    b.textContent = text;
    b.className = `bubble ${kind}`;
  }
  function face(car, emoji) {
    const f = car.el && car.el.querySelector('.driver');
    if (f) f.textContent = emoji;
  }

  // ---------- 生成與進站 ----------
  function spawn() {
    const car = makeCar();
    S.stats.spawned++;
    if (car.racer) { startRacer(car); return; }
    createCarEl(car);
    car.el.style.left = `${el.scene.clientWidth + 30}px`;
    el.lane.appendChild(car.el);
    void car.el.offsetWidth;
    S.queue.push(car);
    layout();
  }

  function advance() {
    const car = S.queue.shift();
    S.booth = car;
    car.phase = 'arriving';
    layout();
    Sfx.engineIn();
    renderTray();
    later(850, () => {
      if (S.booth !== car) return;
      car.phase = 'waiting';
      car.patience = car.maxPatience;
      car.el.querySelector('.pbar').classList.remove('hidden');
      bubble(car, offerLine(car), car.emergency ? 'alert' : '');
      if (car.emergency) Sfx.sirenStart();
      renderTray();
      tutEvent('offer');
    });
  }

  // ---------- 闖關車 ----------
  function startRacer(car) {
    createCarEl(car, true);
    const W = el.scene.clientWidth;
    car.el.style.left = `${W + 20}px`;
    el.farLane.appendChild(car.el);
    void car.el.offsetWidth;
    car.el.style.transition = `left ${RACER_WINDOW}s cubic-bezier(.3,.15,.75,.85)`;
    car.el.style.left = `${-car.w - 60}px`;
    car.time = RACER_WINDOW;
    S.racer = car;
    el.lightRacer.classList.add('on');
    el.racerWarn.classList.remove('hidden');
    Sfx.alarm();
    Sfx.engineOut();
  }

  function endRacer(caught) {
    const r = S.racer;
    S.racer = null;
    el.lightRacer.classList.remove('on');
    el.racerWarn.classList.add('hidden');
    if (!caught) {
      tutEvent('racerMiss');
      S.stats.escapes++;
      S.stats.duty++;
      log(`漏抓闖關車 ${r.plate}（逃費＋失職）`, 'bad');
      toast('💨 飆車族衝過去了！漏抓闖關', 'bad');
      const smoke = document.createElement('div');
      smoke.className = 'smoke';
      smoke.textContent = '💨🤪';
      el.scene.appendChild(smoke);
      setTimeout(() => smoke.remove(), 1600);
    }
    if (caught) r.el.classList.add('caught');
    setTimeout(() => r.el.remove(), Math.max(0, r.time) * 1000 + 400);
  }

  // ---------- 玩家操作 ----------
  function boothReady() {
    return S && S.running && S.booth && (S.booth.phase === 'waiting' || S.booth.phase === 'reoffer');
  }

  function acceptTicket() {
    if (!S || !S.running || !tutAllow('accept')) return;
    if (!boothReady() || S.booth.phase !== 'waiting') { toast('托盤上沒有東西'); return; }
    const car = S.booth;
    if (!car.payment || car.payment.kind !== 'ticket') { toast('這不是回數票'); Sfx.error(); return; }
    if (car.accepted) { toast('票已經收了'); return; }
    car.accepted = true;
    Sfx.tear();
    renderTray();
    tutEvent('accept');
  }

  function rejectPayment() {
    if (!S || !S.running || !tutAllow('reject')) return;
    if (!boothReady() || S.booth.phase !== 'waiting') { toast('托盤上沒有東西'); return; }
    const car = S.booth;
    if (car.emergency) {
      if (!car.blocked) {
        car.blocked = true;
        S.stats.ambulance++;
        S.stats.complaints += 2;
        log(`攔下鳴笛公務車 ${car.plate}（重大客訴 +2）`, 'bad');
      }
      bubble(car, '🚨 人命關天啊！！快開！', 'alert');
      face(car, '😡');
      Sfx.sirenStart(true);
      Sfx.honk(true);
      toast('🚨 你攔下了救護車！', 'bad');
      shake();
      return;
    }
    if (car.accepted) { toast('票已撕下，退不回去了'); Sfx.error(); return; }
    const valid = paymentValid(car);
    car.phase = 'reoffer';
    car.changeGiven = 0;
    if (valid) {
      S.stats.complaints += 2;
      S.stats.misReject++;
      car.patience = Math.max(2, car.patience - 4);
      log(`誤退正確的付款 ${car.plate}（重大客訴 +2）`, 'bad');
      bubble(car, pick(['你眼睛脫窗喔！', '這張明明就對的！']), 'angry');
      face(car, '😡');
      Sfx.honk(true);
      toast('😡 誤退了正確的付款！', 'bad');
    } else {
      car.patience = Math.max(2, car.patience - 3);
      bubble(car, pick(['嘖…好啦', '被你發現了', '換一個啦']));
      face(car, '😒');
    }
    renderTray();
    tutEvent('reject');
    later(1300, () => {
      if (S.booth !== car || car.phase !== 'reoffer') return;
      if (!valid) car.payment = car.nextPayment || genPayment(car, 'normal');
      car.phase = 'waiting';
      bubble(car, valid ? '拿去啦！' : offerLine(car), valid ? 'angry' : '');
      renderTray();
      tutEvent('offer');
    });
  }

  function openGate() {
    if (!S || !S.running || !tutAllow('gate')) return;
    if (S.gateBusy || S.gateBroken) { toast('柵欄動作中'); return; }
    if (!boothReady()) { toast('目前沒有車輛停靠'); return; }
    release(S.booth);
  }

  function photo() {
    if (!S || !S.running) return;
    if (S.photoCd > 0) return;
    S.photoCd = 0.8;
    Sfx.shutter();
    el.flash.classList.remove('go');
    void el.flash.offsetWidth;
    el.flash.classList.add('go');
    if (S.racer && !S.racer.caught) {
      S.racer.caught = true;
      S.stats.caught++;
      log(`舉發闖關車 ${S.racer.plate}`, 'good');
      toast(`📸 舉發成功！車牌 ${S.racer.plate}`, 'good');
      Sfx.good();
      endRacer(true);
      tutEvent('photo');
    } else {
      toast('畫面中沒有闖關車');
    }
  }

  function addChange(v) {
    if (!S || !S.running) return;
    S.tray.push(v);
    v >= 100 ? Sfx.bill() : Sfx.coin();
    renderChange();
  }
  function clearChange() {
    S.tray = [];
    renderChange();
  }
  function giveChange() {
    if (!S || !S.running) return;
    const sum = S.tray.reduce((a, b) => a + b, 0);
    if (!sum) { toast('找零托盤是空的'); return; }
    if (!tutAllow('give', sum)) return;
    if (!boothReady() || S.booth.phase !== 'waiting') { toast('沒有可以交付的駕駛'); return; }
    S.booth.changeGiven += sum;
    S.tray = [];
    Sfx.give();
    toast(`已交付找零 $${sum}`);
    renderChange();
    renderTray();
    tutEvent('give');
  }

  // ---------- 放行判定 ----------
  function release(car) {
    car.phase = 'leaving';
    const st = S.stats;
    let reaction = { face: '🙂', text: pick(['謝啦～', '👋', '辛苦了']), kind: '' };

    if (car.emergency) {
      if (car.changeGiven > 0) { st.loss += car.changeGiven; st.overpay++; log(`對公務車多給了 $${car.changeGiven}`, 'bad'); }
      reaction = car.blocked ? { face: '😤', text: '你給我記住！', kind: 'angry' } : { face: '🫡', text: '感謝配合！', kind: '' };
    } else {
      const p = car.payment;
      let collected = 0;
      if (p.kind === 'ticket') collected = car.accepted && !p.fake ? TICKETS[p.color].value : 0;
      else collected = p.amount;
      const due = Math.max(0, collected - car.fare);
      const revenue = collected - car.changeGiven;
      const diff = car.fare - revenue;
      if (diff > 0) {
        st.loss += diff;
        let why;
        if (car.changeGiven > due) { why = `多找錢（多找 $${car.changeGiven - due}）`; st.overpay++; reaction = { face: '🤭', text: '咦？多找了…閃！', kind: 'sly' }; }
        else {
          if (p.kind === 'ticket' && !car.accepted) why = '還沒收票就放行';
          else if (p.kind === 'ticket' && p.fake) { why = '收到假票'; st.wrongTicket++; }
          else if (p.kind === 'ticket') { why = `大車收${TICKETS[p.color].name}`; st.wrongTicket++; }
          else why = `付款不足 $${car.fare - p.amount}`;
          reaction = { face: '😏', text: '嘿嘿，賺到了～', kind: 'sly' };
        }
        log(`${car.plate} ${why}：損失 $${diff}`, 'bad');
      } else if (diff < 0) {
        st.complaints++;
        st.underpay++;
        log(`${car.plate} 少找 $${-diff}（客訴 +1）`, 'bad');
        reaction = { face: '🤬', text: '🖕 X！錢找錯啦！', kind: 'angry' };
        Sfx.honk(true);
      }
    }
    st.passed++;
    el.pass.textContent = `通行 ${st.passed}`;
    depart(car, reaction, false);
    tutEvent('gate');
  }

  function timeout(car) {
    const st = S.stats;
    car.phase = 'leaving';
    if (car.emergency) {
      if (!car.blocked) {
        car.blocked = true;
        st.ambulance++;
        st.complaints += 2;
        log(`救護車在亭前卡太久 ${car.plate}（重大客訴 +2）`, 'bad');
      }
      toast('🚨 站長衝出來幫救護車開閘了！', 'bad');
      st.passed++;
      el.pass.textContent = `通行 ${st.passed}`;
      depart(car, { face: '😤', text: '延誤送醫，等著上新聞！', kind: 'angry' }, false);
      return;
    }
    st.loss += CRASH_REPAIR;
    st.complaints++;
    st.crashes++;
    log(`${car.plate} 等到抓狂撞斷柵欄（維修 $${CRASH_REPAIR}、客訴 +1）`, 'bad');
    toast('💥 駕駛撞斷柵欄逃逸！', 'bad');
    depart(car, { face: '😡', text: '不等了啦！！', kind: 'angry' }, true);
  }

  function depart(car, reaction, crash) {
    S.gateBusy = true;
    face(car, reaction.face);
    bubble(car, reaction.text, reaction.kind);
    const pb = car.el.querySelector('.pbar');
    if (pb) pb.classList.add('hidden');
    if (car.emergency) setTimeout(() => Sfx.sirenStop(), 900);
    renderTray();
    if (crash) {
      Sfx.crash();
      shake();
      el.gate.classList.add('broken');
      S.gateBroken = true;
      setLeft(car, -car.w - 60, 0.8, 'ease-in');
      Sfx.engineOut();
    } else {
      Sfx.gate();
      el.gate.classList.add('open');
      setTimeout(() => { Sfx.engineOut(); setLeft(car, -car.w - 60, 1.0, 'ease-in'); }, 280);
    }
    el.lightGate.className = `lamp ${crash ? 'broken' : 'green'}`;
    const s = session;
    setTimeout(() => {
      car.el.remove();
      if (s !== session) return;
      if (S.booth === car) S.booth = null;
      if (crash) {
        toast('🔧 柵欄維修中…');
        setTimeout(() => {
          if (s !== session) return;
          el.gate.classList.remove('broken');
          S.gateBroken = false;
          S.gateBusy = false;
          el.lightGate.className = 'lamp red';
        }, 1200);
      } else {
        el.gate.classList.remove('open');
        el.lightGate.className = 'lamp red';
        Sfx.gate();
        setTimeout(() => { if (s === session) S.gateBusy = false; }, 300);
      }
      renderTray();
      layout();
    }, crash ? 900 : 1300);
  }

  function shake() {
    el.scene.classList.remove('shake');
    void el.scene.offsetWidth;
    el.scene.classList.add('shake');
  }

  // ---------- 畫面渲染 ----------
  function renderTray() {
    const car = S.booth;
    let html = '<div class="tray-empty">等待車輛進站…</div>';
    let state = '';
    let paid = '—';
    let badge = false;
    if (car) {
      if (car.phase === 'arriving') {
        html = '<div class="tray-empty">車輛進站中…</div>';
      } else if (car.phase === 'leaving') {
        html = '<div class="tray-empty">車輛駛離中…</div>';
      } else if (car.phase === 'reoffer') {
        html = '<div class="tray-empty">駕駛正在翻找…</div>';
        state = '退回中';
      } else if (car.emergency) {
        html = `<div class="tray-emergency"><div class="em-ico">🚨</div><div>鳴笛公務車<br><small>駕駛沒有遞出任何東西</small></div></div>`;
        state = car.blocked ? '⚠ 已被攔下' : '';
      } else if (car.payment.kind === 'ticket') {
        html = ticketHTML(car.payment, { accepted: car.accepted });
        state = car.accepted ? '✓ 已收票' : '回數票';
      } else {
        html = cashHTML(car.payment.amount);
        state = car.changeGiven ? `已找 $${car.changeGiven}` : '現金';
        paid = `$${car.payment.amount}`;
        badge = true;
      }
    }
    el.handItem.innerHTML = html;
    el.trayState.textContent = state;
    el.paidInfo.textContent = paid;
    el.givenInfo.textContent = `$${car && car.phase !== 'leaving' ? car.changeGiven : 0}`;
    el.cashBadge.classList.toggle('hidden', !badge);
  }

  function renderChange() {
    const sum = S.tray.reduce((a, b) => a + b, 0);
    el.changeTotal.textContent = sum;
    const sorted = [...S.tray].sort((a, b) => b - a);
    el.changeChips.innerHTML = sorted.length ? sorted.map(moneyChip).join('') : '<span class="chips-empty">點選下方面額放入找零</span>';
  }

  function renderHud() {
    const t = Math.max(0, Math.ceil(S.t));
    el.timer.textContent = S.tut ? '教學' : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    el.timer.classList.toggle('danger', !S.tut && S.t <= 20);
    const car = S.booth;
    if (car && car.phase !== 'arriving' && car.phase !== 'leaving' && car.patience != null) {
      const pct = Math.max(0, car.patience / car.maxPatience);
      const bar = car.el.querySelector('.pbar i');
      bar.style.width = `${pct * 100}%`;
      bar.style.background = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#ef4444';
    }
    const sirenOn = (car && car.emergency && car.phase !== 'leaving') || S.queue.slice(0, 2).some((c) => c.emergency);
    el.lightSiren.classList.toggle('on', !!sirenOn);
  }

  // ---------- 主迴圈 ----------
  function loop(now) {
    if (!S || !S.running) return;
    const dt = Math.min(0.1, (now - S.lastTick) / 1000);
    S.lastTick = now;
    S.photoCd -= dt;

    if (!S.tut) {
      S.t -= dt;
      if (S.t <= 10 && Math.ceil(S.t) !== Math.ceil(S.t + dt)) Sfx.tick();
      if (S.t <= 0) { endGame(); return; }
      S.spawnIn -= dt;
      S.convoyCd -= dt;
      if (S.spawnIn <= 0) {
        spawn();
        if (S.convoyLeft > 0) {
          S.convoyLeft--;
          S.spawnIn += S.convoyLeft > 0 ? CONVOY_GAP : SPAWN_EVERY;
        } else if (S.convoyCd <= 0 && GAME_TIME - S.t >= CONVOY_EARLIEST && Math.random() < CONVOY_CHANCE) {
          const size = CONVOY_SIZE[0] + Math.floor(Math.random() * (CONVOY_SIZE[1] - CONVOY_SIZE[0] + 1));
          S.convoyLeft = size - 1;
          S.convoyCd = CONVOY_COOLDOWN;
          S.stats.convoys++;
          S.spawnIn += CONVOY_GAP;
          toast(`🚗🚙🚌 連假車潮湧入！一口氣來 ${size} 台`, 'bad');
          Sfx.honk(true);
        } else {
          S.spawnIn += SPAWN_EVERY;
        }
      }
    }

    const car = S.booth;
    if (!S.tut && car && (car.phase === 'waiting' || car.phase === 'reoffer')) {
      car.patience -= dt;
      if (!car.emergency && !car.urged && car.patience < car.maxPatience * 0.3) {
        car.urged = true;
        face(car, '😠');
        bubble(car, '快點啦！！', 'angry');
        Sfx.honk();
      }
      if (car.patience <= 0) timeout(car);
    }

    if (!S.booth && S.queue.length && !S.gateBusy && !S.gateBroken) advance();

    if (S.racer && !S.racer.caught) {
      S.racer.time -= dt;
      if (S.racer.time <= 0) endRacer(false);
    }

    S.nextHonk -= dt;
    if (S.nextHonk <= 0) {
      if (S.queue.length >= 3) Sfx.farHonk();
      S.nextHonk = S.queue.length >= 5 ? rand(1, 2.2) : rand(2.5, 5);
    }

    renderHud();
    requestAnimationFrame(loop);
  }

  function measure() {
    const W = el.scene.clientWidth;
    scale = Math.min(1.1, Math.max(0.62, W / 470));
    stopX = Math.round(W * 0.14);
    el.gate.style.left = `${stopX - 16}px`;
    el.gate.style.setProperty('--arm', `${Math.round(70 * scale)}px`);
  }

  // ---------- 新手教學 ----------
  const TUT = [
    { text: '歡迎來到<b>民國 88 年</b>的國道收費站！<br>在 2013 年 eTag 全面上路以前，每台車經過收費站都要<b>停下來</b>，把過路費交給收費亭裡的收費員——也就是你。', next: true },
    { text: '駕駛可以付<b>現金</b>，或交出事先買好的<b>回數票</b>（一張抵一次過路費）。<br>不同車種費率不同、票色也不同，下方<b class="y">黃框票價列</b>隨時可以查。', next: true, hl: '#fareStrip' },
    { enter: () => spawnCustom({ type: 'small', kind: 'sedan', colors: { body: '#c0392b' }, payment: makeTicket('blue') }), text: '第一台車來了！先看上方畫面判斷車種：這是一台<b>小型車</b>，應收 <b>40 元</b>。', wait: 'offer' },
    { text: '他遞出<b class="b">藍色回數票</b>（小型車 40 元），有紅色「高公局驗訖」章、也沒過期，正確！<br>按【收下回數票】。', wait: 'accept', hl: '#btnAccept' },
    { text: '收好了！按【開閘放行】讓他離開。', wait: 'gate', hl: '#btnGate' },
    { enter: () => spawnCustom({ type: 'big', kind: 'bus', colors: { body: '#f4f6f7', accent: '#1f618d' }, payment: makeTicket('blue'), nextPayment: makeTicket('green') }), text: '接著是一台<b>遊覽車</b>，屬於<b>大型車</b>，應收 <b>50 元</b>。', wait: 'offer' },
    { text: '大型車要用 <b class="g">50 元綠票</b>，他卻拿 <b class="b">40 元藍票</b>想混過去！<br>按【退回重給】。', wait: 'reject', hl: '#btnReject' },
    { text: '駕駛正在換票…', wait: 'offer' },
    { text: '這次是<b class="g">綠票</b>，正確！收下吧。', wait: 'accept', hl: '#btnAccept' },
    { text: '放行！', wait: 'gate', hl: '#btnGate' },
    { enter: () => spawnCustom({ type: 'small', kind: 'sedan', colors: { body: '#2e86c1' }, payment: makeTicket('blue', 'nostamp'), nextPayment: { kind: 'cash', amount: 40 } }), text: '又一台小型車。這次要<b>仔細檢查票面</b>…', wait: 'offer' },
    { text: '這張藍票<b>少了紅色「高公局驗訖」章</b>，是假票！<br>假票還可能<b>字跡模糊、缺角破損、或已過期</b>（今天是 88 年 2 月 15 日）。按【退回重給】。', wait: 'reject', hl: '#btnReject' },
    { text: '被抓包的駕駛正在翻錢包…', wait: 'offer' },
    { text: '他改付<b>現金 40 元</b>，剛好不用找錢，直接【開閘放行】。', wait: 'gate', hl: '#btnGate' },
    { enter: () => spawnCustom({ type: 'trailer', kind: 'trailer', colors: { body: '#1f3a5f', box: '#c0392b' }, payment: { kind: 'cash', amount: 100 } }), text: '貨櫃<b>聯結車</b>來了，應收 <b>65 元</b>。', wait: 'offer' },
    { text: '他付了 <b>100 元</b>：100 − 65 ＝ <b>要找 35 元</b>。<br>點上方【收銀找零】分頁。', wait: 'tabcash', hl: '.tab-btn[data-tab=cash]' },
    { text: '點 <b>10 元 ×3</b>、<b>5 元 ×1</b> 湊出 35 元，再按【交付找零】。點錯可以按【清空】重來。', wait: 'give', check: (sum) => sum === 35, fail: '金額不對！要找 35 元，按【清空】重來', hl: '#denoms, #btnGive' },
    { text: '找好了！切回【票務與閘門】，按【開閘放行】。<br>記住：<b>收完、找完才放行</b>，提早按會損失或被客訴。', wait: 'gate', hl: '.tab-btn[data-tab=gate], #btnGate' },
    { enter: () => spawnCustom({ type: 'emergency', emergency: true, kind: 'ambulance', payment: null, maxPatience: EMERGENCY_PATIENCE }), text: '聽到鳴笛聲了嗎？', wait: 'offer' },
    { text: '<b>救護車、消防車、警車免收費！</b><br>不能退回、也不能拖延，馬上【開閘放行】。攔一次就會被解雇！', wait: 'gate', hl: '#btnGate' },
    { text: '最後一關：有些飆車族會<b>不停車直接衝過去</b>。<br>看到紅色「闖關車輛逼近」警示時，<b>3 秒內</b>按【緊急拍照舉發】。準備好就按下一步。', next: true, hl: '#btnPhoto' },
    { enter: () => startRacer(Object.assign({ id: ++S.seq, plate: plate() }, racerSpec())), text: '來了！快按【緊急拍照舉發】！', wait: 'photo', hl: '#btnPhoto' },
    { text: '教學完成！🎉<br>正式上班時<b>每 6 秒</b>來一台車，還會有<b>連假車潮一口氣來 3～6 台</b>；駕駛只等 <b>20 秒</b>，也會遇到掏大鈔、混假票的客人。3 分鐘內別被解雇喔！', final: true },
  ];

  function tutGo(i) {
    S.tut.i = i;
    const st = TUT[i];
    document.querySelectorAll('.tut-hl').forEach((n) => n.classList.remove('tut-hl'));
    if (st.hl) document.querySelectorAll(st.hl).forEach((n) => n.classList.add('tut-hl'));
    $('#coachText').innerHTML = st.text;
    $('#coachStep').textContent = `${i + 1} / ${TUT.length}`;
    $('#coachNext').classList.toggle('hidden', !st.next);
    $('#coachHome').classList.toggle('hidden', !st.final);
    $('#coachPlay').classList.toggle('hidden', !st.final);
    $('#coachSkip').classList.toggle('hidden', !!st.final);
    if (st.final) {
      try { localStorage.setItem('tollTutDone', '1'); } catch (e) { /* private mode */ }
      Sfx.good();
    }
    if (st.enter) st.enter();
  }

  function tutEvent(name) {
    if (!S || !S.tut) return;
    const i = S.tut.i;
    const st = TUT[i];
    if (name === 'racerMiss' && st.wait === 'photo') {
      toast('太慢了！再來一次', 'bad');
      later(1500, () => { if (S.tut.i === i) st.enter(); });
      return;
    }
    if (st.wait === name) later(name === 'offer' ? 200 : 450, () => { if (S.tut.i === i) tutGo(i + 1); });
  }

  function tutAllow(name, data) {
    if (!S || !S.tut) return true;
    const st = TUT[S.tut.i];
    if (st.wait === name && (!st.check || st.check(data))) return true;
    toast(st.wait === name ? st.fail : '先照教學提示操作喔 👆', 'bad');
    Sfx.error();
    return false;
  }

  function quitToTitle() {
    if (S) S.running = false;
    session++;
    Sfx.sirenStop();
    el.lane.innerHTML = '';
    el.farLane.innerHTML = '';
    document.querySelectorAll('.tut-hl').forEach((n) => n.classList.remove('tut-hl'));
    $('#coach').classList.add('hidden');
    el.result.classList.add('hidden');
    el.start.classList.remove('hidden');
    refreshTutBadge();
  }

  function refreshTutBadge() {
    let done = false;
    try { done = localStorage.getItem('tollTutDone') === '1'; } catch (e) { /* private mode */ }
    $('#tutBadge').classList.toggle('hidden', done);
  }

  function startTutorial() {
    startGame(true);
    $('#coach').classList.remove('hidden');
    tutGo(0);
  }

  function startGame(tut = false) {
    Sfx.init();
    session++;
    $('#coach').classList.add('hidden');
    document.querySelectorAll('.tut-hl').forEach((n) => n.classList.remove('tut-hl'));
    el.lane.innerHTML = '';
    el.farLane.innerHTML = '';
    el.gate.className = '';
    el.lightGate.className = 'lamp red';
    el.lightRacer.classList.remove('on');
    el.racerWarn.classList.add('hidden');
    S = newState(tut);
    measure();
    el.date.textContent = GAME_DATE.label;
    el.pass.textContent = '通行 0';
    el.start.classList.add('hidden');
    el.result.classList.add('hidden');
    el.timeUp.classList.add('hidden');
    switchTab('gate');
    renderTray();
    renderChange();
    S.running = true;
    S.lastTick = performance.now();
    requestAnimationFrame(loop);
  }

  // ---------- 結算 ----------
  function endGame() {
    S.running = false;
    session++;
    Sfx.sirenStop();
    renderHud();
    el.timer.textContent = '0:00';
    el.timeUp.classList.remove('hidden');
    Sfx.alarm();
    setTimeout(showResult, 1500);
  }

  function gradeOf(st) {
    const fire = [];
    if (st.ambulance >= 1) fire.push('ambulance');
    if (st.escapes + st.crashes >= 3) fire.push('escape');
    if (st.loss > 500) fire.push('loss');
    if (st.complaints >= 5) fire.push('complaints');
    if (fire.length) return { g: 'F', news: fire[0], fire };
    if (st.complaints === 0 && st.loss === 0 && st.duty === 0 && st.crashes === 0 && st.passed >= PASS_TARGET) return { g: 'S', news: 'perfect', fire };
    if (st.complaints <= 1 && st.loss <= 100 && st.escapes + st.crashes === 0 && st.passed >= PASS_TARGET - 4) return { g: 'A', fire };
    if (st.complaints <= 3 && st.loss <= 300) return { g: 'B', fire };
    return { g: 'C', fire };
  }

  const FIRE_TEXT = {
    ambulance: '攔截／延誤鳴笛公務車',
    escape: '闖關漏抓／柵欄被撞斷達 3 次',
    loss: '營業損失超過 $500',
    complaints: '客訴達 5 次以上',
  };

  function showResult() {
    el.timeUp.classList.add('hidden');
    const st = S.stats;
    const r = gradeOf(st);
    const G = GRADES[r.g];
    const news = r.news ? NEWS[r.news] : null;
    const rows = [
      ['通行總車數', `${st.passed} 輛`, st.passed >= PASS_TARGET ? 'good' : ''],
      ['營業損失總額', `NT$ ${st.loss}`, st.loss ? 'bad' : 'good'],
      ['客訴總次數', `${st.complaints} 次`, st.complaints ? 'bad' : 'good'],
      ['失職／重大違規', `${st.duty + st.ambulance} 次`, st.duty + st.ambulance ? 'bad' : 'good'],
      ['撞斷柵欄', `${st.crashes} 次`, st.crashes ? 'bad' : ''],
      ['成功舉發闖關', `${st.caught} 輛`, st.caught ? 'good' : ''],
    ];
    const logs = S.log.slice(-10).reverse();
    el.resultBody.innerHTML = `
      <div class="slip ${r.g === 'F' ? 'fired' : ''}">
        <div class="slip-head">交通部臺灣區國道高速公路局<br><b>收費員 當班結算單</b><small>泰山收費站・第 3 車道・${GAME_DATE.label}</small></div>
        <table class="slip-table">${rows.map(([k, v, c]) => `<tr><td>${k}</td><td class="${c}">${v}</td></tr>`).join('')}</table>
        <div class="grade-box"><div class="grade" style="color:${G.color}">${r.g}</div><div><div class="grade-title">${G.title}</div><div class="grade-desc">${G.desc}</div></div></div>
        ${r.fire.length ? `<div class="fire-reason">解雇事由：${r.fire.map((f) => FIRE_TEXT[f]).join('、')}</div>` : ''}
        ${logs.length ? `<details class="log"><summary>當班事件紀錄（${S.log.length}）</summary><ul>${logs.map((l) => `<li class="${l.kind}"><span>${l.at}</span>${l.text}</li>`).join('')}</ul></details>` : ''}
        ${r.g === 'F' ? '<div class="fire-stamp">高公局<br>解雇通知</div>' : ''}
      </div>
      ${news ? `
      <div class="paper ${r.g === 'S' ? 'good' : ''}">
        <div class="paper-mast"><span>國道日報</span><small>中華民國 88 年 2 月 16 日・星期二・號外</small></div>
        <div class="paper-head">${news.head}</div>
        <div class="paper-body"><div class="paper-photo">${news.art}</div><p>【本報訊】${news.body}</p></div>
      </div>` : ''}
      <div class="result-btns">
        <button id="btnAgain" class="big-btn">再上一班</button>
        <button id="btnHome" class="big-btn sub-btn">回到標題</button>
      </div>`;
    el.result.classList.remove('hidden');
    el.result.scrollTop = 0;
    if (r.g === 'F') setTimeout(() => Sfx.stamp(), 650);
    else if (r.g === 'S') Sfx.good();
    $('#btnAgain').onclick = () => startGame();
    $('#btnHome').onclick = quitToTitle;
  }

  // ---------- 分頁與事件 ----------
  function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('#tabGate').classList.toggle('hidden', tab !== 'gate');
    $('#tabCash').classList.toggle('hidden', tab !== 'cash');
    tutEvent(`tab${tab}`);
  }

  document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('pointerdown', () => switchTab(b.dataset.tab)));
  document.querySelectorAll('.denom-btn').forEach((b) => b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    addChange(Number(b.dataset.v));
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
  }));
  $('#btnAccept').addEventListener('click', acceptTicket);
  $('#btnReject').addEventListener('click', rejectPayment);
  $('#btnGate').addEventListener('click', openGate);
  $('#btnPhoto').addEventListener('pointerdown', photo);
  $('#btnClear').addEventListener('click', clearChange);
  $('#btnGive').addEventListener('click', giveChange);
  $('#btnStart').addEventListener('click', () => startGame());
  $('#btnTutorial').addEventListener('click', startTutorial);
  $('#coachNext').addEventListener('click', () => tutGo(S.tut.i + 1));
  $('#coachSkip').addEventListener('click', quitToTitle);
  $('#coachHome').addEventListener('click', quitToTitle);
  $('#coachPlay').addEventListener('click', () => startGame());
  refreshTutBadge();
  el.mute.addEventListener('click', () => {
    Sfx.init();
    Sfx.setMuted(!Sfx.muted);
    el.mute.textContent = Sfx.muted ? '🔇' : '🔊';
  });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  window.addEventListener('resize', () => { if (S) { measure(); layout(); } });
})();
