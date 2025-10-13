import "./style.css";

/* ----- Game State ----- */
let energy = 0;
let lastTick = performance.now();
let lastRender = 0;

const TICK_MS = 50;
const RENDER_MS = 100;
const PRICE_GROWTH = 1.15;

/* ----- Types/Data ----- */
interface Tech {
  key: string;
  name: string;
  baseCost: number;
  rate: number;
  description: string;
  count: number;
}

const technologies: Tech[] = [
  {
    key: "fire",
    name: "Fire Discovery",
    baseCost: 10,
    rate: 0.1,
    description: "The first spark of civilization (+0.1 energy/sec)",
    count: 0,
  },
  {
    key: "steam",
    name: "Steam Engine",
    baseCost: 100,
    rate: 2.0,
    description: "The Age of Steam—production speeds up (+2 energy/sec)",
    count: 0,
  },
  {
    key: "factory",
    name: "Factory Network",
    baseCost: 1000,
    rate: 50,
    description:
      "Industrial Revolution—mass production systems (+50 energy/sec)",
    count: 0,
  },
  {
    key: "datacenter",
    name: "Data Center Grid",
    baseCost: 12000,
    rate: 650,
    description: "Information Age—AI-automated production (+650 energy/sec)",
    count: 0,
  },
  {
    key: "orbital",
    name: "Orbital Solar Array",
    baseCost: 180000,
    rate: 9200,
    description: "Planetary-scale power grid (+9,200 energy/sec)",
    count: 0,
  },
];

/* ----- Utilities ----- */
const fmtInt = (n: number) => n.toLocaleString();
const fmtNum = (n: number, f = 2) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: f,
    maximumFractionDigits: f,
  });

const currentPrice = (t: Tech) => t.baseCost * Math.pow(PRICE_GROWTH, t.count);

const eps = () => technologies.reduce((s, t) => s + t.count * t.rate, 0);

/* ----- UI Setup ----- */
const gameContainer = document.createElement("div");
gameContainer.className = "game-container";
document.body.appendChild(gameContainer);

const columnLeft = document.createElement("div");
columnLeft.className = "column column-left";
const columnMiddle = document.createElement("div");
columnMiddle.className = "column column-middle";
const columnRight = document.createElement("div");
columnRight.className = "column column-right";
gameContainer.append(columnLeft, columnMiddle, columnRight);

const title = document.createElement("h1");
title.textContent = "Earth Clicker";
const stats = document.createElement("div");
stats.className = "stats";
const mainBtn = document.createElement("button");
mainBtn.className = "main-btn";
mainBtn.title = "Click to generate energy";
const iconWrap = document.createElement("div");
iconWrap.className = "iconWrap";
const globe = document.createElement("div");
globe.className = "globe spin";
iconWrap.appendChild(globe);
mainBtn.appendChild(iconWrap);
columnLeft.append(title, stats, mainBtn);

const sectionTitle = document.createElement("div");
sectionTitle.className = "section-title";
sectionTitle.textContent = "Technological Advancements";
const list = document.createElement("div");
list.className = "list";
columnMiddle.append(sectionTitle, list);

type ViewRefs = {
  btn: HTMLButtonElement;
  costEl: HTMLSpanElement;
  rateEl: HTMLSpanElement;
};
const views = new Map<string, ViewRefs>();

for (const t of technologies) {
  const row = document.createElement("div");
  row.className = "row";
  const price = document.createElement("div");
  price.className = "price";
  const nameEl = document.createElement("div");
  nameEl.className = "item-name";
  nameEl.textContent = t.name;
  const descEl = document.createElement("div");
  descEl.className = "item-desc";
  descEl.textContent = t.description;
  const sub = document.createElement("div");
  sub.className = "item-sub";
  const costEl = document.createElement("span");
  const sep = document.createElement("span");
  sep.textContent = " · ";
  const rateEl = document.createElement("span");
  sub.append(costEl, sep, rateEl);
  price.append(nameEl, descEl, sub);
  const btn = document.createElement("button");
  btn.className = "buy-btn";
  row.append(price, btn);
  list.appendChild(row);
  views.set(t.key, { btn, costEl, rateEl });
}

const storeTitle = document.createElement("div");
storeTitle.className = "section-title";
storeTitle.textContent = "Item Store";
const storeContent = document.createElement("div");
storeContent.className = "store-placeholder";
storeContent.textContent = "Special items coming soon!";
columnRight.append(storeTitle, storeContent);

/* ----- Sprite Animation ----- */
type SpriteCfg = {
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
  total: number;
  durationMs: number;
};
const SPRITE: SpriteCfg = {
  frameW: 100,
  frameH: 100,
  cols: 30,
  rows: 10,
  total: 300,
  durationMs: 20000,
};

function startSprite(el: HTMLElement, cfg: SpriteCfg) {
  let id = 0;
  const start = performance.now();
  const loop = (t: number) => {
    const elapsed = (t - start) % cfg.durationMs;
    const idx = Math.floor((elapsed / cfg.durationMs) * cfg.total);
    const col = idx % cfg.cols;
    const row = Math.floor(idx / cfg.cols);

    // THIS IS THE FIX: Calculate background position using percentages
    const xPercent = (col / (cfg.cols - 1)) * 100;
    const yPercent = (row / (cfg.rows - 1)) * 100;
    el.style.backgroundPosition = `${xPercent}% ${yPercent}%`;

    id = requestAnimationFrame(loop);
  };
  id = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(id);
}
startSprite(globe, SPRITE);

/* ----- Events ----- */
mainBtn.addEventListener("click", () => {
  energy += 1;
  iconWrap.classList.remove("pop");
  void iconWrap.offsetWidth;
  iconWrap.classList.add("pop");
  render(performance.now(), true);
});

for (const t of technologies) {
  const v = views.get(t.key)!;
  v.btn.addEventListener("click", () => {
    const cost = currentPrice(t);
    if (energy >= cost) {
      energy -= cost;
      t.count += 1;
      render(performance.now(), true);
    }
  });
}

/* ----- Render ----- */
function render(now: number, force = false) {
  if (!force && now - lastRender < RENDER_MS) return;
  lastRender = now;

  const rate = eps();
  stats.textContent = `${fmtNum(energy, 2)} energy (${fmtNum(rate, 2)}/sec)`;

  for (const t of technologies) {
    const v = views.get(t.key)!;
    const cost = currentPrice(t);
    const canBuy = energy >= cost;
    const totalRateFromGroup = t.rate * t.count;

    v.costEl.textContent = `Cost: ${fmtNum(cost, 2)}`;
    v.rateEl.textContent = `+${fmtNum(totalRateFromGroup, 2)} energy/sec`;
    v.btn.disabled = !canBuy;
    v.btn.textContent = `Advance (${fmtInt(t.count)})`;
  }
}

/* ----- Game Loop ----- */
function tick(now: number) {
  const dt = now - lastTick;
  if (dt >= TICK_MS) {
    const steps = Math.floor(dt / TICK_MS);
    energy += eps() * (TICK_MS / 1000) * steps;
    lastTick += steps * TICK_MS;
    render(now);
  }
  requestAnimationFrame(tick);
}

/* ----- Initialization ----- */
render(performance.now(), true);
requestAnimationFrame(tick);
