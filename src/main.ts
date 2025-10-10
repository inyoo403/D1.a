import "./style.css";

let apples = 0;
let applesPerSecond = 0;
let upgradesOwned = 0;
const BASE_COST = 10;
const GROWTH_RATE = 1.15;

function currentCost() {
  return BASE_COST * Math.pow(GROWTH_RATE, upgradesOwned);
}

const app = document.createElement("div");
app.className = "app";
document.body.appendChild(app);

const title = document.createElement("h1");
title.textContent = "🍎 Apple Clicker";
app.appendChild(title);

const counter = document.createElement("p");
counter.className = "stats";
app.appendChild(counter);

const rateEl = document.createElement("p");
rateEl.className = "stats";
app.appendChild(rateEl);

const mainBtn = document.createElement("button");
mainBtn.className = "main-btn";
mainBtn.textContent = "🍎";
app.appendChild(mainBtn);

const upgradeTitle = document.createElement("h2");
upgradeTitle.className = "section-title";
upgradeTitle.textContent = "Orchard Upgrade";
app.appendChild(upgradeTitle);

const row = document.createElement("div");
row.className = "row";
app.appendChild(row);

const priceEl = document.createElement("span");
priceEl.className = "price";
row.appendChild(priceEl);

const buyBtn = document.createElement("button");
buyBtn.className = "buy-btn";
buyBtn.textContent = "Hire Orchard Worker (+1/sec)";
row.appendChild(buyBtn);

function render() {
  counter.textContent = `🍎 ${apples.toFixed(2)} apples`;
  rateEl.textContent = `+ ${applesPerSecond.toFixed(1)} apples/sec`;
  priceEl.textContent = `Cost: ${Math.floor(currentCost())} apples`;
  buyBtn.disabled = apples < currentCost();
}

mainBtn.addEventListener("click", () => {
  apples += 1;
  render();
});

buyBtn.addEventListener("click", () => {
  const cost = currentCost();
  if (apples >= cost) {
    apples -= cost;
    upgradesOwned += 1;
    applesPerSecond += 1;
    render();
  }
});

let last = performance.now();
function loop(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  apples += applesPerSecond * dt;
  render();
  requestAnimationFrame(loop);
}
render();
requestAnimationFrame(loop);
