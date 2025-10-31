import "./style.css";

/* ---------- Utilities ---------- */
const SUFFIX = [
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
const fmtBig = (n: number) =>
  n < 1e3
    ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : `${(n / 10 ** (3 * Math.floor(Math.log10(n) / 3))).toFixed(2)}${
      SUFFIX[Math.floor(Math.log10(n) / 3)]
    }`;
const fmtInt = (n: number) => n.toLocaleString();

/* ---------- SFX ---------- */
// SFX on tech/store purchase (credit: benho612/CMPM1212-D1-Assignement)
class Sfx {
  private base = new Audio("sfx/upgrade.wav");
  private ready = false;
  constructor(volume = 0.8) {
    this.base.preload = "auto";
    this.base.volume = volume;
    document.addEventListener(
      "pointerdown",
      async () => {
        if (this.ready) return;
        try {
          await this.base.play();
          this.base.pause();
          this.base.currentTime = 0;
          this.ready = true;
        } catch { /* no-op */ }
      },
      { once: true },
    );
  }
  play() {
    const a = this.base.cloneNode(true) as HTMLAudioElement;
    a.volume = this.base.volume;
    a.currentTime = 0;
    void a.play().catch(() => {});
  }
}

/* ---------- Autoclicker ---------- */
class AutoClicker {
  private until = 0;
  private id: number | null = null;
  constructor(private getDelay: () => number, private click: () => void) {}
  activate(durationMs: number) {
    const now = performance.now();
    this.until = now + durationMs;
    this.stop();
    this.start();
  }
  private start() {
    if (this.id !== null) return;
    this.id = globalThis.setInterval(() => {
      if (performance.now() >= this.until) {
        this.stop();
        return;
      }
      this.click();
    }, Math.max(10, this.getDelay()));
  }
  stop() {
    if (this.id !== null) {
      globalThis.clearInterval(this.id);
      this.id = null;
    }
  }
  remaining(now = performance.now()) {
    return Math.max(0, this.until - now);
  }
  isActive(now = performance.now()) {
    return this.remaining(now) > 0;
  }
}

/* ---------- Types ---------- */
enum ItemKey {
  ClickTools = "click_tools",
  AutoClicker = "autoclicker_bot",
  Relocation = "planetary_relocation",
}
type TechCfg = Readonly<
  { key: string; name: string; baseCost: number; rate: number; desc: string }
>;
type ItemCfg = Readonly<{
  key: ItemKey;
  name: string;
  baseCost: number;
  desc: string;
  priceGrowth?: number;
  maxLevel?: number;
  effectPerLevel?: number;
  upgradeCost?: number;
  spriteClasses?: string[];
}>;
type ItemState = { level: number; upgradeCost?: number };

/* ---------- Static Configs ---------- */
const TECHS: TechCfg[] = [
  {
    key: "fire",
    name: "Fire Discovery",
    baseCost: 15,
    rate: 0.1,
    desc: "+0.1 energy/sec",
  },
  {
    key: "steam",
    name: "Steam Engine",
    baseCost: 100,
    rate: 1.0,
    desc: "+1.0 energy/sec",
  },
  {
    key: "factory",
    name: "Factory Network",
    baseCost: 1100,
    rate: 8.0,
    desc: "+8.0 energy/sec",
  },
  {
    key: "datacenter",
    name: "Data Center Grid",
    baseCost: 12000,
    rate: 47.0,
    desc: "+47.0 energy/sec",
  },
  {
    key: "orbital",
    name: "Orbital Solar Array",
    baseCost: 130000,
    rate: 260.0,
    desc: "+260.0 energy/sec",
  },
];

const ITEMS: ItemCfg[] = [
  {
    key: ItemKey.ClickTools,
    name: "Click Tools",
    baseCost: 100,
    desc: "+0.5 EPC per level",
    priceGrowth: 1.7,
    effectPerLevel: 0.5,
  },
  {
    key: ItemKey.AutoClicker,
    name: "Burst Autoclick",
    baseCost: 1200,
    desc: "30s burst; upgrades speed/duration",
    priceGrowth: 1.25,
    upgradeCost: 8000,
  },
  {
    key: ItemKey.Relocation,
    name: "Orbital Relocation",
    baseCost: 25000,
    desc: "+5% global EPS; stacks",
    priceGrowth: 2.0,
    effectPerLevel: 0.05,
    maxLevel: 5,
    spriteClasses: ["earth", "mars"],
  },
];

/* ---------- GameState ---------- */
class GameState {
  static readonly TICK_MS = 50;
  static readonly RENDER_MS = 100;
  static readonly CLICK_BASE = 1;
  static readonly ENERGY_FROM_EPS_RATIO = 0.15;
  static readonly TECH_GROWTH = 1.15;
  static readonly ITEM_PRICE_GROWTH_DEFAULT = 2.0;
  static readonly AUTOCLICK_BASE_MS = 30_000;
  static readonly AUTOCLICK_DURATION_INC = 0.15;
  static readonly AUTOCLICK_SPEED_MULT = 1.5;
  static readonly AUTOCLICK_BASE_DELAY_MS = 100;

  #total = 0;
  #techCounts = new Map<string, number>(TECHS.map((t) => [t.key, 0]));
  #items: Record<ItemKey, ItemState> = {
    [ItemKey.ClickTools]: { level: 0 },
    [ItemKey.AutoClicker]: {
      level: 1,
      upgradeCost:
        ITEMS.find((i) => i.key === ItemKey.AutoClicker)!.upgradeCost,
    },
    [ItemKey.Relocation]: { level: 0 },
  };
  #currentPlanet = "earth";
  #lastRender = 0;

  get total() {
    return this.#total;
  }
  get planet() {
    return this.#currentPlanet;
  }
  get techs() {
    return TECHS;
  }
  get itemsCfg() {
    return ITEMS;
  }
  get lastRender() {
    return this.#lastRender;
  }
  set lastRender(v: number) {
    this.#lastRender = v;
  }
  getItemState(k: ItemKey) {
    return this.#items[k];
  }
  getTechCount(key: string) {
    return this.#techCounts.get(key)!;
  }

  eps(): number {
    const base = TECHS.reduce(
      (s, t) => s + this.getTechCount(t.key) * t.rate,
      0,
    );
    const relocLv = this.#items[ItemKey.Relocation].level;
    const mult = 1 +
      (ITEMS.find((i) => i.key === ItemKey.Relocation)!.effectPerLevel ?? 0) *
        relocLv;
    return base * mult;
  }
  epc(mult = 1): number {
    const toolsLv = this.#items[ItemKey.ClickTools].level;
    const tools = toolsLv *
      (ITEMS.find((i) => i.key === ItemKey.ClickTools)!.effectPerLevel ?? 0);
    const fromEps = this.eps() * GameState.ENERGY_FROM_EPS_RATIO;
    return (GameState.CLICK_BASE + tools + fromEps) * mult;
  }
  techCost(t: TechCfg) {
    return t.baseCost *
      Math.pow(GameState.TECH_GROWTH, this.getTechCount(t.key));
  }
  itemCost(cfg: ItemCfg): number {
    if (cfg.key === ItemKey.AutoClicker) return cfg.baseCost;
    const g = cfg.priceGrowth ?? GameState.ITEM_PRICE_GROWTH_DEFAULT;
    return Math.floor(cfg.baseCost * Math.pow(g, this.#items[cfg.key].level));
  }

  addEnergy(x: number) {
    this.#total += x;
  }
  spend(x: number) {
    if (this.#total < x) return false;
    this.#total -= x;
    return true;
  }
  clickValue(autoclickLevel: number, autoclickActive: boolean) {
    const mult = autoclickActive ? (1 + (autoclickLevel - 1) * 0.1) : 1;
    return this.epc(mult);
  }
  buyTech(key: string) {
    const t = TECHS.find((t) => t.key === key)!;
    const cost = this.techCost(t);
    if (!this.spend(cost)) return false;
    this.#techCounts.set(key, this.getTechCount(key) + 1);
    return true;
  }
  purchaseItem(cfg: ItemCfg, onRelocated?: () => void) {
    if (cfg.key === ItemKey.AutoClicker) return this.spend(cfg.baseCost);
    const st = this.#items[cfg.key];
    if (cfg.maxLevel !== undefined && st.level >= cfg.maxLevel) return false;
    const cost = this.itemCost(cfg);
    if (!this.spend(cost)) return false;
    st.level += 1;
    if (cfg.key === ItemKey.Relocation && st.level === 1) {
      this.#currentPlanet = cfg.spriteClasses?.[1] ?? "earth";
      onRelocated?.();
    }
    return true;
  }
  upgradeAutoClicker(cfg: ItemCfg) {
    const st = this.#items[ItemKey.AutoClicker];
    const upCost = st.upgradeCost ?? 0;
    if (!this.spend(upCost)) return false;
    st.level++;
    const grow = cfg.priceGrowth ?? 1.25;
    st.upgradeCost = Math.floor((st.upgradeCost ?? upCost) * grow);
    return true;
  }

  getAutoDelay() {
    const lv = this.#items[ItemKey.AutoClicker].level;
    const mult = Math.pow(GameState.AUTOCLICK_SPEED_MULT, lv - 1);
    return Math.max(10, GameState.AUTOCLICK_BASE_DELAY_MS / mult);
  }
  getAutoDurationMs() {
    const lv = this.#items[ItemKey.AutoClicker].level;
    return Math.floor(
      GameState.AUTOCLICK_BASE_MS *
        (1 + GameState.AUTOCLICK_DURATION_INC * (lv - 1)),
    );
  }
}

/* ---------- Sprite ---------- */
type SpriteCfg = {
  cols: number;
  rows: number;
  total: number;
  durationMs: number;
};
const SPRITE: SpriteCfg = { cols: 30, rows: 10, total: 300, durationMs: 20000 };

class SpriteAnimator {
  private els = new Set<HTMLElement>();
  private rafId = 0;
  private startAt = performance.now();

  constructor(private cfg: SpriteCfg) {}

  register(el: HTMLElement) {
    this.els.add(el);
  }
  unregister(el: HTMLElement) {
    this.els.delete(el);
  }

  start() {
    if (this.rafId) return;
    const tick = (t: number) => {
      const elapsed = (t - this.startAt) % this.cfg.durationMs;
      const idx = Math.floor((elapsed / this.cfg.durationMs) * this.cfg.total);
      const col = idx % this.cfg.cols;
      const row = Math.floor(idx / this.cfg.cols);
      const x = (col / (this.cfg.cols - 1)) * 100;
      const y = (row / (this.cfg.rows - 1)) * 100;
      for (const el of this.els) el.style.backgroundPosition = `${x}% ${y}%`;
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
  stop() {
    if (!this.rafId) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }
}

/* ---------- View ---------- */
type TechRefs = {
  btn: HTMLButtonElement;
  costEl: HTMLSpanElement;
  rateEl: HTMLSpanElement;
};
type ItemRefs = {
  row: HTMLDivElement;
  nameEl: HTMLDivElement;
  descEl: HTMLDivElement;
  costSpan: HTMLSpanElement;
  levelSpan: HTMLSpanElement;
  purchaseBtn: HTMLButtonElement;
  upgradeBtn?: HTMLButtonElement;
};
type ViewRefs = {
  columnLeft: HTMLDivElement;
  totalEl: HTMLDivElement;
  epsEl: HTMLDivElement;
  epcEl: HTMLDivElement;
  mainBtn: HTMLButtonElement;
  iconWrap: HTMLDivElement;
  globe: HTMLDivElement;
  timerBar: HTMLDivElement;
  timerFill: HTMLDivElement;
  techList: HTMLDivElement;
  storeList: HTMLDivElement;
  techViews: Map<string, TechRefs>;
  storeViews: Map<ItemKey, ItemRefs>;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts?: {
    className?: string;
    text?: string;
    dataset?: Record<string, string>;
    title?: string;
  },
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (opts?.className) e.className = opts.className;
  if (opts?.text) e.textContent = opts.text;
  if (opts?.title) e.title = opts.title;
  if (opts?.dataset) {
    const ds = e.dataset as DOMStringMap;
    for (const [k, v] of Object.entries(opts.dataset)) ds[k] = v;
  }
  return e;
}

class View {
  refs!: ViewRefs;
  private animator = new SpriteAnimator(SPRITE);

  init(state: GameState): ViewRefs {
    const gameContainer = el("div", {
      className: "game-container",
    }) as HTMLDivElement;
    document.body.appendChild(gameContainer);

    const columnLeft = el("div", {
      className: "column column-left",
    }) as HTMLDivElement;
    const columnMiddle = el("div", {
      className: "column column-middle",
    }) as HTMLDivElement;
    const columnRight = el("div", {
      className: "column column-right",
    }) as HTMLDivElement;
    gameContainer.append(columnLeft, columnMiddle, columnRight);

    const title = el("h1", { className: "game-title", text: "Planet Clicker" });
    const stats = el("div", { className: "stats" });
    const totalEl = el("div", { className: "stat-total" }) as HTMLDivElement;
    const epsEl = el("div", {
      className: "stat-energyPerSec",
    }) as HTMLDivElement;
    const epcEl = el("div", {
      className: "stat-energyPerClick",
    }) as HTMLDivElement;
    stats.append(totalEl, epsEl, epcEl);

    const mainBtn = el("button", {
      className: "main-btn",
      title: "Click to generate energy",
    }) as HTMLButtonElement;
    const iconWrap = el("div", { className: "iconWrap" }) as HTMLDivElement;
    iconWrap.style.position = "relative";

    const globe = el("div", {
      className: `globe ${state.planet}`,
    }) as HTMLDivElement;
    globe.style.position = "absolute";
    globe.style.inset = "0";
    globe.style.opacity = "1";
    iconWrap.appendChild(globe);
    mainBtn.appendChild(iconWrap);

    const timerBar = el("div", {
      className: "timer-bar-container",
    }) as HTMLDivElement;
    const timerFill = el("div", {
      className: "timer-bar-fill",
    }) as HTMLDivElement;
    timerBar.appendChild(timerFill);

    columnLeft.append(title, stats, mainBtn, timerBar);

    const techTitle = el("div", {
      className: "section-title",
      text: "Technological Advancements",
    });
    const techList = el("div", { className: "list" }) as HTMLDivElement;
    columnMiddle.append(techTitle, techList);

    const storeTitle = el("div", {
      className: "section-title",
      text: "Item Store",
    });
    const storeList = el("div", { className: "list" }) as HTMLDivElement;
    columnRight.append(storeTitle, storeList);

    const techViews = new Map<string, TechRefs>();
    for (const t of state.techs) {
      const row = el("div", { className: "row" });
      const info = el("div", { className: "price" });
      const nameEl = el("div", { className: "item-name", text: t.name });
      const descEl = el("div", { className: "item-desc", text: t.desc });
      const sub = el("div", { className: "item-sub" });
      const costEl = el("span") as HTMLSpanElement;
      const rateEl = el("span") as HTMLSpanElement;
      sub.append(costEl, document.createTextNode(" · "), rateEl);
      info.append(nameEl, descEl, sub);

      const btn = el("button", {
        className: "buy-btn",
        text: `Upgrade (${fmtInt(0)})`,
      }) as HTMLButtonElement;
      row.append(info, btn);
      techList.appendChild(row);

      techViews.set(t.key, { btn, costEl, rateEl });
    }

    const storeViews = new Map<ItemKey, ItemRefs>();
    for (const cfg of state.itemsCfg) {
      const row = el("div", { className: "row" }) as HTMLDivElement;
      const info = el("div", { className: "price" });
      const nameEl = el("div", { className: "item-name" }) as HTMLDivElement;
      const descEl = el("div", { className: "item-desc" }) as HTMLDivElement;
      const sub = el("div", { className: "item-sub" });
      const costSpan = el("span") as HTMLSpanElement;
      const levelSpan = el("span", {
        className: "level-display",
      }) as HTMLSpanElement;
      sub.append(costSpan, levelSpan);
      info.append(nameEl, descEl, sub);

      const purchaseBtn = el("button", {
        className: "buy-btn store-btn",
        dataset: { action: "purchase", itemKey: cfg.key },
      }) as HTMLButtonElement;

      let upgradeBtn: HTMLButtonElement | undefined;
      if (cfg.key === ItemKey.AutoClicker) {
        purchaseBtn.textContent = "Activate";
        const group = el("div", { className: "button-group" });
        upgradeBtn = el("button", {
          className: "upgrade-btn",
          dataset: { action: "upgrade", itemKey: cfg.key },
        }) as HTMLButtonElement;
        group.append(purchaseBtn, upgradeBtn);
        row.append(info, group);
      } else {
        row.append(info, purchaseBtn);
      }

      storeList.appendChild(row);
      storeViews.set(cfg.key, {
        row,
        nameEl,
        descEl,
        costSpan,
        levelSpan,
        purchaseBtn,
        upgradeBtn,
      });
    }

    this.animator.register(globe);
    this.animator.start();

    this.refs = {
      columnLeft,
      totalEl,
      epsEl,
      epcEl,
      mainBtn,
      iconWrap,
      globe,
      timerBar,
      timerFill,
      techList,
      storeList,
      techViews,
      storeViews,
    };
    return this.refs;
  }

  setPlanet(refs: ViewRefs, nextClass: string) {
    const oldEl = refs.globe;
    const newEl = el("div", {
      className: `globe ${nextClass}`,
    }) as HTMLDivElement;
    newEl.style.position = "absolute";
    newEl.style.inset = "0";
    newEl.style.opacity = "0";
    newEl.style.willChange = "opacity, background-position";
    oldEl.style.willChange = "opacity, background-position";
    newEl.style.transition = "opacity 500ms ease";
    oldEl.style.transition = "opacity 500ms ease";

    refs.iconWrap.appendChild(newEl);
    this.animator.register(newEl);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        newEl.style.opacity = "1";
        oldEl.style.opacity = "0";
      });
    });

    const onDone = () => {
      this.animator.unregister(oldEl);
      refs.iconWrap.removeChild(oldEl);
      refs.globe = newEl;
      newEl.removeEventListener("transitionend", onDone);
    };
    newEl.addEventListener("transitionend", onDone, { once: true });
  }

  render(state: GameState, refs: ViewRefs, autoclickRemainingMs: number) {
    refs.totalEl.textContent = `${fmtBig(state.total)} energy`;
    refs.epsEl.textContent = `EPS: ${fmtBig(state.eps())}`;
    refs.epcEl.textContent = `EPC: ${fmtBig(state.epc())}`;

    if (autoclickRemainingMs > 0) {
      refs.iconWrap.classList.add("sparkling");
      refs.timerBar.style.display = "block";
      const pct = Math.max(
        0,
        Math.min(1, autoclickRemainingMs / state.getAutoDurationMs()),
      );
      refs.timerFill.style.width = `${pct * 100}%`;
    } else {
      refs.iconWrap.classList.remove("sparkling");
      refs.timerBar.style.display = "none";
    }

    if (!refs.globe.classList.contains(state.planet)) {
      this.setPlanet(refs, state.planet);
    }

    for (const t of state.techs) {
      const v = refs.techViews.get(t.key)!;
      const cost = state.techCost(t);
      const count = state.getTechCount(t.key);
      v.costEl.textContent = `Cost: ${fmtBig(cost)}`;
      v.rateEl.textContent = `+${fmtBig(t.rate * count)}/sec`;
      v.btn.disabled = state.total < cost;
      v.btn.textContent = `Upgrade (${fmtInt(count)})`;
    }

    for (const cfg of state.itemsCfg) {
      const v = refs.storeViews.get(cfg.key)!;
      v.nameEl.textContent = cfg.name;
      v.descEl.textContent = cfg.desc;

      if (cfg.key === ItemKey.AutoClicker) {
        const st = state.getItemState(ItemKey.AutoClicker);
        v.costSpan.textContent = `Activate: ${fmtBig(cfg.baseCost)}`;
        v.levelSpan.textContent = `Lv. ${st.level}`;
        v.purchaseBtn.disabled = state.total < cfg.baseCost;
        if (v.upgradeBtn) {
          const up = st.upgradeCost ?? 0;
          v.upgradeBtn.textContent = `Upgrade (${fmtBig(up)})`;
          v.upgradeBtn.disabled = state.total < up;
        }
      } else {
        const st = state.getItemState(cfg.key);
        const maxed = cfg.maxLevel !== undefined && st.level >= cfg.maxLevel;
        const cost = state.itemCost(cfg);
        const levelStr = cfg.maxLevel !== undefined
          ? `Lv. ${st.level}/${cfg.maxLevel}`
          : `Lv. ${st.level}`;
        v.levelSpan.textContent = levelStr;
        v.purchaseBtn.textContent = maxed ? "Maxed" : "Upgrade";
        v.purchaseBtn.disabled = maxed || state.total < cost;
        v.costSpan.textContent = maxed ? "" : `Cost: ${fmtBig(cost)}`;
        v.row.style.opacity = maxed ? "0.6" : "1";
      }
    }
  }

  floatingGain(refs: ViewRefs, amount: number, x: number, y: number) {
    const textEl = el("div", {
      className: "floating-text",
      text: `+${fmtBig(amount)}`,
    });
    const rect = refs.columnLeft.getBoundingClientRect();
    (textEl as HTMLElement).style.left = `${x - rect.left}px`;
    (textEl as HTMLElement).style.top = `${y - rect.top}px`;
    refs.columnLeft.appendChild(textEl);
    textEl.addEventListener("animationend", () => textEl.remove());
  }
}

/* ---------- App ---------- */
class App {
  private state = new GameState();
  private view = new View();
  private sfx = new Sfx(0.6);
  private refs!: ViewRefs;
  private ac!: AutoClicker;
  private lastTick = performance.now();

  start() {
    this.refs = this.view.init(this.state);

    this.ac = new AutoClicker(
      () => this.state.getAutoDelay(),
      () => this.onMainClick(),
    );

    this.refs.mainBtn.addEventListener(
      "click",
      (e: MouseEvent) => this.onMainClick(e),
    );

    for (const t of this.state.techs) {
      const v = this.refs.techViews.get(t.key)!;
      v.btn.addEventListener("click", () => {
        if (v.btn.disabled) return;
        if (this.state.buyTech(t.key)) {
          this.sfx.play();
          this.render();
        }
      });
    }

    this.refs.storeList.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "button",
      );
      if (!btn || btn.disabled) return;
      const action = (btn.dataset.action ?? "purchase") as
        | "purchase"
        | "upgrade";
      const itemKey = btn.dataset.itemKey as ItemKey | undefined;
      if (!itemKey) return;

      const cfg = this.state.itemsCfg.find((i) => i.key === itemKey)!;

      if (action === "purchase") {
        if (itemKey === ItemKey.AutoClicker) {
          if (this.state.purchaseItem(cfg)) {
            this.sfx.play();
            this.activateAutoClicker();
          }
        } else {
          if (this.state.purchaseItem(cfg, () => {})) {
            this.sfx.play();
          }
        }
      } else {
        if (
          itemKey === ItemKey.AutoClicker && this.state.upgradeAutoClicker(cfg)
        ) {
          this.sfx.play();
          if (this.ac.isActive()) this.activateAutoClicker();
        }
      }
      this.render();
    });

    this.render();
    requestAnimationFrame(this.loop);
  }

  private onMainClick(e?: MouseEvent) {
    const st = this.state.getItemState(ItemKey.AutoClicker);
    const gain = this.state.clickValue(st.level, this.ac.isActive());
    this.state.addEnergy(gain);

    const btnRect = this.refs.mainBtn.getBoundingClientRect();
    const x = e ? e.clientX : btnRect.left + btnRect.width / 2;
    const y = e ? e.clientY : btnRect.top + btnRect.height / 2;
    this.view.floatingGain(this.refs, gain, x, y);

    this.refs.iconWrap.classList.remove("pop");
    void this.refs.iconWrap.offsetWidth;
    this.refs.iconWrap.classList.add("pop");

    this.render();
  }

  private activateAutoClicker() {
    const dur = this.state.getAutoDurationMs();
    this.ac.activate(dur);
  }

  private loop = (now: number) => {
    const dt = now - this.lastTick;
    if (dt >= GameState.TICK_MS) {
      const steps = Math.floor(dt / GameState.TICK_MS);
      this.state.addEnergy(
        this.state.eps() * (GameState.TICK_MS / 1000) * steps,
      );
      this.lastTick += steps * GameState.TICK_MS;
      this.render();
    }
    requestAnimationFrame(this.loop);
  };

  private render() {
    const now = performance.now();
    if (now - this.state.lastRender < GameState.RENDER_MS) return;
    this.state.lastRender = now;
    const rem = this.ac.remaining();
    this.view.render(this.state, this.refs, rem);
  }
}

new App().start();
