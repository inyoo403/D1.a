import "./style.css";

let apples = 0;
const applesPerSecond = 1;

const app = document.createElement("div");
app.className = "app";
document.body.appendChild(app);

const title = document.createElement("h1");
title.textContent = "🍎 Apple Clicker";
app.appendChild(title);

const counter = document.createElement("p");
counter.className = "stats";
counter.textContent = `🍎 ${apples}`;
app.appendChild(counter);

const mainBtn = document.createElement("button");
mainBtn.className = "main-btn";
mainBtn.textContent = "🍎";
app.appendChild(mainBtn);

mainBtn.addEventListener("click", () => {
  apples += 1;
  counter.textContent = `🍎 ${apples}`;
});

let last = performance.now();
function loop(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  apples += applesPerSecond * dt;
  counter.textContent = `🍎 ${apples.toFixed(1)}`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
