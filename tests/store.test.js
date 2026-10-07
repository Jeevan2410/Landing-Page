import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_QTY,
  addToBag,
  bagCount,
  bagTotal,
  chapterAt,
  formatPrice,
  interpolate,
  parseBag,
  sectionProgress,
  setQty,
  unitPrice,
} from "../src/store.js";

test("prices include the larger size and format in rupees", () => {
  assert.equal(unitPrice("41"), 24900);
  assert.equal(unitPrice("45"), 26900);
  assert.equal(unitPrice("nonsense"), 24900);
  assert.equal(formatPrice(126900), "₹1,26,900");
});

test("the bag stacks the same watch and caps the quantity", () => {
  let bag = addToBag([], "ember", "45");
  bag = addToBag(bag, "ember", "45");
  bag = addToBag(bag, "glacier", "41");
  assert.equal(bag.length, 2);
  assert.equal(bag[0].qty, 2);
  assert.equal(bagCount(bag), 3);
  assert.equal(bagTotal(bag), 26900 * 2 + 24900);
  for (let i = 0; i < 10; i++) bag = addToBag(bag, "glacier", "41");
  assert.equal(bag[1].qty, MAX_QTY);
});

test("setQty changes or removes a line", () => {
  const bag = addToBag([], "sage", "41");
  assert.equal(setQty(bag, "sage:41", 3)[0].qty, 3);
  assert.deepEqual(setQty(bag, "sage:41", 0), []);
});

test("parseBag keeps only valid lines from storage", () => {
  const stored = JSON.stringify([
    { color: "midnight", size: "45", qty: 2 },
    { color: "gold-plated", size: "45", qty: 1 },
    { color: "sage", size: "99", qty: 1 },
    { color: "ember", size: "41", qty: -4 },
    { color: "glacier", size: "41", qty: 50 },
  ]);
  assert.deepEqual(parseBag(stored), [
    { key: "midnight:45", color: "midnight", size: "45", qty: 2 },
    { key: "glacier:41", color: "glacier", size: "41", qty: MAX_QTY },
  ]);
  assert.deepEqual(parseBag("{"), []);
  assert.deepEqual(parseBag(null), []);
});

test("sectionProgress runs from 0 to 1 while a tall section scrolls past", () => {
  assert.equal(sectionProgress(0, 4000, 800), 0);
  assert.equal(sectionProgress(-1600, 4000, 800), 0.5);
  assert.equal(sectionProgress(-5000, 4000, 800), 1);
  assert.equal(sectionProgress(-10, 500, 800), 0, "a section shorter than the screen never moves");
});

test("interpolate eases between keyframes and holds at the ends", () => {
  const frames = [
    { at: 0, x: 0, y: 10 },
    { at: 0.5, x: 10, y: 10 },
    { at: 1, x: 10, y: 0 },
  ];
  assert.deepEqual(interpolate(frames, -1), frames[0]);
  assert.equal(interpolate(frames, 0.25).x, 5, "halfway between stops is halfway in value");
  assert.ok(interpolate(frames, 0.1).x < 2, "eased: slow out of a stop");
  assert.equal(interpolate(frames, 0.75).y, 5);
  assert.deepEqual(interpolate(frames, 2), frames[2]);
});

test("chapterAt picks the nearest stop", () => {
  const frames = [{ at: 0 }, { at: 0.33 }, { at: 0.66 }, { at: 1 }];
  assert.equal(chapterAt(frames, 0.1), 0);
  assert.equal(chapterAt(frames, 0.4), 1);
  assert.equal(chapterAt(frames, 0.9), 3);
});
