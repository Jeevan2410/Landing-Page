// Pure logic for the page: the product, the bag, prices, and scroll keyframes. No DOM, no Three.js.

export const PRODUCT = {
  name: "Halcyon One",
  basePrice: 24900,
  colors: [
    { id: "midnight", name: "Midnight", case: "#2a2d34", strap: "#121317", accent: "#8ab4ff" },
    { id: "glacier", name: "Glacier", case: "#d7dce3", strap: "#a9bccf", accent: "#5aa9e6" },
    { id: "ember", name: "Ember", case: "#c79b74", strap: "#d9573a", accent: "#ffb26b" },
    { id: "sage", name: "Sage", case: "#9aa69a", strap: "#5e7d62", accent: "#b6e3a8" },
  ],
  sizes: [
    { id: "41", name: "41 mm", extra: 0 },
    { id: "45", name: "45 mm", extra: 2000 },
  ],
};

export const findColor = (id) => PRODUCT.colors.find((color) => color.id === id) ?? PRODUCT.colors[0];
export const findSize = (id) => PRODUCT.sizes.find((size) => size.id === id) ?? PRODUCT.sizes[0];

export const unitPrice = (sizeId) => PRODUCT.basePrice + findSize(sizeId).extra;

/** "₹24,900" with Indian digit grouping. */
export const formatPrice = (rupees) => `₹${rupees.toLocaleString("en-IN")}`;

/* ---------- bag ---------- */

export const MAX_QTY = 5;
const keyOf = (color, size) => `${color}:${size}`;

/** Add one watch; the same colour and size stack up to MAX_QTY. */
export function addToBag(bag, color, size) {
  const key = keyOf(color, size);
  const existing = bag.find((line) => line.key === key);
  if (existing) return bag.map((line) => (line.key === key ? { ...line, qty: Math.min(line.qty + 1, MAX_QTY) } : line));
  return [...bag, { key, color: findColor(color).id, size: findSize(size).id, qty: 1 }];
}

export function setQty(bag, key, qty) {
  if (qty <= 0) return bag.filter((line) => line.key !== key);
  return bag.map((line) => (line.key === key ? { ...line, qty: Math.min(qty, MAX_QTY) } : line));
}

export const bagCount = (bag) => bag.reduce((sum, line) => sum + line.qty, 0);
export const bagTotal = (bag) => bag.reduce((sum, line) => sum + unitPrice(line.size) * line.qty, 0);

/** A bag read back from storage, keeping only valid lines. */
export function parseBag(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const known = (list, id) => list.some((item) => item.id === id);
  return data
    .filter(
      (line) =>
        known(PRODUCT.colors, line?.color) && known(PRODUCT.sizes, line?.size) && Number.isInteger(line.qty) && line.qty > 0,
    )
    .map((line) => ({ key: keyOf(line.color, line.size), color: line.color, size: line.size, qty: Math.min(line.qty, MAX_QTY) }));
}

/* ---------- scroll story ---------- */

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/** How far through a tall section the viewport has scrolled, 0 at its top and 1 at its end. */
export function sectionProgress(top, height, viewport) {
  const travel = height - viewport;
  return travel > 0 ? clamp(-top / travel) : 0;
}

const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Blend between keyframes at progress t. Each keyframe is { at, ...numbers }; values in between are
 * eased so the model settles at each stop instead of moving at constant speed.
 */
export function interpolate(keyframes, t) {
  if (t <= keyframes[0].at) return { ...keyframes[0] };
  const last = keyframes[keyframes.length - 1];
  if (t >= last.at) return { ...last };
  const i = keyframes.findIndex((frame) => frame.at > t);
  const a = keyframes[i - 1];
  const b = keyframes[i];
  const k = smooth((t - a.at) / (b.at - a.at));
  const out = { at: t };
  for (const key of Object.keys(a)) if (key !== "at") out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}

/** Which story chapter is showing: the keyframe stop nearest to t. */
export const chapterAt = (keyframes, t) =>
  keyframes.reduce((best, frame, i) => (Math.abs(frame.at - t) < Math.abs(keyframes[best].at - t) ? i : best), 0);
