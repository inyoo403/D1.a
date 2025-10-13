import "./style.css";

/* ----- Game State ----- */
let eT = 0; // Energy Total
let eps = 0; // Energy Per Second
let epc = 1; // Energy Per Click

let lastTick = performance.now();
let lastRender = 0;
let timedAutoclickerEndTime = 0;
let autoclickerIntervalId: number | null = null;
let isCheatActive = false;
let currentPlanetSprite = "earth";
let epcMultiplier = 1.0;

const TICK_MS = 50;
const RENDER_MS = 100;
const PRICE_GROWTH = 1.15;
const UPGRADE_PRICE_GROWTH = 1.25;

/* ----- Types/Data ----- */
interface Tech {
  key: string;
  name: string;
  baseCost: number;
  rate: number;
  description: string;
  count: number;
}
interface StoreItem {
  key: string;
  name: string;
  baseCost: number;
  description: string;
  level: number;
  upgradeCost?: number;
  effectPerLevel?: number;
  spriteClasses?: string[];
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
const storeItems: StoreItem[] = [
  {
    key: "autoclicker_bot",
    name: "Auto-Clicker Bot",
    baseCost: 100000,
    description:
      "For 1 minute, holding the mouse on the globe triggers continuous clicks.",
    level: 1,
    upgradeCost: 500000,
  },
  {
    key: "planetary_relocation",
    name: "Planetary Relocation",
    baseCost: 1000,
    description:
      "Relocate to other planet, boosting all production and doubling click power.",
    level: 0,
    effectPerLevel: 0.20,
    spriteClasses: ["earth", "mars"],
  },
];

/* ----- Utilities & Calculations ----- */
const fmtInt = (n: number) => n.toLocaleString();
const fmtNum = (n: number, f = 2) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: f,
    maximumFractionDigits: f,
  });

const currentTechPrice = (t: Tech) =>
  t.baseCost * Math.pow(PRICE_GROWTH, t.count);
const currentItemPrice = (item: StoreItem) => {
  if (item.key === "autoclicker_bot") return item.upgradeCost ?? 0;
  if (item.key === "planetary_relocation") {
    return item.baseCost * Math.pow(2, item.level);
  }
  return item.baseCost;
};

// This central function updates eps and epc whenever an upgrade is purchased.
function updateCalculations() {
  const baseEps = technologies.reduce((s, t) => s + t.count * t.rate, 0);
  const relocation = storeItems.find((i) => i.key === "planetary_relocation")!;
  const epsMultiplier = 1.0 + (relocation.effectPerLevel! * relocation.level);

  eps = baseEps * epsMultiplier;

  const baseEpc = 1 + (eps * 0.1);
  epc = baseEpc * epcMultiplier;
}

const getAutoclickerDelay = () => {
  const autoclicker = storeItems.find((i) => i.key === "autoclicker_bot")!;
  const baseDelay = 100;
  const performanceMultiplier = Math.pow(1.5, autoclicker.level - 1);
  return Math.max(10, baseDelay / performanceMultiplier);
};

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
const statTotal = document.createElement("div");
statTotal.className = "stat-total";
const statEps = document.createElement("div");
statEps.className = "stat-eps";
const statEpc = document.createElement("div");
statEpc.className = "stat-epc";
stats.append(statTotal, statEps, statEpc);
const mainBtn = document.createElement("button");
mainBtn.className = "main-btn";
mainBtn.title = "Click to generate energy";
const iconWrap = document.createElement("div");
iconWrap.className = "iconWrap";
const globe = document.createElement("div");
globe.className = "globe spin";
iconWrap.appendChild(globe);
mainBtn.appendChild(iconWrap);
const timerBarContainer = document.createElement("div");
timerBarContainer.className = "timer-bar-container";
const timerBarFill = document.createElement("div");
timerBarFill.className = "timer-bar-fill";
timerBarContainer.appendChild(timerBarFill);
columnLeft.append(title, stats, mainBtn, timerBarContainer);

type TechViewRefs = {
  btn: HTMLButtonElement;
  costEl: HTMLSpanElement;
  rateEl: HTMLSpanElement;
};
const techViews = new Map<string, TechViewRefs>();
type StoreViewRefs = {
  row: HTMLDivElement;
  nameEl: HTMLDivElement;
  descEl: HTMLDivElement;
  costSpan: HTMLSpanElement;
  levelSpan: HTMLSpanElement;
  purchaseBtn: HTMLButtonElement;
  upgradeBtn?: HTMLButtonElement;
};
const storeViews = new Map<string, StoreViewRefs>();

function setupColumns() {
  const techList = document.createElement("div");
  techList.className = "list";
  const storeList = document.createElement("div");
  storeList.className = "list";
  columnMiddle.append(
    Object.assign(document.createElement("div"), {
      className: "section-title",
      textContent: "Technological Advancements",
    }),
    techList,
  );
  columnRight.append(
    Object.assign(document.createElement("div"), {
      className: "section-title",
      textContent: "Item Store",
    }),
    storeList,
  );
  for (const tech of technologies) {
    const row = document.createElement("div");
    row.className = "row";
    const info = document.createElement("div");
    info.className = "price";
    info.innerHTML =
      `<div class="item-name">${tech.name}</div><div class="item-desc">${tech.description}</div><div class="item-sub"><span></span> · <span></span></div>`;
    const btn = document.createElement("button");
    btn.className = "buy-btn";
    btn.addEventListener("click", () => {
      const cost = currentTechPrice(tech);
      if (eT >= cost) {
        eT -= cost;
        tech.count += 1;
        updateCalculations();
        render(performance.now(), true);
      }
    });
    row.append(info, btn);
    techList.appendChild(row);
    techViews.set(tech.key, {
      btn,
      costEl: info.querySelector(".item-sub span:first-child")!,
      rateEl: info.querySelector(".item-sub span:last-child")!,
    });
  }
  for (const item of storeItems) {
    const row = document.createElement("div");
    row.className = "row";
    const info = document.createElement("div");
    info.className = "price";
    const nameEl = Object.assign(document.createElement("div"), {
      className: "item-name",
    });
    const descEl = Object.assign(document.createElement("div"), {
      className: "item-desc",
    });
    const sub = document.createElement("div");
    sub.className = "item-sub";
    const costSpan = document.createElement("span");
    const levelSpan = Object.assign(document.createElement("span"), {
      className: "level-display",
    });
    sub.append(costSpan, levelSpan);
    info.append(nameEl, descEl, sub);
    const purchaseBtn = document.createElement("button");
    let upgradeBtn: HTMLButtonElement | undefined;
    if (item.key === "autoclicker_bot") {
      const buttonGroup = document.createElement("div");
      buttonGroup.className = "button-group";
      purchaseBtn.className = "buy-btn store-btn";
      purchaseBtn.textContent = "Activate";
      purchaseBtn.dataset.action = "purchase";
      purchaseBtn.dataset.itemKey = item.key;
      upgradeBtn = document.createElement("button");
      upgradeBtn.className = "upgrade-btn";
      upgradeBtn.dataset.action = "upgrade";
      upgradeBtn.dataset.itemKey = item.key;
      buttonGroup.append(purchaseBtn, upgradeBtn);
      row.append(info, buttonGroup);
    } else {
      purchaseBtn.className = "buy-btn store-btn";
      purchaseBtn.dataset.action = "purchase";
      purchaseBtn.dataset.itemKey = item.key;
      row.append(info, purchaseBtn);
    }
    storeList.appendChild(row);
    storeViews.set(item.key, {
      row,
      nameEl,
      descEl,
      costSpan,
      levelSpan,
      purchaseBtn,
      upgradeBtn,
    });
  }
}
setupColumns();

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
    el.style.backgroundPosition = `${(col / (cfg.cols - 1)) * 100}% ${
      (row / (cfg.rows - 1)) * 100
    }%`;
    id = requestAnimationFrame(loop);
  };
  id = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(id);
}
startSprite(globe, SPRITE);

/* ----- Events ----- */
mainBtn.addEventListener("click", () => {
  eT += epc;
  iconWrap.classList.remove("pop");
  void iconWrap.offsetWidth;
  iconWrap.classList.add("pop");
});

let cheatClickCount = 0;
let cheatTimeout: number;
title.addEventListener("click", () => {
  cheatClickCount++;
  clearTimeout(cheatTimeout);
  cheatTimeout = setTimeout(() => {
    cheatClickCount = 0;
  }, 1000);
  if (cheatClickCount >= 5) {
    isCheatActive = !isCheatActive;
    eT = isCheatActive ? Infinity : 0;
    console.log(`Cheat ${isCheatActive ? "activated" : "deactivated"}`);
    cheatClickCount = 0;
  }
});

const startAutoclicker = () => {
  if (
    performance.now() < timedAutoclickerEndTime &&
    autoclickerIntervalId === null
  ) {
    autoclickerIntervalId = setInterval(() => {
      mainBtn.click();
    }, getAutoclickerDelay());
  }
};
const stopAutoclicker = () => {
  if (autoclickerIntervalId !== null) {
    clearInterval(autoclickerIntervalId);
    autoclickerIntervalId = null;
  }
};
mainBtn.addEventListener("mousedown", startAutoclicker);
mainBtn.addEventListener("mouseup", stopAutoclicker);
mainBtn.addEventListener("mouseleave", stopAutoclicker);

document.querySelector(".column-right .list")!.addEventListener(
  "click",
  (e) => {
    const target = e.target as HTMLButtonElement;
    const itemKey = target.dataset.itemKey;
    const action = target.dataset.action;
    if (!itemKey || !action) return;
    const item = storeItems.find((i) => i.key === itemKey);
    if (!item) return;

    if (item.key === "autoclicker_bot") {
      const cost = action === "purchase" ? item.baseCost : item.upgradeCost!;
      if (eT < cost) return;
      eT -= cost;
      if (action === "purchase") {
        timedAutoclickerEndTime = performance.now() +
          1 * 60 * 1000;
      } else if (action === "upgrade") {
        item.level++;
        item.upgradeCost = Math.floor(item.upgradeCost! * UPGRADE_PRICE_GROWTH);
        item.baseCost = Math.floor(item.baseCost * 1.2);
      }
    } else if (item.key === "planetary_relocation") {
      if (item.level > 0) return;
      const cost = currentItemPrice(item);
      if (eT < cost) return;
      eT -= cost;
      item.level = 1;
      currentPlanetSprite = item.spriteClasses?.[1] ?? "earth";
      epcMultiplier = 2;
    }
    updateCalculations();
    render(performance.now(), true);
  },
);

/* ----- Render ----- */
function updateTechRows() {
  for (const tech of technologies) {
    const v = techViews.get(tech.key)!;
    const cost = currentTechPrice(tech);
    v.costEl.textContent = `Cost: ${fmtNum(cost, 2)}`;
    v.rateEl.textContent = `+${fmtNum(tech.rate * tech.count, 2)} energy/sec`;
    v.btn.disabled = eT < cost;
    v.btn.textContent = `Advance (${fmtInt(tech.count)})`;
  }
}
function updateStoreRows() {
  for (const item of storeItems) {
    const v = storeViews.get(item.key)!;
    v.nameEl.textContent = item.name;
    v.descEl.textContent = item.description;
    if (item.key === "autoclicker_bot") {
      v.costSpan.textContent = `Cost: ${fmtInt(item.baseCost)}`;
      v.levelSpan.textContent = `Lv. ${item.level}`;
      v.purchaseBtn.disabled = eT < item.baseCost;
      if (v.upgradeBtn) {
        v.upgradeBtn.textContent = `Upgrade (${fmtInt(item.upgradeCost!)})`;
        v.upgradeBtn.disabled = eT < item.upgradeCost!;
      }
    } else if (item.key === "planetary_relocation") {
      const cost = currentItemPrice(item);
      v.costSpan.textContent = ``;
      v.levelSpan.textContent = "";
      v.purchaseBtn.textContent = `Relocate (${fmtInt(cost)})`;
      v.purchaseBtn.disabled = eT < cost || item.level > 0;
      if (item.level > 0) {
        v.purchaseBtn.textContent = `Relocated!`;
        v.row.style.opacity = "0.5";
      }
    }
  }
}
function render(now: number, force = false) {
  if (!force && now - lastRender < RENDER_MS) return;
  lastRender = now;

  statTotal.textContent = `${fmtNum(eT, 2)} energy`;
  statEps.textContent = `EPS: ${fmtNum(eps, 2)}/sec`;
  statEpc.textContent = `EPC: ${fmtNum(epc, 2)}`;

  globe.className = `globe spin ${currentPlanetSprite}`;
  const remainingTime = timedAutoclickerEndTime - now;
  if (remainingTime > 0) {
    iconWrap.classList.add("sparkling");
    timerBarContainer.style.display = "block";
    timerBarFill.style.width = `${(remainingTime / (1 * 60 * 1000)) * 100}%`;
  } else {
    iconWrap.classList.remove("sparkling");
    timerBarContainer.style.display = "none";
  }
  updateTechRows();
  updateStoreRows();
}

/* ----- Game Loop ----- */
function tick(now: number) {
  const dt = now - lastTick;
  if (dt >= TICK_MS) {
    const steps = Math.floor(dt / TICK_MS);
    eT += eps * (TICK_MS / 1000) * steps;
    lastTick += steps * TICK_MS;
    render(now);
  }
  requestAnimationFrame(tick);
}

/* ----- Initialization ----- */
updateCalculations();
render(performance.now(), true);
requestAnimationFrame(tick);
