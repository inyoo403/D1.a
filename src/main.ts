import "./style.css";

/* ----- Game State ----- */
let energyTotal = 0;
let energyPerSec = 0;
let energyPerClick = 1;

let lastTick = performance.now();
let lastRender = 0;
let autoClickerUntilMs = 0;
let autoClickIntervalId: number | null = null;
let isCheatActive = false;
let currentPlanetSprite = "earth";
const clickPowerMultiplier = 1.0;

const TICK_MS = 50;
const RENDER_MS = 100;

const CLICK_BASE = 1;
const CLICK_TOOL_PER_LEVEL = 0.5;
const GLOBAL_PROD_MULT_PER_RELOC = 0.05;
const TECH_PRICE_GROWTH = 1.15;
const ITEM_PRICE_GROWTH_DEFAULT = 2;

const AUTOCLICK_DURATION_BASE_MS = 30_000;

const UPGRADE_DURATION_INCREMENT = 0.15; // Auto-click duration increase per level
const UPGRADE_BASE_DELAY_MS = 100; // Base delay in milliseconds
const PERFORMANCE_BOOST_MULTIPLIER = 1.5; // Speed multiplier per upgrade level
const ENERGY_FROM_EPS_RATIO = 0.15; // EPC contribution from EPS

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
  priceGrowth?: number;
  maxLevel?: number;
}

const technologies: Tech[] = [
  {
    key: "fire",
    name: "Fire Discovery",
    baseCost: 15,
    rate: 0.1,
    description: "First spark of civilization (+0.1 energy/sec)",
    count: 0,
  },
  {
    key: "steam",
    name: "Steam Engine",
    baseCost: 100,
    rate: 1.0,
    description: "Age of Steam (+1.0 energy/sec)",
    count: 0,
  },
  {
    key: "factory",
    name: "Factory Network",
    baseCost: 1100,
    rate: 8.0,
    description: "Industrial mass production (+8.0 energy/sec)",
    count: 0,
  },
  {
    key: "datacenter",
    name: "Data Center Grid",
    baseCost: 12000,
    rate: 47.0,
    description: "AI-automated production (+47.0 energy/sec)",
    count: 0,
  },
  {
    key: "orbital",
    name: "Orbital Solar Array",
    baseCost: 130000,
    rate: 260.0,
    description: "Planetary-scale grid (+260.0 energy/sec)",
    count: 0,
  },
];

const storeItems: StoreItem[] = [
  {
    key: "click_tools",
    name: "Click Tools",
    baseCost: 100,
    description:
      "Improve manual harvesting. Each level adds +0.5 EPC (before EPS share).",
    level: 0,
    effectPerLevel: CLICK_TOOL_PER_LEVEL,
    priceGrowth: 1.7,
  },
  {
    key: "autoclicker_bot",
    name: "Burst Autoclick",
    baseCost: 1200,
    description:
      "Activate a 30s burst of rapid clicks. Upgrade speeds up the burst.",
    level: 1,
    upgradeCost: 8000,
    priceGrowth: 1.25,
  },
  {
    key: "planetary_relocation",
    name: "Orbital Relocation",
    baseCost: 25000,
    description:
      "Migrate infrastructure. +5% global EPS, +EPS-linked click power. Stacks.",
    level: 0,
    effectPerLevel: GLOBAL_PROD_MULT_PER_RELOC,
    spriteClasses: ["earth", "mars"],
    priceGrowth: 2.0,
    maxLevel: 5,
  },
];

/* ----- Utilities & Calculations ----- */
const SUFFIXES = [
  "",
  "K",
  "M",
  "B",
  "T",
  "Qa",
  "Qi",
  "Sx",
  "Sp",
  "Oc",
  "No",
  "De",
];

function fmtBig(n: number): string {
  if (n < 1000) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  const tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIXES.length) return n.toExponential(2);
  const scaled = n / Math.pow(1000, tier);
  return `${scaled.toFixed(2)}${SUFFIXES[tier]}`;
}

const fmtInt = (n: number) => n.toLocaleString();

const calcTechCost = (t: Tech) =>
  t.baseCost * Math.pow(TECH_PRICE_GROWTH, t.count);

const calcItemCost = (item: StoreItem) => {
  if (item.key === "autoclicker_bot") return item.baseCost;
  const growth = item.priceGrowth ?? ITEM_PRICE_GROWTH_DEFAULT;
  return Math.floor(item.baseCost * Math.pow(growth, item.level));
};

function recalcProduction() {
  const baseEps = technologies.reduce((s, t) => s + t.count * t.rate, 0);
  const relocation = storeItems.find((i) => i.key === "planetary_relocation")!;
  const globalMult = 1 + (relocation.effectPerLevel! * relocation.level);
  energyPerSec = baseEps * globalMult;

  const clickTools = storeItems.find((i) => i.key === "click_tools")!;
  const clickToolsBonus = clickTools.level * (clickTools.effectPerLevel ?? 0);
  const fromEps = energyPerSec * ENERGY_FROM_EPS_RATIO;
  energyPerClick = (CLICK_BASE + clickToolsBonus + fromEps) *
    clickPowerMultiplier;
}

const getAutoClickDelay = () => {
  const autoclicker = storeItems.find((i) => i.key === "autoclicker_bot")!;
  const performanceMultiplier = Math.pow(
    PERFORMANCE_BOOST_MULTIPLIER,
    autoclicker.level - 1,
  );
  return Math.max(10, UPGRADE_BASE_DELAY_MS / performanceMultiplier);
};

const getAutoClickDurationMs = () => {
  const ac = storeItems.find((i) => i.key === "autoclicker_bot")!;
  const mult = 1 + (UPGRADE_DURATION_INCREMENT * (ac.level - 1));
  return Math.floor(AUTOCLICK_DURATION_BASE_MS * mult);
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
title.textContent = "Planet Clicker";
const stats = document.createElement("div");
stats.className = "stats";
const statTotal = document.createElement("div");
statTotal.className = "stat-total";
const statEps = document.createElement("div");
statEps.className = "stat-energyPerSec";
const statEpc = document.createElement("div");
statEpc.className = "stat-energyPerClick";
stats.append(statTotal, statEps, statEpc);
const mainBtn = document.createElement("button");
mainBtn.className = "main-btn";
mainBtn.title = "Click to generate energy";
const iconWrap = document.createElement("div");
iconWrap.className = "iconWrap";
iconWrap.style.position = "relative";
let globe = document.createElement("div");
globe.className = "globe spin " + currentPlanetSprite;
globe.style.position = "absolute";
globe.style.inset = "0";
globe.style.opacity = "1";
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
      const cost = calcTechCost(tech);
      if (energyTotal >= cost) {
        energyTotal -= cost;
        tech.count += 1;
        recalcProduction();
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

let stopSprite: (() => void) | null = null;
let spriteStartMs = performance.now();
function startSprite(el: HTMLElement, cfg: SpriteCfg, startAtMs?: number) {
  let id = 0;
  const start = startAtMs ?? performance.now();
  spriteStartMs = start;

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

stopSprite = startSprite(globe, SPRITE, spriteStartMs);
function setPlanetSprite(nextClass: string) {
  const oldEl = globe;
  const prevStop = stopSprite;

  const newEl = document.createElement("div");
  newEl.className = "globe spin " + nextClass;
  newEl.style.position = "absolute";
  newEl.style.inset = "0";
  newEl.style.opacity = "0";
  newEl.style.willChange = "opacity, background-position";
  oldEl.style.willChange = "opacity, background-position";

  newEl.style.transition = "opacity 500ms ease";
  oldEl.style.transition = "opacity 500ms ease";

  iconWrap.appendChild(newEl);
  stopSprite = startSprite(newEl, SPRITE, spriteStartMs);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      newEl.style.opacity = "1";
      oldEl.style.opacity = "0";
    });
  });
  const onDone = () => {
    if (prevStop) prevStop();
    iconWrap.removeChild(oldEl);
    globe = newEl;
    newEl.removeEventListener("transitionend", onDone);
  };
  newEl.addEventListener("transitionend", onDone, { once: true });
}

/* ----- Events ----- */
function showFloatingText(amount: number, x: number, y: number) {
  const textEl = document.createElement("div");
  textEl.className = "floating-text";
  textEl.textContent = `+${fmtBig(amount)}`;
  const rect = columnLeft.getBoundingClientRect();
  textEl.style.left = `${x - rect.left}px`;
  textEl.style.top = `${y - rect.top}px`;
  columnLeft.appendChild(textEl);
  textEl.addEventListener("animationend", () => {
    textEl.remove();
  });
}

mainBtn.addEventListener("click", (e: MouseEvent) => {
  let clickValue = energyPerClick;
  if (performance.now() < autoClickerUntilMs) {
    const autoclicker = storeItems.find((i) => i.key === "autoclicker_bot")!;
    const autoclickerPowerMultiplier = 1 + (autoclicker.level - 1) * 0.1;
    clickValue *= autoclickerPowerMultiplier;
  }

  energyTotal += clickValue;

  let x: number, y: number;
  if (e.isTrusted) {
    x = e.clientX;
    y = e.clientY;
  } else {
    const rect = mainBtn.getBoundingClientRect();
    x = rect.left + Math.random() * rect.width;
    y = rect.top + Math.random() * rect.height;
  }
  showFloatingText(clickValue, x, y);

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
    energyTotal = isCheatActive ? Infinity : 0;
    console.log(`Cheat ${isCheatActive ? "activated" : "deactivated"}`);
    cheatClickCount = 0;
  }
});

const startAutoclicker = () => {
  const now = performance.now();
  const remainingTime = autoClickerUntilMs - now;
  if (remainingTime <= 0) {
    stopAutoclicker();
    return;
  }

  if (autoClickIntervalId !== null) return;

  autoClickIntervalId = setInterval(() => {
    const nowTick = performance.now();
    if (nowTick >= autoClickerUntilMs) {
      stopAutoclicker();
      return;
    }
    mainBtn.click();
  }, getAutoClickDelay());
};

const stopAutoclicker = () => {
  if (autoClickIntervalId !== null) {
    clearInterval(autoClickIntervalId);
    autoClickIntervalId = null;
  }
};

mainBtn.addEventListener("mousedown", startAutoclicker);
mainBtn.addEventListener("mouseup", stopAutoclicker);
mainBtn.addEventListener("mouseleave", stopAutoclicker);

function handleStorePurchase(itemKey: string) {
  const item = storeItems.find((i) => i.key === itemKey);
  if (!item) return;

  if (item.key === "autoclicker_bot") {
    const cost = item.baseCost;
    if (energyTotal < cost) return;
    energyTotal -= cost;
    const nowTs = performance.now();
    autoClickerUntilMs = nowTs + getAutoClickDurationMs();
    if (autoClickIntervalId !== null) {
      stopAutoclicker();
      startAutoclicker();
    }
  } else {
    if (item.maxLevel !== undefined && item.level >= item.maxLevel) return;
    const cost = calcItemCost(item);
    if (energyTotal < cost) return;
    energyTotal -= cost;
    item.level += 1;
    if (item.key === "planetary_relocation" && item.level === 1) {
      currentPlanetSprite = item.spriteClasses?.[1] ?? "earth";
      setPlanetSprite(currentPlanetSprite);
    }
  }

  recalcProduction();
  render(performance.now(), true);
}

function handleUpgrade(itemKey: string) {
  const item = storeItems.find((i) => i.key === itemKey);
  if (!item) return;

  if (item.key !== "autoclicker_bot") {
    recalcProduction();
    render(performance.now(), true);
    return;
  }

  const upCost = item.upgradeCost ?? 0;
  if (energyTotal < upCost) return;
  energyTotal -= upCost;

  const wasActive = performance.now() < autoClickerUntilMs;
  const nowTs = performance.now();
  const oldDuration = getAutoClickDurationMs();

  item.level++;
  const grow = item.priceGrowth ?? 1.25;
  item.upgradeCost = Math.floor((item.upgradeCost ?? upCost) * grow);

  if (wasActive) {
    const remainingFrac = Math.max(
      0,
      (autoClickerUntilMs - nowTs) / oldDuration,
    );
    const newDuration = getAutoClickDurationMs();
    autoClickerUntilMs = nowTs + remainingFrac * newDuration;
    if (autoClickIntervalId !== null) {
      stopAutoclicker();
      startAutoclicker();
    }
  }

  recalcProduction();
  render(performance.now(), true);
}

document.querySelector(".column-right .list")!.addEventListener(
  "click",
  (e) => {
    const target = e.target as HTMLElement;
    const itemKey = target.dataset.itemKey;
    const action = target.dataset.action || "purchase";
    if (!itemKey) return;

    const item = storeItems.find((i) => i.key === itemKey);
    if (!item) return;

    switch (action) {
      case "purchase":
        handleStorePurchase(itemKey);
        break;
      case "upgrade":
        handleUpgrade(itemKey);
        break;
    }
  },
);

/* ----- Render ----- */
function updateTechRows() {
  for (const tech of technologies) {
    const v = techViews.get(tech.key)!;
    const cost = calcTechCost(tech);
    v.costEl.textContent = `Cost: ${fmtBig(cost)}`;
    v.rateEl.textContent = `+${fmtBig(tech.rate * tech.count)}/sec`;
    v.btn.disabled = energyTotal < cost;
    v.btn.textContent = `Upgrade (${fmtInt(tech.count)})`;
  }
}

function updateStoreRows() {
  for (const item of storeItems) {
    const v = storeViews.get(item.key)!;
    v.nameEl.textContent = item.name;
    v.descEl.textContent = item.description;

    if (item.key === "autoclicker_bot") {
      v.costSpan.textContent = `Activate: ${fmtBig(item.baseCost)}`;
      v.levelSpan.textContent = `Lv. ${item.level}`;
      v.purchaseBtn.disabled = energyTotal < item.baseCost;
      if (v.upgradeBtn) {
        const upCost = item.upgradeCost ?? 0;
        v.upgradeBtn.textContent = `Upgrade (${fmtBig(upCost)})`;
        v.upgradeBtn.disabled = energyTotal < upCost;
      }
    } else {
      const cost = calcItemCost(item);
      const levelStr = item.maxLevel !== undefined
        ? `Lv. ${item.level}/${item.maxLevel}`
        : `Lv. ${item.level}`;
      v.levelSpan.textContent = levelStr;
      const capped = item.maxLevel !== undefined && item.level >= item.maxLevel;
      v.purchaseBtn.textContent = capped ? `Maxed` : `Upgrade`;
      v.purchaseBtn.disabled = capped || energyTotal < cost;
      v.costSpan.textContent = capped ? `` : `Cost: ${fmtBig(cost)}`;
      v.row.style.opacity = capped ? "0.6" : "1";
    }
  }
}

function render(now: number, force = false) {
  if (!force && now - lastRender < RENDER_MS) return;
  lastRender = now;

  let displayedEpc = energyPerClick;
  const remainingTime = autoClickerUntilMs - now;

  if (remainingTime > 0) {
    const autoclicker = storeItems.find((i) => i.key === "autoclicker_bot")!;
    const autoclickerPowerMultiplier = 1 + (autoclicker.level - 1) * 0.1;
    displayedEpc *= autoclickerPowerMultiplier;

    iconWrap.classList.add("sparkling");
    timerBarContainer.style.display = "block";
    const currentDuration = getAutoClickDurationMs();
    timerBarFill.style.width = `${
      Math.max(0, Math.min(1, remainingTime / currentDuration)) * 100
    }%`;
  } else {
    iconWrap.classList.remove("sparkling");
    timerBarContainer.style.display = "none";
  }

  statTotal.textContent = `${fmtBig(energyTotal)} energy`;
  statEps.textContent = `EPS: ${fmtBig(energyPerSec)}`;
  statEpc.textContent = `EPC: ${fmtBig(displayedEpc)}`;

  if (!globe.classList.contains(currentPlanetSprite)) {
    setPlanetSprite(currentPlanetSprite);
  }

  updateTechRows();
  updateStoreRows();
}

/* ----- Game Loop ----- */
function tick(now: number) {
  const dt = now - lastTick;
  if (dt >= TICK_MS) {
    const steps = Math.floor(dt / TICK_MS);
    energyTotal += energyPerSec * (TICK_MS / 1000) * steps;
    lastTick += steps * TICK_MS;
    render(now);
  }
  requestAnimationFrame(tick);
}

/* ----- Initialization ----- */
recalcProduction();
render(performance.now(), true);
requestAnimationFrame(tick);
