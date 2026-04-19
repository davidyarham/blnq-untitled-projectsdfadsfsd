
'use strict';

// ─── MARKET DATA ENGINE ────────────────────────────────────────────────────────
const INSTRUMENTS = {
  AAPL:  { name: 'Apple Inc.',            price: 189.45, vol: 0.018, sector: 'Tech' },
  MSFT:  { name: 'Microsoft Corp.',       price: 415.30, vol: 0.015, sector: 'Tech' },
  GOOGL: { name: 'Alphabet Inc.',         price: 175.80, vol: 0.019, sector: 'Tech' },
  AMZN:  { name: 'Amazon.com Inc.',       price: 198.60, vol: 0.022, sector: 'Tech' },
  JPM:   { name: 'JPMorgan Chase',        price: 215.40, vol: 0.014, sector: 'Finance' },
  GS:    { name: 'Goldman Sachs',         price: 502.10, vol: 0.017, sector: 'Finance' },
  MS:    { name: 'Morgan Stanley',        price: 101.30, vol: 0.016, sector: 'Finance' },
  NVDA:  { name: 'NVIDIA Corp.',          price: 875.40, vol: 0.028, sector: 'Tech' },
  TSLA:  { name: 'Tesla Inc.',            price: 245.80, vol: 0.035, sector: 'Auto' },
  SPY:   { name: 'SPDR S&P 500 ETF',     price: 517.20, vol: 0.010, sector: 'ETF' },
  EURUSD:{ name: 'EUR/USD',              price: 1.0845, vol: 0.006, sector: 'FX' },
  GBPUSD:{ name: 'GBP/USD',             price: 1.2710, vol: 0.007, sector: 'FX' },
  XOM:   { name: 'ExxonMobil Corp.',     price: 119.85, vol: 0.016, sector: 'Energy' },
  GLD:   { name: 'SPDR Gold ETF',        price: 221.40, vol: 0.012, sector: 'Commodity' },
};

// State
const state = {
  prices:     {},       // current prices
  prevPrices: {},       // last-tick prices
  openPrices: {},       // session open
  highPrices: {},       // session high
  lowPrices:  {},       // session low
  volumes:    {},       // volume
  positions:  {},       // { symbol: { qty, avgPrice } }
  orders:     [],       // all orders
  orderIdSeq: 1000,
  activeSymbol: 'AAPL',
  orderSide:  'buy',
  priceHistory: {},     // symbol → [...prices]
  volHistory:   {},     // symbol → [...vols]
  ordersToday: 0,
  fillsToday:  0,
  pnlHistory: [],
};

// Initialise prices
for (const [sym, d] of Object.entries(INSTRUMENTS)) {
  state.prices[sym]     = d.price;
  state.prevPrices[sym] = d.price;
  state.openPrices[sym] = d.price;
  state.highPrices[sym] = d.price;
  state.lowPrices[sym]  = d.price;
  state.volumes[sym]    = Math.floor(Math.random() * 5_000_000 + 500_000);
  state.priceHistory[sym] = Array.from({ length: 80 }, (_, i) => {
    const noise = (Math.random() - 0.5) * d.vol * d.price * 2;
    return +(d.price + noise * (i / 40 - 1)).toFixed(4);
  });
  state.volHistory[sym] = Array.from({ length: 80 }, () =>
    Math.floor(Math.random() * 800_000 + 100_000));
}

// Seed some positions
state.positions['AAPL'] = { qty: 5000,  avgPrice: 184.20 };
state.positions['MSFT'] = { qty: 2000,  avgPrice: 410.50 };
state.positions['NVDA'] = { qty: -1000, avgPrice: 890.00 };
state.positions['JPM']  = { qty: 3000,  avgPrice: 210.80 };

// ─── CHART SETUP ──────────────────────────────────────────────────────────────
const CHART_COLORS = {
  up:      '#00c853',
  down:    '#ff3d3d',
  grid:    'rgba(31,45,61,0.5)',
  text:    '#6e8099',
  line:    '#40a9ff',
  area:    'rgba(64,169,255,0.12)',
  volume:  'rgba(64,169,255,0.4)',
  volUp:   'rgba(0,200,83,0.5)',
  volDown: 'rgba(255,61,61,0.4)',
};

let priceChart, volumeChart, chartType = 'line';

function buildTimeLabels(n) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now - (n - 1 - i) * 60_000);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  });
}

function initCharts() {
  const sym = state.activeSymbol;
  const prices = state.priceHistory[sym];
  const vols   = state.volHistory[sym];
  const labels = buildTimeLabels(prices.length);

  const chartDefaults = {
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: {
      backgroundColor: '#1c2535',
      borderColor: '#2a3d54',
      borderWidth: 1,
      titleColor: '#b0bfd0',
      bodyColor: '#e8edf5',
      bodyFont: { family: 'JetBrains Mono', size: 11 },
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label || 'Price'}: ${fmtPrice(ctx.raw, sym)}`
      }
    }},
    scales: {
      x: { grid: { color: CHART_COLORS.grid }, ticks: { color: CHART_COLORS.text, font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 10 }, border: { color: CHART_COLORS.grid } },
      y: { position: 'right', grid: { color: CHART_COLORS.grid }, ticks: { color: CHART_COLORS.text, font: { family: 'JetBrains Mono', size: 9 }, callback: v => fmtPrice(v, sym) }, border: { color: CHART_COLORS.grid } }
    }
  };

  // Price chart
  priceChart = new Chart(document.getElementById('priceChart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Price',
        data: prices,
        borderColor: CHART_COLORS.line,
        backgroundColor: CHART_COLORS.area,
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        tension: 0.2,
      }]
    },
    options: { ...chartDefaults, responsive: true, maintainAspectRatio: false }
  });

  // Volume chart
  volumeChart = new Chart(document.getElementById('volumeChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Volume',
        data: vols,
        backgroundColor: vols.map((v, i, a) => i === 0 ? CHART_COLORS.volUp : v >= a[i-1] ? CHART_COLORS.volUp : CHART_COLORS.volDown),
        borderWidth: 0,
        borderRadius: 1,
      }]
    },
    options: {
      ...chartDefaults,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { display: false },
        y: { position: 'right', grid: { color: CHART_COLORS.grid }, ticks: { color: CHART_COLORS.text, font: { family: 'JetBrains Mono', size: 8 }, callback: v => fmtVol(v), maxTicksLimit: 3 }, border: { color: CHART_COLORS.grid } }
      },
      plugins: { ...chartDefaults.plugins, tooltip: { ...chartDefaults.plugins.tooltip, callbacks: { label: ctx => ` Vol: ${fmtVol(ctx.raw)}` } } }
    }
  });
}

function updateChart(sym) {
  if (!priceChart) return;
  const prices = state.priceHistory[sym];
  const vols   = state.volHistory[sym];
  const labels = buildTimeLabels(prices.length);
  const lastPrice = prices[prices.length - 1];
  const firstPrice = prices[0];
  const isUp = lastPrice >= firstPrice;
  const lineColor = isUp ? CHART_COLORS.up : CHART_COLORS.down;
  const areaColor = isUp ? 'rgba(0,200,83,0.08)' : 'rgba(255,61,61,0.08)';

  priceChart.data.labels = labels;
  priceChart.data.datasets[0].data = prices;
  priceChart.data.datasets[0].borderColor = lineColor;
  priceChart.data.datasets[0].backgroundColor = areaColor;
  priceChart.update('none');

  volumeChart.data.labels = labels;
  volumeChart.data.datasets[0].data = vols;
  volumeChart.data.datasets[0].backgroundColor = vols.map((v, i, a) =>
    i === 0 ? CHART_COLORS.volUp : v >= a[i-1] ? CHART_COLORS.volUp : CHART_COLORS.volDown);
  volumeChart.update('none');
}

// ─── FORMATTING ────────────────────────────────────────────────────────────────
function fmtPrice(p, sym) {
  if (!sym) sym = state.activeSymbol;
  const isFX = sym === 'EURUSD' || sym === 'GBPUSD';
  if (isFX) return p.toFixed(4);
  return p >= 100 ? p.toFixed(2) : p.toFixed(3);
}
function fmtPct(pct) { return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'; }
function fmtVol(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return (v / 1_000).toFixed(0) + 'K';
  return v.toString();
}
function fmtMoney(v, short) {
  const abs = Math.abs(v);
  let str;
  if (short) {
    if (abs >= 1_000_000) str = '$' + (abs / 1_000_000).toFixed(2) + 'M';
    else if (abs >= 1_000) str = '$' + (abs / 1_000).toFixed(1) + 'K';
    else str = '$' + abs.toFixed(2);
  } else {
    str = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return (v < 0 ? '-' : '+') + str;
}
function fmtTime(d) {
  return d.toLocaleTimeString('en-US', { hour12: false });
}

// ─── TICKER STRIP ──────────────────────────────────────────────────────────────
function buildTickerStrip() {
  const strip = document.getElementById('tickerStrip');
  strip.innerHTML = '';
  const syms = Object.keys(INSTRUMENTS);
  // duplicate for seamless scroll
  [...syms, ...syms].forEach(sym => {
    const p = state.prices[sym];
    const open = state.openPrices[sym];
    const chgPct = (p - open) / open * 100;
    const cls = chgPct >= 0 ? 'up' : 'down';
    const arrow = chgPct >= 0 ? '▲' : '▼';
    const el = document.createElement('span');
    el.className = 'ts-ticker-item';
    el.dataset.sym = sym;
    el.innerHTML = `
      <span class="ts-ticker-item__sym">${sym}</span>
      <span class="ts-ticker-item__price">${fmtPrice(p, sym)}</span>
      <span class="ts-ticker-item__chg ${cls}">${arrow} ${fmtPct(chgPct)}</span>`;
    el.addEventListener('click', () => selectSymbol(sym));
    strip.appendChild(el);
  });
}

function refreshTickerStrip() {
  const items = document.querySelectorAll('.ts-ticker-item');
  const syms = Object.keys(INSTRUMENTS);
  items.forEach((el, i) => {
    const sym = syms[i % syms.length];
    const p = state.prices[sym];
    const open = state.openPrices[sym];
    const chgPct = (p - open) / open * 100;
    const cls = chgPct >= 0 ? 'up' : 'down';
    const arrow = chgPct >= 0 ? '▲' : '▼';
    el.querySelector('.ts-ticker-item__price').textContent = fmtPrice(p, sym);
    const chgEl = el.querySelector('.ts-ticker-item__chg');
    chgEl.textContent = `${arrow} ${fmtPct(chgPct)}`;
    chgEl.className = `ts-ticker-item__chg ${cls}`;
  });
}

// ─── WATCHLIST ─────────────────────────────────────────────────────────────────
function renderWatchlist() {
  const tbody = document.getElementById('watchlistBody');
  const search = document.getElementById('symbolSearch').value.toUpperCase();
  const syms = Object.keys(INSTRUMENTS).filter(s => s.includes(search) || INSTRUMENTS[s].name.toUpperCase().includes(search));
  tbody.innerHTML = '';
  syms.forEach(sym => {
    const p    = state.prices[sym];
    const open = state.openPrices[sym];
    const prev = state.prevPrices[sym];
    const chgPct = (p - open) / open * 100;
    const cls    = chgPct >= 0 ? 'ts-positive' : 'ts-negative';
    const tr = document.createElement('tr');
    tr.className = sym === state.activeSymbol ? 'ts-row--active' : '';
    tr.innerHTML = `
      <td><span style="font-weight:700;color:${sym===state.activeSymbol?'var(--accent)':'var(--text-0)'}">
        ${sym}</span><br><span style="color:var(--text-3);font-size:8px">${INSTRUMENTS[sym].sector}</span></td>
      <td class="ts-num" style="font-family:var(--font-mono)">${fmtPrice(p, sym)}</td>
      <td class="ts-num ${cls}" style="font-family:var(--font-mono)">${fmtPct(chgPct)}</td>
      <td class="ts-num" style="color:var(--text-2)">${fmtVol(state.volumes[sym])}</td>`;
    tr.addEventListener('click', () => selectSymbol(sym));
    tbody.appendChild(tr);
  });
}

// ─── POSITIONS ─────────────────────────────────────────────────────────────────
function renderPositions() {
  const tbody = document.getElementById('positionsBody');
  tbody.innerHTML = '';
  let totalPnl = 0;
  for (const [sym, pos] of Object.entries(state.positions)) {
    if (pos.qty === 0) continue;
    const price = state.prices[sym];
    const pnl = (price - pos.avgPrice) * pos.qty;
    totalPnl += pnl;
    const pnlCls = pnl >= 0 ? 'ts-positive' : 'ts-negative';
    const qtyCls = pos.qty > 0 ? 'ts-pos-long' : 'ts-pos-short';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:700;cursor:pointer" class="${qtyCls}" onclick="selectSymbol('${sym}')">${sym}</td>
      <td class="ts-num ${qtyCls}" style="font-family:var(--font-mono)">${pos.qty.toLocaleString()}</td>
      <td class="ts-num" style="font-family:var(--font-mono);color:var(--text-2)">${fmtPrice(pos.avgPrice, sym)}</td>
      <td class="ts-num ${pnlCls}" style="font-family:var(--font-mono);font-weight:600">${fmtMoney(pnl, true)}</td>`;
    tbody.appendChild(tr);
  }
  const pnlEl = document.getElementById('totalPnl');
  pnlEl.textContent = fmtMoney(totalPnl, true);
  pnlEl.className = `ts-pnl-value ${totalPnl >= 0 ? 'ts-positive' : 'ts-negative'}`;
}

// ─── INSTRUMENT HEADER ─────────────────────────────────────────────────────────
function updateInstrumentHeader(sym) {
  const p    = state.prices[sym];
  const open = state.openPrices[sym];
  const chg  = p - open;
  const chgPct = chg / open * 100;
  document.getElementById('activeSymbol').textContent = sym;
  document.getElementById('activeName').textContent = INSTRUMENTS[sym]?.name || '';
  document.getElementById('activePrice').textContent = fmtPrice(p, sym);
  const chgEl = document.getElementById('activeChange');
  chgEl.textContent = `${chg >= 0 ? '+' : ''}${fmtPrice(chg, sym)} (${fmtPct(chgPct)})`;
  chgEl.className = `ts-instrument-change ${chgPct >= 0 ? 'ts-positive' : 'ts-negative'}`;
  document.getElementById('oOpen').textContent  = fmtPrice(open, sym);
  document.getElementById('oHigh').textContent  = fmtPrice(state.highPrices[sym], sym);
  document.getElementById('oLow').textContent   = fmtPrice(state.lowPrices[sym], sym);
  document.getElementById('oClose').textContent = fmtPrice(p, sym);
  document.getElementById('oVol').textContent   = fmtVol(state.volumes[sym]);
}

// ─── ORDER BOOK ────────────────────────────────────────────────────────────────
function renderOrderBook(sym) {
  const price = state.prices[sym];
  const spread = price * 0.0001;
  const askBase = price + spread / 2;
  const bidBase = price - spread / 2;

  const askBook = document.getElementById('askBook');
  const bidBook = document.getElementById('bidBook');
  askBook.innerHTML = '';
  bidBook.innerHTML = '';

  const maxSize = 50000;
  for (let i = 5; i >= 1; i--) {
    const askP = askBase + i * spread * (0.5 + Math.random() * 0.5);
    const askS = Math.floor(Math.random() * 40000 + 3000);
    const pct = Math.min(askS / maxSize * 100, 100);
    const row = document.createElement('div');
    row.className = 'ts-ob-row ts-ob-row--ask';
    row.innerHTML = `<span>${fmtVol(askS)}</span><span>${fmtPrice(askP, sym)}</span><div class="ts-ob-bar ts-ob-bar--ask" style="width:${pct}%"></div>`;
    askBook.appendChild(row);
  }
  for (let i = 1; i <= 5; i++) {
    const bidP = bidBase - i * spread * (0.5 + Math.random() * 0.5);
    const bidS = Math.floor(Math.random() * 40000 + 3000);
    const pct = Math.min(bidS / maxSize * 100, 100);
    const row = document.createElement('div');
    row.className = 'ts-ob-row ts-ob-row--bid';
    row.innerHTML = `<span>${fmtPrice(bidP, sym)}</span><span>${fmtVol(bidS)}</span><div class="ts-ob-bar ts-ob-bar--bid" style="width:${pct}%"></div>`;
    bidBook.appendChild(row);
  }

  document.getElementById('midPrice').textContent = fmtPrice(price, sym);
  document.getElementById('spreadBadge').textContent = `Spread: ${fmtPrice(spread, sym)}`;

  // Set limit price in order entry
  const orderPriceEl = document.getElementById('orderPrice');
  if (document.activeElement !== orderPriceEl) {
    orderPriceEl.value = fmtPrice(price, sym);
  }
}

// ─── TRADE TAPE ────────────────────────────────────────────────────────────────
const tape = document.getElementById('tradeTape');
const MAX_TAPE = 80;

function addTapeRow(sym, price, size, side) {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
  const isLarge = size > 30000;
  const row = document.createElement('div');
  row.className = `ts-tape-row ts-tape-row--${side}${isLarge ? ' ts-tape-row--large' : ''}`;
  row.innerHTML = `<span>${timeStr}</span><span style="color:${side==='buy'?'var(--green)':'var(--red)'};">${fmtPrice(price, sym)}</span><span>${fmtVol(size)}</span><span style="color:${side==='buy'?'var(--green)':'var(--red)'};">${side === 'buy' ? 'B' : 'S'}</span>`;
  tape.insertBefore(row, tape.firstChild);
  while (tape.children.length > MAX_TAPE) tape.removeChild(tape.lastChild);
}

// ─── PRICE UPDATE ENGINE ──────────────────────────────────────────────────────
function tickPrices() {
  for (const [sym, d] of Object.entries(INSTRUMENTS)) {
    const prev = state.prices[sym];
    const move = (Math.random() - 0.498) * d.vol * prev * 0.1;
    const newPrice = Math.max(prev * 0.97, Math.min(prev * 1.03, prev + move));
    state.prevPrices[sym] = prev;
    state.prices[sym]     = +newPrice.toFixed(sym.includes('USD') ? 4 : 2);

    // Track OHLC
    if (newPrice > state.highPrices[sym]) state.highPrices[sym] = state.prices[sym];
    if (newPrice < state.lowPrices[sym])  state.lowPrices[sym]  = state.prices[sym];

    // Append price history
    state.priceHistory[sym].push(state.prices[sym]);
    if (state.priceHistory[sym].length > 200) state.priceHistory[sym].shift();
    const vol = Math.floor(Math.random() * 600_000 + 50_000);
    state.volHistory[sym].push(vol);
    if (state.volHistory[sym].length > 200) state.volHistory[sym].shift();
    state.volumes[sym] += vol;
  }
}

// ─── ACTIVE SYMBOL ────────────────────────────────────────────────────────────
function selectSymbol(sym) {
  state.activeSymbol = sym;
  document.getElementById('orderSymbol').value = sym;
  document.getElementById('orderName').value   = INSTRUMENTS[sym]?.name || '';
  renderWatchlist();
  updateInstrumentHeader(sym);
  updateChart(sym);
  renderOrderBook(sym);
  updateSubmitBtn();
}

// ─── SESSION CLOCK ────────────────────────────────────────────────────────────
function updateClock() {
  document.getElementById('sessionTime').textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
}

// ─── LATENCY SIMULATION ───────────────────────────────────────────────────────
function updateLatency() {
  const ms = Math.floor(Math.random() * 4 + 1);
  document.getElementById('latency').textContent = `${ms}ms`;
}

// ─── ORDER ENTRY ──────────────────────────────────────────────────────────────
function updateSubmitBtn() {
  const side = state.orderSide;
  const qty  = parseInt(document.getElementById('orderQty').value) || 0;
  const sym  = document.getElementById('orderSymbol').value.trim().toUpperCase();
  const btn  = document.getElementById('submitOrder');
  const lbl  = document.getElementById('submitLabel');
  btn.className = `ts-btn-order ts-btn-order--${side}`;
  lbl.textContent = `${side.toUpperCase()} ${qty.toLocaleString()} ${sym}`;
  document.getElementById('confirmOrderBtn').className = `ts-btn-primary${side === 'sell' ? ' ts-btn-primary--sell' : ''}`;
  updateNotional();
}

function updateNotional() {
  const qty   = parseInt(document.getElementById('orderQty').value) || 0;
  const price = parseFloat(document.getElementById('orderPrice').value) || state.prices[state.activeSymbol];
  const notional = qty * price;
  document.getElementById('notionalValue').textContent = fmtMoney(notional, true).replace('+','');
  const buyingPower = 12_450_000;
  const risk = Math.min(notional / buyingPower, 1);
  const riskPct = Math.round(34 + risk * 50);
  document.getElementById('riskBar').style.width = `${riskPct}%`;
  document.getElementById('riskPct').textContent = `${riskPct}%`;
  document.getElementById('riskBar').className = `ts-progress-fill ${riskPct > 80 ? 'ts-progress-fill--danger' : riskPct > 60 ? 'ts-progress-fill--warn' : 'ts-progress-fill--ok'}`;
  const riskStatus = document.getElementById('riskStatus');
  if (riskPct > 90) {
    riskStatus.className = 'ts-risk-status ts-risk-breach';
    riskStatus.innerHTML = '<i data-lucide="shield-x" class="ts-icon-sm"></i> Risk Breach';
    lucide.createIcons();
  } else if (riskPct > 70) {
    riskStatus.className = 'ts-risk-status ts-risk-warn';
    riskStatus.innerHTML = '<i data-lucide="shield-alert" class="ts-icon-sm"></i> Near Limit';
    lucide.createIcons();
  } else {
    riskStatus.className = 'ts-risk-status ts-risk-ok';
    riskStatus.innerHTML = '<i data-lucide="shield-check" class="ts-icon-sm"></i> Pre-Trade OK';
    lucide.createIcons();
  }
}

// ─── ORDER SUBMISSION ─────────────────────────────────────────────────────────
function showConfirmModal() {
  const sym   = document.getElementById('orderSymbol').value.trim().toUpperCase();
  const qty   = parseInt(document.getElementById('orderQty').value) || 0;
  const price = parseFloat(document.getElementById('orderPrice').value) || state.prices[sym];
  const type  = document.getElementById('orderType').value;
  const tif   = document.getElementById('orderTIF').value;
  const dest  = document.getElementById('orderDest').value;
  const side  = state.orderSide;
  const notional = qty * price;

  if (!sym || qty <= 0) { showToast('Invalid order parameters', 'error'); return; }
  if (!INSTRUMENTS[sym]) { showToast(`Unknown symbol: ${sym}`, 'error'); return; }

  document.getElementById('modalBody').innerHTML = `
    <table class="ts-confirm-table">
      <tr><td>Symbol</td><td>${sym}</td></tr>
      <tr><td>Name</td><td style="font-size:10px;color:var(--text-2)">${INSTRUMENTS[sym].name}</td></tr>
      <tr><td>Side</td><td style="color:${side==='buy'?'var(--green)':'var(--red)'}; font-weight:700; letter-spacing:1px">${side.toUpperCase()}</td></tr>
      <tr><td>Quantity</td><td>${qty.toLocaleString()} shares</td></tr>
      <tr><td>Order Type</td><td>${type.toUpperCase()}</td></tr>
      <tr><td>Price</td><td>${type === 'market' ? 'MARKET' : fmtPrice(price, sym)}</td></tr>
      <tr><td>Notional</td><td>${fmtMoney(notional, false).replace('+','$')}</td></tr>
      <tr><td>TIF</td><td>${tif}</td></tr>
      <tr><td>Destination</td><td>${dest}</td></tr>
      <tr><td>Account</td><td>EQ-PROP-A</td></tr>
    </table>`;

  document.getElementById('confirmModal').style.display = 'flex';
}

function executeOrder() {
  document.getElementById('confirmModal').style.display = 'none';
  const sym   = document.getElementById('orderSymbol').value.trim().toUpperCase();
  const qty   = parseInt(document.getElementById('orderQty').value) || 0;
  const price = parseFloat(document.getElementById('orderPrice').value) || state.prices[sym];
  const type  = document.getElementById('orderType').value;
  const tif   = document.getElementById('orderTIF').value;
  const dest  = document.getElementById('orderDest').value;
  const side  = state.orderSide;
  const now   = new Date();
  const orderId = `ORD-${++state.orderIdSeq}`;
  const fillPrice = type === 'market' ? state.prices[sym] : price;

  const order = {
    id: orderId, sym, side, qty,
    type, price: fillPrice, tif, dest,
    time: now, status: 'open', filledQty: 0,
    tab: 'open'
  };
  state.orders.unshift(order);
  state.ordersToday++;

  // Simulate fill (market: instant, limit: 70% chance)
  const willFill = type === 'market' || Math.random() > 0.3;
  if (willFill) {
    setTimeout(() => {
      fillOrder(orderId);
    }, type === 'market' ? 300 + Math.random() * 200 : 1000 + Math.random() * 3000);
  }

  renderBlotter();
  updateCounts();
  showToast(`✓ Order ${orderId} sent — ${side.toUpperCase()} ${qty.toLocaleString()} ${sym}`);
}

function fillOrder(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order || order.status !== 'open') return;
  order.status    = 'filled';
  order.filledQty = order.qty;
  order.tab       = 'filled';
  state.fillsToday++;

  // Update position
  const sym  = order.sym;
  const qty  = order.side === 'buy' ? order.qty : -order.qty;
  const pos  = state.positions[sym] || { qty: 0, avgPrice: 0 };
  if ((pos.qty > 0 && qty > 0) || (pos.qty < 0 && qty < 0)) {
    // Adding to position — weighted avg
    pos.avgPrice = (pos.avgPrice * Math.abs(pos.qty) + order.price * Math.abs(qty)) / (Math.abs(pos.qty) + Math.abs(qty));
  } else if (Math.abs(qty) >= Math.abs(pos.qty)) {
    // Flipping
    pos.avgPrice = order.price;
  }
  pos.qty += qty;
  state.positions[sym] = pos;

  // Add to tape
  addTapeRow(sym, order.price, order.qty, order.side);

  renderPositions();
  renderBlotter();
  updateCounts();
  showToast(`✓ Filled ${orderId} — ${order.side.toUpperCase()} ${order.qty.toLocaleString()} ${sym} @ ${fmtPrice(order.price, sym)}`, 'ok');
}

function cancelOrder(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order || order.status !== 'open') return;
  order.status = 'cancelled';
  order.tab    = 'cancelled';
  renderBlotter();
  showToast(`Order ${orderId} cancelled`, 'warn');
}

// ─── BLOTTER ──────────────────────────────────────────────────────────────────
let activeBlotterTab = 'open';
function renderBlotter() {
  const tbody = document.getElementById('blotterOpen');
  tbody.innerHTML = '';
  const filtered = state.orders.filter(o => o.tab === activeBlotterTab);
  filtered.slice(0, 30).forEach(o => {
    const sideCls = o.side === 'buy' ? 'ts-positive' : 'ts-negative';
    const statusMap = { open: 'open', filled: 'filled', cancelled: 'cancelled' };
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:var(--font-mono);font-size:9px;color:var(--text-2)">${fmtTime(o.time)}</td>
      <td style="font-weight:700">${o.sym}</td>
      <td class="${sideCls}" style="font-weight:700">${o.side.toUpperCase()}</td>
      <td style="color:var(--text-2)">${o.type.toUpperCase()}</td>
      <td class="ts-num" style="font-family:var(--font-mono)">${o.qty.toLocaleString()}</td>
      <td class="ts-num" style="font-family:var(--font-mono)">${fmtPrice(o.price, o.sym)}</td>
      <td><span class="ts-status-badge ts-status-badge--${statusMap[o.status]}">${o.status}</span></td>
      <td>${o.status === 'open' ? `<button class="ts-cancel-btn" onclick="cancelOrder('${o.id}')">✕</button>` : ''}</td>`;
    tbody.appendChild(tr);
  });
}

function updateCounts() {
  document.getElementById('orderCount').innerHTML = `Orders Today: <b>${state.ordersToday}</b>`;
  document.getElementById('fillCount').innerHTML   = `Fills: <b>${state.fillsToday}</b>`;
}

// ─── RISK SUMMARY (dynamic) ────────────────────────────────────────────────────
function updateRiskSummary() {
  let gross = 0, net = 0;
  for (const [sym, pos] of Object.entries(state.positions)) {
    const mv = Math.abs(pos.qty) * state.prices[sym];
    gross += mv;
    net   += pos.qty * state.prices[sym];
  }
  document.getElementById('grossExp').textContent  = fmtMoney(gross,   true).replace('+','');
  document.getElementById('netExp').textContent    = fmtMoney(net,     true).replace('+', net < 0 ? '-' : '');
  document.getElementById('varVal').textContent    = '-$' + (gross * 0.017).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const beta = (0.9 + Math.random() * 0.4).toFixed(2);
  document.getElementById('betaVal').textContent  = beta;
  document.getElementById('deltaVal').textContent = (net > 0 ? '+' : '') + (net / (gross || 1)).toFixed(2);
  const sharpe = (1.2 + Math.random() * 1.2).toFixed(2);
  document.getElementById('sharpeVal').textContent = sharpe;
}

// ─── TOAST ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'ok') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `ts-toast${type === 'error' ? ' ts-toast--error' : type === 'warn' ? ' ts-toast--warn' : ''}`;
  toast.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────
document.getElementById('btnBuy').addEventListener('click', () => {
  state.orderSide = 'buy';
  document.getElementById('btnBuy').className  = 'ts-side-btn ts-side-btn--buy ts-side-btn--active';
  document.getElementById('btnSell').className = 'ts-side-btn ts-side-btn--sell';
  updateSubmitBtn();
});
document.getElementById('btnSell').addEventListener('click', () => {
  state.orderSide = 'sell';
  document.getElementById('btnSell').className = 'ts-side-btn ts-side-btn--sell ts-side-btn--active';
  document.getElementById('btnBuy').className  = 'ts-side-btn ts-side-btn--buy';
  updateSubmitBtn();
});
document.getElementById('submitOrder').addEventListener('click', showConfirmModal);
document.getElementById('clearOrder').addEventListener('click', () => {
  document.getElementById('orderQty').value   = '1000';
  document.getElementById('orderPrice').value = fmtPrice(state.prices[state.activeSymbol], state.activeSymbol);
  document.getElementById('orderType').value  = 'limit';
  document.getElementById('orderTIF').value   = 'Day';
  updateSubmitBtn();
});
document.getElementById('confirmOrderBtn').addEventListener('click', executeOrder);
document.getElementById('closeModal').addEventListener('click', () => { document.getElementById('confirmModal').style.display = 'none'; });
document.getElementById('cancelModal').addEventListener('click', () => { document.getElementById('confirmModal').style.display = 'none'; });
document.getElementById('orderQty').addEventListener('input', updateNotional);
document.getElementById('orderPrice').addEventListener('input', updateNotional);
document.getElementById('orderSymbol').addEventListener('change', () => {
  const sym = document.getElementById('orderSymbol').value.trim().toUpperCase();
  if (INSTRUMENTS[sym]) selectSymbol(sym);
  else document.getElementById('orderName').value = 'Unknown';
});

// Timeframe buttons
document.querySelectorAll('.ts-tf-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ts-tf-btn').forEach(b => b.classList.remove('ts-tf-btn--active'));
    btn.classList.add('ts-tf-btn--active');
    // Resample history at different length
    updateChart(state.activeSymbol);
  });
});

// Chart type buttons
document.getElementById('chartTypeLine').addEventListener('click', () => {
  setChartType('line');
  document.querySelectorAll('#chartTypeLine, #chartTypeBar, #chartTypeArea').forEach(b => b.classList.remove('ts-icon-btn--active'));
  document.getElementById('chartTypeLine').classList.add('ts-icon-btn--active');
});
document.getElementById('chartTypeArea').addEventListener('click', () => {
  setChartType('area');
  document.querySelectorAll('#chartTypeLine, #chartTypeBar, #chartTypeArea').forEach(b => b.classList.remove('ts-icon-btn--active'));
  document.getElementById('chartTypeArea').classList.add('ts-icon-btn--active');
});
document.getElementById('chartTypeBar').addEventListener('click', () => {
  setChartType('bar');
  document.querySelectorAll('#chartTypeLine, #chartTypeBar, #chartTypeArea').forEach(b => b.classList.remove('ts-icon-btn--active'));
  document.getElementById('chartTypeBar').classList.add('ts-icon-btn--active');
});

function setChartType(type) {
  chartType = type;
  const ds = priceChart.data.datasets[0];
  if (type === 'line') { ds.fill = false; ds.type = 'line'; }
  else if (type === 'area') { ds.fill = true; }
  else if (type === 'bar') { priceChart.config.type = 'bar'; }
  priceChart.update('none');
}

// Blotter tabs
document.querySelectorAll('.ts-tab-mini').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ts-tab-mini').forEach(b => b.classList.remove('ts-tab-mini--active'));
    btn.classList.add('ts-tab-mini--active');
    activeBlotterTab = btn.dataset.tab;
    renderBlotter();
  });
});

// Watchlist search
document.getElementById('symbolSearch').addEventListener('input', renderWatchlist);

// Top nav
document.querySelectorAll('.ts-topnav__item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ts-topnav__item').forEach(b => b.classList.remove('ts-topnav__item--active'));
    btn.classList.add('ts-topnav__item--active');
  });
});

// ─── MAIN TICK LOOP ────────────────────────────────────────────────────────────
let tickCount = 0;
function mainLoop() {
  tickPrices();
  tickCount++;

  // Update UI
  refreshTickerStrip();
  updateInstrumentHeader(state.activeSymbol);
  renderPositions();
  updateRiskSummary();

  if (tickCount % 2 === 0) {
    updateChart(state.activeSymbol);
    renderOrderBook(state.activeSymbol);
  }
  if (tickCount % 3 === 0) {
    renderWatchlist();
  }

  // Simulate random tape entries
  const sym = state.activeSymbol;
  const numTrades = Math.floor(Math.random() * 3 + 1);
  for (let i = 0; i < numTrades; i++) {
    const price = state.prices[sym] * (1 + (Math.random() - 0.5) * 0.001);
    const size  = Math.floor(Math.random() * 50000 + 100);
    const side  = Math.random() > 0.5 ? 'buy' : 'sell';
    addTapeRow(sym, price, size, side);
  }

  updateLatency();
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
initCharts();
buildTickerStrip();
selectSymbol('AAPL');
renderWatchlist();
renderPositions();
renderBlotter();
updateRiskSummary();
updateClock();

// Timers
setInterval(mainLoop, 800);
setInterval(updateClock, 1000);

// Init Lucide icons
lucide.createIcons();
