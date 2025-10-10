import "./style.css";

const app = document.createElement("div");
app.className = "app";
document.body.appendChild(app);

const title = document.createElement("h1");
title.textContent = "🍎 Apple Clicker";
app.appendChild(title);

const mainBtn = document.createElement("button");
mainBtn.className = "main-btn";
mainBtn.textContent = "🍎";
app.appendChild(mainBtn);

mainBtn.addEventListener("click", () => {
  console.log("Button clicked!");
});
