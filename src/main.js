import {
  PRODUCT,
  addToBag,
  bagCount,
  bagTotal,
  chapterAt,
  findColor,
  findSize,
  formatPrice,
  interpolate,
  parseBag,
  sectionProgress,
  setQty,
  unitPrice,
} from "./store.js";

const BAG_KEY = "halcyon:bag";
const $ = (selector, scope = document) => scope.querySelector(selector);
const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const narrow = matchMedia("(max-width: 820px)");

const state = {
  color: PRODUCT.colors[0].id,
  size: PRODUCT.sizes[0].id,
  bag: (() => {
    try {
      return parseBag(localStorage.getItem(BAG_KEY));
    } catch {
      return [];
    }
  })(),
};

function saveBag() {
  try {
    localStorage.setItem(BAG_KEY, JSON.stringify(state.bag.map(({ color, size, qty }) => ({ color, size, qty }))));
  } catch {
    // Storage blocked: the bag lasts for this visit.
  }
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "style") node.style.cssText = value;
    else if (key in node && !key.includes("-")) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

const announce = (message) => {
  $("#announce").textContent = message;
};

/* ---------- the 3D watch and the scroll story ---------- */

// Where the watch sits for each chapter. Wide screens alternate sides with the text; narrow screens keep
// it centred above the copy.
const WIDE = [
  { at: 0, rotY: -0.5, rotX: 0.12, x: 1.55, y: 0, scale: 1 },
  { at: 0.25, rotY: 0.2, rotX: -0.04, x: -1.5, y: 0, scale: 1.08 },
  { at: 0.5, rotY: -0.18, rotX: 0.06, x: 1.5, y: 0, scale: 1.14 },
  { at: 0.75, rotY: -1.25, rotX: 0.12, x: -1.35, y: 0, scale: 1.02 },
  { at: 1, rotY: 0.4, rotX: -0.06, x: 1.5, y: 0, scale: 1.06 },
];
const NARROW = WIDE.map((frame, i) => ({ ...frame, x: 0, y: i === 0 ? 2.05 : 1.5, scale: frame.scale * (i === 0 ? 0.66 : 0.82) }));
const SCREENS = ["time", "time", "rings", "battery", "color"];

let watch = null;
let chapter = -1;

function updateStory() {
  const story = $("#story");
  const box = story.getBoundingClientRect();
  const progress = sectionProgress(box.top, box.height, innerHeight);
  const frames = narrow.matches ? NARROW : WIDE;
  watch?.setPose(interpolate(frames, progress));
  const next = chapterAt(frames, progress);
  if (next !== chapter) {
    chapter = next;
    watch?.setScreen(SCREENS[next]);
    for (const node of document.querySelectorAll(".chapter")) node.classList.toggle("active", Number(node.dataset.chapter) === next);
    $(".stage").dataset.chapter = String(next);
  }
}

let ticking = false;
addEventListener(
  "scroll",
  () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      updateStory();
    });
  },
  { passive: true },
);
addEventListener("resize", updateStory);
narrow.addEventListener("change", updateStory);

async function loadWatch() {
  try {
    const { createWatch } = await import("./watch.js");
    await document.fonts?.ready;
    watch = createWatch($("#watch"), { reduceMotion, font: '"Sora", system-ui, sans-serif' });
    watch.setColor(findColor(state.color), { instant: true });
    chapter = -1;
    updateStory();
    watch.start();
    root.classList.add("has-3d");
  } catch (error) {
    // No WebGL, or the CDN couldn't be reached: the flat illustration stays.
    console.warn("3D watch unavailable:", error);
  }
}

/* ---------- finish and size ---------- */

function renderSwatches() {
  for (const group of document.querySelectorAll("[data-swatches]")) {
    group.replaceChildren(
      ...PRODUCT.colors.map((color) =>
        el(
          "button",
          {
            class: "swatch",
            type: "button",
            role: "radio",
            "aria-checked": String(color.id === state.color),
            "aria-label": color.name,
            "data-color": color.id,
            style: `--case:${color.case};--strap:${color.strap}`,
          },
          el("span", { "aria-hidden": "true" }),
        ),
      ),
    );
  }
}

function renderSizes() {
  $("#sizes").replaceChildren(
    ...PRODUCT.sizes.map((size) =>
      el(
        "button",
        { class: "size", type: "button", role: "radio", "aria-checked": String(size.id === state.size), "data-size": size.id },
        el("strong", {}, size.name),
        el("span", {}, size.extra ? `+${formatPrice(size.extra)}` : "Included"),
      ),
    ),
  );
}

let shownPrice = unitPrice(state.size);
function animatePrice(target) {
  const node = $("#price");
  const from = shownPrice;
  shownPrice = target;
  if (reduceMotion.matches || from === target) {
    node.textContent = formatPrice(target);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / 500, 1);
    node.textContent = formatPrice(Math.round(from + (target - from) * (1 - (1 - t) ** 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function applyChoice() {
  const color = findColor(state.color);
  root.style.setProperty("--case", color.case);
  root.style.setProperty("--strap", color.strap);
  root.style.setProperty("--accent-live", color.accent);
  $("#color-name").textContent = color.name;
  for (const swatch of document.querySelectorAll(".swatch")) swatch.setAttribute("aria-checked", String(swatch.dataset.color === state.color));
  for (const size of document.querySelectorAll(".size")) size.setAttribute("aria-checked", String(size.dataset.size === state.size));
  animatePrice(unitPrice(state.size));
  watch?.setColor(color);
}

document.addEventListener("click", (event) => {
  const swatch = event.target.closest(".swatch");
  if (swatch) {
    state.color = swatch.dataset.color;
    applyChoice();
    announce(`${findColor(state.color).name} finish`);
    return;
  }
  const size = event.target.closest(".size");
  if (size) {
    state.size = size.dataset.size;
    applyChoice();
  }
});

// Arrow keys move between options inside a radio group, as screen-reader users expect.
document.addEventListener("keydown", (event) => {
  const option = event.target.closest?.("[role='radio']");
  if (!option || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  const options = [...option.parentElement.querySelectorAll("[role='radio']")];
  const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const next = options[(options.indexOf(option) + step + options.length) % options.length];
  event.preventDefault();
  next.focus();
  next.click();
});

/* ---------- bag ---------- */

const bagDialog = $("#bag");

function renderBag() {
  const count = bagCount(state.bag);
  $("#bag-count").textContent = count ? String(count) : "";
  $("#bag-open").setAttribute("aria-label", `Open bag, ${count} ${count === 1 ? "item" : "items"}`);
  $("#bag-total").textContent = formatPrice(bagTotal(state.bag));
  $("#bag-empty").hidden = state.bag.length > 0;
  $("#bag-lines").replaceChildren(
    ...state.bag.map((line) => {
      const color = findColor(line.color);
      const size = findSize(line.size);
      const minus = el("button", { type: "button", "aria-label": `One fewer ${color.name} ${size.name}` }, "−");
      const plus = el("button", { type: "button", "aria-label": `One more ${color.name} ${size.name}` }, "+");
      minus.addEventListener("click", () => changeQty(line.key, line.qty - 1));
      plus.addEventListener("click", () => changeQty(line.key, line.qty + 1));
      return el(
        "li",
        {},
        el("span", { class: "line-swatch", style: `--case:${color.case};--strap:${color.strap}`, "aria-hidden": "true" }),
        el("div", {}, el("strong", {}, `${PRODUCT.name}`), el("span", {}, `${color.name} · ${size.name}`)),
        el("div", { class: "qty" }, minus, el("output", {}, String(line.qty)), plus),
        el("strong", { class: "line-price" }, formatPrice(unitPrice(line.size) * line.qty)),
      );
    }),
  );
}

function changeQty(key, qty) {
  state.bag = setQty(state.bag, key, qty);
  saveBag();
  renderBag();
}

/** A small dot arcs from the button to the bag, then the bag count pops. */
function flyToBag(from) {
  const start = from.getBoundingClientRect();
  const end = $("#bag-open").getBoundingClientRect();
  const dot = el("span", { class: "fly", "aria-hidden": "true" });
  document.body.append(dot);
  const x0 = start.left + start.width / 2;
  const y0 = start.top + start.height / 2;
  const dx = end.left + end.width / 2 - x0;
  const dy = end.top + end.height / 2 - y0;
  dot.style.left = `${x0}px`;
  dot.style.top = `${y0}px`;
  const animation = dot.animate(
    [
      { transform: "translate(-50%, -50%) scale(1)" },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 140}px)) scale(1.4)`, offset: 0.45 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.4)`, opacity: 0.6 },
    ],
    { duration: 750, easing: "cubic-bezier(0.5, 0, 0.3, 1)" },
  );
  return animation.finished.then(() => dot.remove());
}

$("#add").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  state.bag = addToBag(state.bag, state.color, state.size);
  saveBag();
  announce(`Added ${findColor(state.color).name} ${findSize(state.size).name} to your bag`);
  button.classList.add("added");
  setTimeout(() => button.classList.remove("added"), 1200);
  if (!reduceMotion.matches) await flyToBag(button);
  renderBag();
  const count = $("#bag-count");
  count.classList.remove("pop");
  void count.offsetWidth;
  count.classList.add("pop");
});

$("#bag-open").addEventListener("click", () => {
  renderBag();
  bagDialog.showModal();
});
$("#bag-close").addEventListener("click", () => bagDialog.close());
bagDialog.addEventListener("click", (event) => {
  if (event.target === bagDialog) bagDialog.close();
});

/* ---------- reveals, counters, header ---------- */

function countUp(node) {
  const target = Number(node.dataset.count);
  if (reduceMotion.matches) {
    node.textContent = target.toLocaleString("en-IN");
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / 1400, 1);
    node.textContent = Math.round(target * (1 - (1 - t) ** 4)).toLocaleString("en-IN");
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

if ("IntersectionObserver" in window && !reduceMotion.matches) {
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in");
        for (const num of entry.target.querySelectorAll("[data-count]")) countUp(num);
        reveal.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -12% 0px" },
  );
  for (const node of document.querySelectorAll(".reveal")) reveal.observe(node);
} else {
  for (const node of document.querySelectorAll(".reveal")) node.classList.add("in");
  for (const num of document.querySelectorAll("[data-count]")) countUp(num);
}

new IntersectionObserver(([entry]) => root.classList.toggle("scrolled", !entry.isIntersecting)).observe($("#top-sentinel"));

/* ---------- start ---------- */

renderSwatches();
renderSizes();
applyChoice();
renderBag();
updateStory();
$("#hero-price").textContent = formatPrice(PRODUCT.basePrice);
requestAnimationFrame(() => root.classList.add("ready"));
loadWatch();
