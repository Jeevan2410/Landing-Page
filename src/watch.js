// The 3D watch, built from primitives in Three.js: a rounded titanium case, glass, crown and button,
// two curved straps, and a screen drawn live on a canvas. Lit by a studio environment for reflections.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const SCREEN_W = 512;
const SCREEN_H = 616;

/** A strap: a long thin box bent backwards around an axis behind the case. `sign` 1 is the top strap. */
function strapGeometry(sign) {
  const length = 2.5;
  const radius = 1.25;
  const geometry = new THREE.BoxGeometry(1.18, length, 0.11, 1, 48, 1);
  geometry.translate(0, (sign * length) / 2, 0);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const s = position.getY(i);
    const z = position.getZ(i);
    const angle = s / radius;
    const r = radius + z;
    position.setY(i, r * Math.sin(angle));
    position.setZ(i, r * Math.cos(angle) - radius);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A thin rounded rectangle with softened edges. A rounded box can't do this: its corner radius is capped at half its thinnest side. */
function roundedSlab(width, height, radius, depth) {
  const shape = new THREE.Shape();
  shape.roundRect?.(-width / 2, -height / 2, width, height, radius);
  if (!shape.curves.length) {
    const x = -width / 2;
    const y = -height / 2;
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius);
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 3,
    curveSegments: 16,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function roundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.roundRect(x, y, w, h, r);
}

/** Everything drawn on the watch face. `mode` picks the screen; `t` is seconds, for animation. */
function drawScreen(context, mode, color, t, font) {
  const w = SCREEN_W;
  const h = SCREEN_H;
  context.clearRect(0, 0, w, h);
  context.save();
  roundRect(context, 0, 0, w, h, 110);
  context.clip();
  context.fillStyle = "#050608";
  context.fillRect(0, 0, w, h);
  context.textAlign = "center";
  context.textBaseline = "middle";

  const now = new Date();
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  if (mode === "rings") {
    const rings = [
      ["#ff3b6b", 0.86],
      ["#a6ff4d", 0.64],
      ["#3fd9ff", 0.92],
    ];
    const grow = Math.min(1, (t % 6) / 1.6);
    const ease = 1 - (1 - grow) ** 3;
    rings.forEach(([stroke, target], i) => {
      const radius = 190 - i * 58;
      context.lineWidth = 46;
      context.lineCap = "round";
      context.strokeStyle = `${stroke}33`;
      context.beginPath();
      context.arc(w / 2, h / 2 + 10, radius, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = stroke;
      context.beginPath();
      context.arc(w / 2, h / 2 + 10, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * target * ease);
      context.stroke();
    });
    context.fillStyle = "#fff";
    context.font = `600 34px ${font}`;
    context.fillText(time, w / 2, 46);
  } else if (mode === "battery") {
    const level = 0.92;
    context.lineWidth = 30;
    context.lineCap = "round";
    context.strokeStyle = "#ffffff1f";
    context.beginPath();
    context.arc(w / 2, h / 2 + 30, 190, Math.PI * 0.75, Math.PI * 2.25);
    context.stroke();
    const fill = Math.min(1, (t % 8) / 2);
    context.strokeStyle = "#5dff9b";
    context.beginPath();
    context.arc(w / 2, h / 2 + 30, 190, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * level * (1 - (1 - fill) ** 3));
    context.stroke();
    context.fillStyle = "#fff";
    context.font = `700 128px ${font}`;
    context.fillText("7", w / 2, h / 2 + 10);
    context.font = `500 40px ${font}`;
    context.fillStyle = "#9aa3ad";
    context.fillText("days left", w / 2, h / 2 + 100);
    context.font = `600 34px ${font}`;
    context.fillStyle = "#fff";
    context.fillText(time, w / 2, 46);
  } else if (mode === "color") {
    const glow = context.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.7);
    glow.addColorStop(0, color.accent);
    glow.addColorStop(1, "#050608");
    context.fillStyle = glow;
    context.globalAlpha = 0.55 + Math.sin(t * 1.5) * 0.1;
    context.fillRect(0, 0, w, h);
    context.globalAlpha = 1;
    context.save();
    context.translate(w / 2, h / 2);
    context.rotate(t * 0.15);
    context.strokeStyle = `${color.accent}aa`;
    context.lineWidth = 3;
    for (let i = 0; i < 24; i++) {
      context.rotate(Math.PI / 12);
      context.beginPath();
      context.moveTo(0, 150);
      context.lineTo(0, 210);
      context.stroke();
    }
    context.restore();
    context.fillStyle = "#fff";
    context.font = `700 104px ${font}`;
    context.fillText(time, w / 2, h / 2 - 6);
    context.font = `600 36px ${font}`;
    context.fillStyle = color.accent;
    context.fillText(color.name.toUpperCase(), w / 2, h / 2 + 84);
  } else {
    // Default: a calm time face with two complications.
    context.fillStyle = color.accent;
    context.font = `600 36px ${font}`;
    context.fillText(now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }).toUpperCase(), w / 2, 120);
    context.fillStyle = "#fff";
    context.font = `700 150px ${font}`;
    context.fillText(time, w / 2, h / 2 - 10);
    const beat = 1 + Math.max(0, Math.sin(t * 7.5)) ** 8 * 0.25;
    context.save();
    context.translate(w / 2 - 110, h - 130);
    context.scale(beat, beat);
    context.fillStyle = "#ff3b6b";
    context.font = `700 44px ${font}`;
    context.fillText("♥", 0, 0);
    context.restore();
    context.fillStyle = "#fff";
    context.font = `600 40px ${font}`;
    context.fillText("72", w / 2 - 40, h - 130);
    context.fillStyle = "#9aa3ad";
    context.font = `500 34px ${font}`;
    context.fillText("8,412 steps", w / 2 + 120, h - 130);
  }
  context.restore();
}

export function createWatch(canvas, { reduceMotion, font = "system-ui" }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 9.5);

  const key = new THREE.DirectionalLight("#ffffff", 1.6);
  key.position.set(3, 4, 6);
  const rim = new THREE.DirectionalLight("#9fc3ff", 1.2);
  rim.position.set(-5, 2, -4);
  scene.add(key, rim);

  // Materials whose colours change with the chosen finish.
  const caseMaterial = new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.28, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  const strapMaterial = new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 0.72, sheen: 0.3, sheenRoughness: 0.8, envMapIntensity: 0.45 });
  const glassMaterial = new THREE.MeshPhysicalMaterial({ color: "#030405", metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: "#0d0f12", roughness: 0.4, metalness: 0.3 });

  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = SCREEN_W;
  screenCanvas.height = SCREEN_H;
  const screenContext = screenCanvas.getContext("2d");
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.anisotropy = 4;

  const watch = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.62, 1.92, 0.44, 8, 0.36), caseMaterial);
  const glass = new THREE.Mesh(roundedSlab(1.46, 1.76, 0.3, 0.03), glassMaterial);
  glass.position.z = 0.205;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.33, 1.6),
    new THREE.MeshBasicMaterial({ map: screenTexture, transparent: true, toneMapped: false }),
  );
  screen.position.z = 0.238;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 40), caseMaterial);
  crown.rotation.z = Math.PI / 2;
  crown.position.set(0.86, 0.3, 0);
  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 12, 40), new THREE.MeshStandardMaterial({ color: "#ff6a3d" }));
  crownRing.rotation.y = Math.PI / 2;
  crownRing.position.set(0.945, 0.3, 0);
  const button = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.42, 0.16, 4, 0.03), caseMaterial);
  button.position.set(0.82, -0.32, 0);
  const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.06, 48), darkMaterial);
  sensor.rotation.x = Math.PI / 2;
  sensor.position.z = -0.24;
  const top = new THREE.Mesh(strapGeometry(1), strapMaterial);
  top.position.y = 0.82;
  const bottom = new THREE.Mesh(strapGeometry(-1), strapMaterial);
  bottom.position.y = -0.82;
  watch.add(body, glass, screen, crown, crownRing, button, sensor, top, bottom);
  scene.add(watch);

  const pose = { rotY: 0, rotX: 0, x: 0, y: 0, scale: 1 };
  const drag = { active: false, startX: 0, offset: 0, velocity: 0 };
  let pointer = { x: 0, y: 0 };
  let mode = "time";
  let colorTarget = null;
  let colorFrom = null;
  let colorStart = 0;
  let current = null;
  let visible = true;
  let frame = 0;
  let lastScreen = -1;

  function setColorNow(color) {
    caseMaterial.color.set(color.case);
    strapMaterial.color.set(color.strap);
    strapMaterial.sheenColor.set(color.strap).offsetHSL(0, 0, 0.12);
    crownRing.material.color.set(color.accent);
    current = color;
  }

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Keep the watch a sensible size on tall phone screens.
    camera.position.z = camera.aspect < 0.8 ? 12.5 : 9.5;
    camera.updateProjectionMatrix();
    render(performance.now());
  }

  function render(now) {
    const t = now / 1000;
    if (colorTarget) {
      const k = Math.min(1, (now - colorStart) / 700);
      const e = 1 - (1 - k) ** 3;
      caseMaterial.color.copy(colorFrom.case).lerp(new THREE.Color(colorTarget.case), e);
      strapMaterial.color.copy(colorFrom.strap).lerp(new THREE.Color(colorTarget.strap), e);
      if (k === 1) {
        setColorNow(colorTarget);
        colorTarget = null;
      }
    }
    if (!drag.active) {
      drag.velocity *= 0.92;
      drag.offset = drag.offset * 0.94 + drag.velocity;
    }
    const still = reduceMotion.matches;
    const floatY = still ? 0 : Math.sin(t * 0.9) * 0.05;
    const sway = still ? 0 : Math.sin(t * 0.6) * 0.04;
    watch.rotation.set(pose.rotX + pointer.y * 0.12, pose.rotY + sway + pointer.x * 0.18 + drag.offset, 0);
    watch.position.set(pose.x, pose.y + floatY, 0);
    watch.scale.setScalar(pose.scale);

    // Redraw the face about 20 times a second while it animates, once a second otherwise.
    const tick = Math.floor(t * (mode === "time" ? 8 : 20));
    if (tick !== lastScreen) {
      lastScreen = tick;
      drawScreen(screenContext, mode, current, still ? 99 : t, font);
      screenTexture.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }

  function loop(now) {
    render(now);
    frame = requestAnimationFrame(loop);
  }

  function start() {
    cancelAnimationFrame(frame);
    if (visible && !document.hidden && !reduceMotion.matches) frame = requestAnimationFrame(loop);
    else render(performance.now());
  }

  canvas.addEventListener("pointerdown", (event) => {
    drag.active = true;
    drag.startX = event.clientX;
    drag.base = drag.offset;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("grabbing");
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drag.active) return;
    const next = drag.base + (event.clientX - drag.startX) / 120;
    drag.velocity = (next - drag.offset) * 0.3;
    drag.offset = next;
    if (reduceMotion.matches) render(performance.now());
  });
  canvas.addEventListener("lostpointercapture", () => {
    drag.active = false;
    canvas.classList.remove("grabbing");
  });
  addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || reduceMotion.matches) return;
    pointer = { x: event.clientX / innerWidth - 0.5, y: event.clientY / innerHeight - 0.5 };
  });

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    start();
  }).observe(canvas);
  document.addEventListener("visibilitychange", start);
  reduceMotion.addEventListener("change", start);

  return {
    setPose(next) {
      Object.assign(pose, next);
      if (reduceMotion.matches) render(performance.now());
    },
    setScreen(next) {
      if (next === mode) return;
      mode = next;
      lastScreen = -1;
    },
    setColor(color, { instant = false } = {}) {
      if (!current || instant || reduceMotion.matches) {
        setColorNow(color);
        render(performance.now());
        return;
      }
      colorFrom = { case: caseMaterial.color.clone(), strap: strapMaterial.color.clone() };
      colorTarget = color;
      colorStart = performance.now();
      strapMaterial.sheenColor.set(color.strap).offsetHSL(0, 0, 0.12);
      crownRing.material.color.set(color.accent);
      current = { ...current, accent: color.accent, name: color.name };
      lastScreen = -1;
    },
    start,
  };
}
