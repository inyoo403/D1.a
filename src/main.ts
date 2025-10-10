let apples: number = 0;
let applesPerSecond: number = 0;

const UPGRADE_BASE_PRICE: number = 10;
const UPGRADE_GROWTH: number = 1.15;
let upgradesOwned: number = 0;

const app: HTMLDivElement = document.createElement("div");
app.style.maxWidth = "780px";
app.style.margin = "32px auto";
app.style.font =
  "16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
app.style.padding = "0 16px";
app.style.textAlign = "center";
document.body.appendChild(app);

const title: HTMLHeadingElement = document.createElement("h1");
title.textContent = "🍎 Apple Clicker";
app.appendChild(title);

const applesEl: HTMLParagraphElement = document.createElement("p");
applesEl.style.fontSize = "22px";
applesEl.style.margin = "12px 0 4px";
app.appendChild(applesEl);

const rateEl: HTMLParagraphElement = document.createElement("p");
rateEl.style.margin = "0 0 16px";
app.appendChild(rateEl);

const ownedEl: HTMLParagraphElement = document.createElement("p");
ownedEl.style.margin = "0 0 20px";
app.appendChild(ownedEl);

const mainBtn: HTMLButtonElement = document.createElement("button");
mainBtn.style.display = "inline-block";
mainBtn.style.border = "0";
mainBtn.style.background = "transparent";
mainBtn.style.padding = "0";
mainBtn.style.cursor = "pointer";
mainBtn.style.userSelect = "none";
mainBtn.style.outlineOffset = "4px";
mainBtn.style.fontSize = "140px";
mainBtn.textContent = "🍎";
app.appendChild(mainBtn);

function squish(on: boolean): void {
  mainBtn.style.transition = "transform 60ms ease";
  mainBtn.style.transform = on ? "scale(0.95)" : "scale(1)";
}
mainBtn.addEventListener("pointerdown", () => squish(true));
mainBtn.addEventListener("pointerup", () => squish(false));
mainBtn.addEventListener("pointerleave", () => squish(false));
mainBtn.addEventListener("blur", () => squish(false));

const upgradesTitle: HTMLHeadingElement = document.createElement("h2");
upgradesTitle.textContent = "Orchard Upgrade";
upgradesTitle.style.marginTop = "28px";
app.appendChild(upgradesTitle);

const row: HTMLDivElement = document.createElement("div");
row.style.display = "inline-flex";
row.style.alignItems = "center";
row.style.gap = "10px";
app.appendChild(row);

const priceEl: HTMLSpanElement = document.createElement("span");
row.appendChild(priceEl);

const buyBtn: HTMLButtonElement = document.createElement("button");
buyBtn.textContent = "Hire Orchard Worker (+1/sec)";
buyBtn.style.padding = "8px 14px";
buyBtn.style.borderRadius = "10px";
buyBtn.style.cursor = "pointer";
buyBtn.style.border = "1px solid #cbd5e1";
row.appendChild(buyBtn);

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "k";
  const s = n.toFixed(2);
  return s.endsWith(".00") ? String(Math.round(n)) : s;
}

function currentPrice(): number {
  return UPGRADE_BASE_PRICE * Math.pow(UPGRADE_GROWTH, upgradesOwned);
}

function render(): void {
  applesEl.textContent = `🍎 ${formatNumber(apples)} apples`;
  rateEl.textContent = `+ ${formatNumber(applesPerSecond)} apples/sec`;
  ownedEl.textContent = `Workers: x${upgradesOwned}`;
  priceEl.textContent = `Cost: ${formatNumber(currentPrice())} apples`;
  buyBtn.disabled = apples + 1e-9 < currentPrice();
}

function clickApple(): void {
  apples += 1;
  render();
}
mainBtn.addEventListener("click", clickApple);

buyBtn.addEventListener("click", () => {
  const cost = currentPrice();
  if (apples + 1e-9 >= cost) {
    apples -= cost;
    upgradesOwned += 1;
    applesPerSecond += 1;
    render();
  }
});

let last: number = performance.now();
function loop(now: number): void {
  const dt: number = Math.max(0, now - last) / 1000;
  last = now;
  apples += applesPerSecond * dt;
  render();
  requestAnimationFrame(loop);
}

render();
requestAnimationFrame(loop);
