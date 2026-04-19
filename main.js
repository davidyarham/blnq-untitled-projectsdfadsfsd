// ── XOR Dataset ──
const XOR_DATA = [
  { input: [0, 0], target: 0 },
  { input: [0, 1], target: 1 },
  { input: [1, 0], target: 1 },
  { input: [1, 1], target: 0 },
];

// ── Activation Functions ──
const activations = {
  sigmoid: {
    fn:   x => 1 / (1 + Math.exp(-x)),
    deriv: x => { const s = 1 / (1 + Math.exp(-x)); return s * (1 - s); }
  },
  tanh: {
    fn:   x => Math.tanh(x),
    deriv: x => 1 - Math.tanh(x) ** 2
  },
  relu: {
    fn:   x => Math.max(0, x),
    deriv: x => x > 0 ? 1 : 0
  }
};

// ── Neural Network ──
class NeuralNetwork {
  constructor(hiddenSize, actKey) {
    this.hiddenSize = hiddenSize;
    this.actKey = actKey;
    this.init();
  }

  init() {
    const h = this.hiddenSize;
    // Xavier init
    const xav = (n) => (Math.random() * 2 - 1) * Math.sqrt(2 / n);
    this.W1 = Array.from({ length: h }, () => [xav(2), xav(2)]);
    this.b1 = Array(h).fill(0);
    this.W2 = Array.from({ length: 1 }, () => Array.from({ length: h }, () => xav(h)));
    this.b2 = [0];
    // For animation
    this.hiddenActivations = Array(h).fill(0);
    this.outputActivation = 0;
    this.inputActivations = [0, 0];
  }

  forward(input) {
    const act = activations[this.actKey];
    // Hidden layer
    this.z1 = this.W1.map((row, i) =>
      row.reduce((sum, w, j) => sum + w * input[j], 0) + this.b1[i]
    );
    this.a1 = this.z1.map(z => act.fn(z));

    // Output layer (always sigmoid for classification)
    this.z2 = this.W2.map(row =>
      row.reduce((sum, w, j) => sum + w * this.a1[j], 0)
    ).map((z, i) => z + this.b2[i]);
    this.a2 = this.z2.map(z => activations.sigmoid.fn(z));

    return this.a2[0];
  }

  backward(input, target, lr) {
    const act = activations[this.actKey];
    const h = this.hiddenSize;
    const pred = this.a2[0];
    // Output error
    const dOut = pred - target;
    // W2 gradients
    const dW2 = this.W2.map((row, i) => row.map((_, j) => dOut * this.a1[j]));
    const db2 = [dOut];
    // Hidden error
    const dHidden = this.a1.map((_, j) =>
      dOut * this.W2[0][j] * act.deriv(this.z1[j])
    );
    // W1 gradients
    const dW1 = this.W1.map((row, i) => row.map((_, j) => dHidden[i] * input[j]));
    const db1 = dHidden.slice();
    // Update
    this.W2 = this.W2.map((row, i) => row.map((w, j) => w - lr * dW2[i][j]));
    this.b2 = this.b2.map((b, i) => b - lr * db2[i]);
    this.W1 = this.W1.map((row, i) => row.map((w, j) => w - lr * dW1[i][j]));
    this.b1 = this.b1.map((b, i) => b - lr * db1[i]);
  }

  trainEpoch(lr) {
    let loss = 0;
    for (const sample of XOR_DATA) {
      const pred = this.forward(sample.input);
      loss += 0.5 * (pred - sample.target) ** 2;
      this.backward(sample.input, sample.target, lr);
    }
    return loss / XOR_DATA.length;
  }

  predict(input) {
    return this.forward(input);
  }

  getPredictions() {
    return XOR_DATA.map(d => ({
      input: d.input,
      target: d.target,
      pred: this.forward(d.input)
    }));
  }
}

// ── State ──
let nn, epoch, losses, isRunning, animFrame, lastForward, lastInput;
let trainInterval = null;

function getHiddenSize() { return parseInt(document.getElementById('hidden-slider').value); }
function getLR()         { return parseFloat(document.getElementById('lr-slider').value); }
function getActKey()     { return document.getElementById('activation-select').value; }
function getSpeed()      { return parseInt(document.getElementById('speed-slider').value); }

function resetNetwork() {
  stopTraining();
  epoch = 0;
  losses = [];
  nn = new NeuralNetwork(getHiddenSize(), getActKey());
  lastForward = null;
  updateStats();
  updateTruthTable();
  updateActivationPills();
  drawNetwork(null);
  drawBoundary();
  resetChart();
  document.getElementById('btn-train').innerHTML = '<i data-lucide="play"></i> Train';
  document.getElementById('btn-train').classList.remove('running');
  lucide.createIcons();
}

// ── Loss Chart ──
let lossChart;
function initChart() {
  const ctx = document.getElementById('loss-chart').getContext('2d');
  lossChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'MSE Loss',
        data: [],
        borderColor: '#00e5a0',
        backgroundColor: 'rgba(0,229,160,0.08)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#1a1f2e',
          borderColor: '#252b3b',
          borderWidth: 1,
          titleColor: '#6b7599',
          bodyColor: '#e8eaf0',
          titleFont: { family: 'JetBrains Mono', size: 10 },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#6b7599',
            font: { family: 'JetBrains Mono', size: 9 },
            maxTicksLimit: 8
          },
          grid: { color: 'rgba(37,43,59,0.7)' }
        },
        y: {
          ticks: {
            color: '#6b7599',
            font: { family: 'JetBrains Mono', size: 9 },
          },
          grid: { color: 'rgba(37,43,59,0.7)' },
          min: 0
        }
      }
    }
  });
}

function resetChart() {
  lossChart.data.labels = [];
  lossChart.data.datasets[0].data = [];
  lossChart.update();
}

function pushLoss(ep, loss) {
  if (ep % 10 === 0 || ep < 10) {
    lossChart.data.labels.push(ep);
    lossChart.data.datasets[0].data.push(loss.toFixed(5));
    lossChart.update();
  }
}

// ── Stats ──
function updateStats(loss) {
  document.getElementById('stat-epoch').textContent = epoch;
  document.getElementById('stat-loss').textContent = loss !== undefined ? loss.toFixed(5) : '—';
  const preds = nn.getPredictions();
  const correct = preds.filter(p => Math.round(p.pred) === p.target).length;
  document.getElementById('stat-acc').textContent = loss !== undefined
    ? `${correct}/4`
    : '—';
}

// ── Truth Table ──
function updateTruthTable() {
  const preds = nn.getPredictions();
  const ids = ['00', '01', '10', '11'];
  preds.forEach((p, i) => {
    const predEl  = document.getElementById(`pred-${ids[i]}`);
    const verdEl  = document.getElementById(`verd-${ids[i]}`);
    predEl.textContent = p.pred.toFixed(3);
    const correct = Math.round(p.pred) === p.target;
    verdEl.className = 'verdict ' + (correct ? 'ok' : 'bad');
  });
}

// ── Activation Pills ──
function updateActivationPills() {
  const preds = nn.getPredictions();
  const ids = ['00', '01', '10', '11'];
  const targets = [0, 1, 1, 0];
  preds.forEach((p, i) => {
    const pill = document.getElementById(`act-${ids[i]}`);
    const out  = document.getElementById(`out-${ids[i]}`);
    out.textContent = p.pred.toFixed(3);
    const correct = Math.round(p.pred) === p.target;
    pill.className = 'activation-pill ' + (correct ? 'correct' : 'wrong');
  });
}

// ── Network Canvas ──
const NET_CANVAS = document.getElementById('network-canvas');
const NET_CTX = NET_CANVAS.getContext('2d');

function getNeuronPositions(hiddenSize) {
  const W = NET_CANVAS.width;
  const H = NET_CANVAS.height;
  const cols = [W * 0.13, W * 0.42, W * 0.78];
  const layers = [2, hiddenSize, 1];
  return layers.map((count, li) => {
    const x = cols[li];
    return Array.from({ length: count }, (_, i) => ({
      x,
      y: H / 2 + (i - (count - 1) / 2) * Math.min(68, (H - 40) / count)
    }));
  });
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function lerpColor(a, b, t) {
  const hex = (s) => parseInt(s, 16);
  const parse = c => ({ r: hex(c.slice(1,3)), g: hex(c.slice(3,5)), b: hex(c.slice(5,7)) });
  const ca = parse(a), cb = parse(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const b2 = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r},${g},${b2})`;
}

function drawNetwork(forward) {
  const ctx = NET_CTX;
  const W = NET_CANVAS.width;
  const H = NET_CANVAS.height;
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#12151d';
  ctx.fillRect(0, 0, W, H);

  const hiddenSize = nn.hiddenSize;
  const positions = getNeuronPositions(hiddenSize);

  // Extract weights for edge color
  const W1 = nn.W1; // [hidden x 2]
  const W2 = nn.W2; // [1 x hidden]
  const maxW1 = W1.flat().reduce((m, v) => Math.max(m, Math.abs(v)), 0.001);
  const maxW2 = W2.flat().reduce((m, v) => Math.max(m, Math.abs(v)), 0.001);

  // Draw edges input → hidden
  for (let i = 0; i < hiddenSize; i++) {
    for (let j = 0; j < 2; j++) {
      const w = W1[i][j];
      const t = clamp01((w + maxW1) / (2 * maxW1));
      const col = w > 0 ? `rgba(0,229,160,${0.15 + 0.55 * Math.abs(w) / maxW1})`
                        : `rgba(255,107,107,${0.15 + 0.55 * Math.abs(w) / maxW1})`;
      drawEdge(ctx, positions[0][j], positions[1][i], col, Math.max(0.5, 2.5 * Math.abs(w) / maxW1));
    }
  }

  // Draw edges hidden → output
  for (let j = 0; j < hiddenSize; j++) {
    const w = W2[0][j];
    const col = w > 0 ? `rgba(0,229,160,${0.15 + 0.55 * Math.abs(w) / maxW2})`
                      : `rgba(255,107,107,${0.15 + 0.55 * Math.abs(w) / maxW2})`;
    drawEdge(ctx, positions[1][j], positions[2][0], col, Math.max(0.5, 2.5 * Math.abs(w) / maxW2));
  }

  // Get activations for color
  let inputActs = [0.5, 0.5];
  let hidActs = Array(hiddenSize).fill(0.5);
  let outAct = 0.5;

  if (forward) {
    inputActs = forward.input;
    hidActs = forward.a1;
    outAct = forward.a2;
  }

  // Draw neurons — input
  const layerLabels = [['x₁', 'x₂'],
    Array.from({ length: hiddenSize }, (_, i) => `h${i + 1}`),
    ['ŷ']];

  positions.forEach((layer, li) => {
    layer.forEach((pos, ni) => {
      let act = 0.5;
      if (li === 0) act = inputActs[ni];
      if (li === 1) act = clamp01(hidActs[ni]);
      if (li === 2) act = clamp01(outAct);

      drawNeuron(ctx, pos.x, pos.y, act, layerLabels[li][ni], li);
    });
  });

  // Layer labels
  const layerNames = ['Input', 'Hidden', 'Output'];
  [0, 1, 2].forEach(li => {
    ctx.font = '10px JetBrains Mono';
    ctx.fillStyle = '#6b7599';
    ctx.textAlign = 'center';
    const x = positions[li][0].x;
    ctx.fillText(layerNames[li], x, H - 8);
  });
}

function drawEdge(ctx, from, to, color, width) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  // Bezier curve
  const cx = (from.x + to.x) / 2;
  ctx.bezierCurveTo(cx, from.y, cx, to.y, to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawNeuron(ctx, x, y, activation, label, layerIdx) {
  const r = layerIdx === 2 ? 20 : 16;
  // Glow
  const glowColor = activation > 0.5
    ? `rgba(0,229,160,${0.15 + 0.55 * activation})`
    : `rgba(76,201,240,${0.1 + 0.3 * (1 - activation)})`;
  ctx.shadowBlur = 14 * activation;
  ctx.shadowColor = glowColor;

  // Neuron body
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, lerpColor('#2a3a4a', '#00e5a0', clamp01(activation)));
  grad.addColorStop(1, '#12151d');

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Border
  ctx.strokeStyle = activation > 0.5
    ? `rgba(0,229,160,${0.4 + 0.6 * activation})`
    : '#252b3b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Label
  ctx.font = `bold ${r > 18 ? 11 : 9}px JetBrains Mono`;
  ctx.fillStyle = '#e8eaf0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}

// ── Decision Boundary ──
const BOUND_CANVAS = document.getElementById('boundary-canvas');
const BOUND_CTX = BOUND_CANVAS.getContext('2d');
const BOUND_SIZE = 80; // internal resolution

function drawBoundary() {
  const size = BOUND_SIZE;
  const imgData = BOUND_CTX.createImageData(size, size);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const x1 = col / (size - 1);
      const x2 = 1 - row / (size - 1);
      const pred = nn.predict([x1, x2]);
      const idx = (row * size + col) * 4;
      if (pred > 0.5) {
        // Green tint
        imgData.data[idx]     = Math.round(0  + pred * 0);
        imgData.data[idx + 1] = Math.round(80 + pred * 100);
        imgData.data[idx + 2] = Math.round(50 + pred * 50);
        imgData.data[idx + 3] = Math.round(80 + pred * 120);
      } else {
        // Red tint
        imgData.data[idx]     = Math.round(120 + (1 - pred) * 100);
        imgData.data[idx + 1] = Math.round(20);
        imgData.data[idx + 2] = Math.round(20);
        imgData.data[idx + 3] = Math.round(80 + (1 - pred) * 100);
      }
    }
  }

  // Render image at full canvas size
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = size;
  tmpCanvas.height = size;
  tmpCanvas.getContext('2d').putImageData(imgData, 0, 0);
  BOUND_CTX.fillStyle = '#12151d';
  BOUND_CTX.fillRect(0, 0, BOUND_CANVAS.width, BOUND_CANVAS.height);
  BOUND_CTX.imageSmoothingEnabled = false;
  BOUND_CTX.drawImage(tmpCanvas, 0, 0, BOUND_CANVAS.width, BOUND_CANVAS.height);

  // Draw XOR points
  const pts = [
    { x: 0, y: 0, t: 0 },
    { x: 0, y: 1, t: 1 },
    { x: 1, y: 0, t: 1 },
    { x: 1, y: 1, t: 0 },
  ];
  pts.forEach(p => {
    const cx = p.x * (BOUND_CANVAS.width - 24) + 12;
    const cy = (1 - p.y) * (BOUND_CANVAS.height - 24) + 12;
    BOUND_CTX.beginPath();
    BOUND_CTX.arc(cx, cy, 7, 0, Math.PI * 2);
    BOUND_CTX.fillStyle = p.t === 1 ? '#00e5a0' : '#ff6b6b';
    BOUND_CTX.fill();
    BOUND_CTX.strokeStyle = '#0c0e13';
    BOUND_CTX.lineWidth = 2;
    BOUND_CTX.stroke();
  });
}

// ── Training Loop ──
function runEpochs(count) {
  for (let i = 0; i < count; i++) {
    const loss = nn.trainEpoch(getLR());
    epoch++;
    losses.push(loss);
    pushLoss(epoch, loss);

    if (i === count - 1) {
      updateStats(loss);
      updateTruthTable();
      updateActivationPills();

      // Do a forward pass on a random XOR sample for animation
      const sample = XOR_DATA[Math.floor(Math.random() * 4)];
      nn.forward(sample.input);
      drawNetwork({ input: sample.input, a1: nn.a1, a2: nn.a2[0] });
      drawBoundary();
    }
  }
}

function startTraining() {
  if (isRunning) return;
  isRunning = true;
  document.getElementById('btn-train').innerHTML = '<i data-lucide="pause"></i> Pause';
  document.getElementById('btn-train').classList.add('running');
  lucide.createIcons();

  function loop() {
    if (!isRunning) return;
    runEpochs(getSpeed());
    animFrame = requestAnimationFrame(loop);
  }
  animFrame = requestAnimationFrame(loop);
}

function stopTraining() {
  isRunning = false;
  if (animFrame) cancelAnimationFrame(animFrame);
  document.getElementById('btn-train').innerHTML = '<i data-lucide="play"></i> Train';
  document.getElementById('btn-train').classList.remove('running');
  lucide.createIcons();
}

// ── Event Listeners ──
document.getElementById('btn-train').addEventListener('click', () => {
  if (isRunning) stopTraining(); else startTraining();
});

document.getElementById('btn-step').addEventListener('click', () => {
  stopTraining();
  runEpochs(1);
});

document.getElementById('btn-reset').addEventListener('click', resetNetwork);

document.getElementById('lr-slider').addEventListener('input', function () {
  document.getElementById('lr-val').textContent = parseFloat(this.value).toFixed(3);
});

document.getElementById('hidden-slider').addEventListener('input', function () {
  document.getElementById('hidden-val').textContent = this.value;
  // Rebuild network immediately
  resetNetwork();
  document.getElementById('hidden-val').textContent = this.value;
});

document.getElementById('activation-select').addEventListener('change', () => {
  resetNetwork();
});

document.getElementById('speed-slider').addEventListener('input', function () {
  document.getElementById('speed-val').textContent = this.value + '×';
});

// ── Init ──
initChart();
resetNetwork();
lucide.createIcons();
