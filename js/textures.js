// Procedural textures drawn on canvases: no image files, all original.
import * as THREE from "../vendor/three.module.min.js";

const cache = new Map();
function make(key, size, draw, repeat = [1, 1]) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.repeat.set(...repeat);
  cache.set(key, t);
  return t;
}

const shade = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return "#" + c.getHexString(); };
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export function woodFloor(color) {
  return make("wood" + color, 512, (g, n) => {
    const r = rng(7), rows = 8, h = n / rows;
    for (let i = 0; i < rows; i++) {
      let x = -r() * n;
      while (x < n) {
        const w = n * (0.45 + r() * 0.5);
        g.fillStyle = shade(color, (r() - 0.5) * 0.08);
        g.fillRect(x, i * h, w, h);
        g.strokeStyle = shade(color, -0.12); g.lineWidth = 2; g.strokeRect(x, i * h, w, h);
        g.globalAlpha = 0.18;
        for (let k = 0; k < 6; k++) { g.strokeStyle = shade(color, -0.1 + r() * 0.05); g.beginPath();
          const y = i * h + r() * h; g.moveTo(x, y); g.bezierCurveTo(x + w / 3, y + (r() - 0.5) * 6, x + 2 * w / 3, y + (r() - 0.5) * 6, x + w, y); g.stroke(); }
        g.globalAlpha = 1;
        x += w;
      }
    }
  });
}

export function tileFloor(color) {
  return make("tile" + color, 256, (g, n) => {
    const r = rng(3), k = 4, s = n / k;
    g.fillStyle = shade(color, -0.15); g.fillRect(0, 0, n, n);
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
      g.fillStyle = shade(color, (r() - 0.5) * 0.04 + ((i + j) % 2 ? 0.02 : 0));
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      const gr = g.createLinearGradient(i * s, j * s, i * s + s, j * s + s);
      gr.addColorStop(0, "rgba(255,255,255,.12)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
  });
}

export function carpet(color) {
  return make("carpet" + color, 256, (g, n) => {
    g.fillStyle = color; g.fillRect(0, 0, n, n);
    const img = g.getImageData(0, 0, n, n), d = img.data, r = rng(11);
    for (let i = 0; i < d.length; i += 4) { const v = (r() - 0.5) * 22; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
    g.putImageData(img, 0, 0);
  });
}

export function wallpaper(color) {
  return make("wall" + color, 256, (g, n) => {
    g.fillStyle = color; g.fillRect(0, 0, n, n);
    g.fillStyle = shade(color, -0.035);
    for (let x = 0; x < n; x += 32) g.fillRect(x, 0, 12, n);
    g.fillStyle = shade(color, 0.03);
    for (let x = 16; x < n; x += 64) for (let y = 16; y < n; y += 48) { g.beginPath(); g.arc(x + ((y / 48) % 2) * 32, y, 3, 0, Math.PI * 2); g.fill(); }
  });
}

export function siding(color) {
  return make("siding" + color, 128, (g, n) => {
    g.fillStyle = color; g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += 16) { g.fillStyle = shade(color, -0.08); g.fillRect(0, y + 13, n, 3); g.fillStyle = shade(color, 0.04); g.fillRect(0, y, n, 2); }
  });
}

export function grass() {
  return make("grass", 256, (g, n) => {
    g.fillStyle = "#6fa65a"; g.fillRect(0, 0, n, n);
    const r = rng(5);
    for (let i = 0; i < 2600; i++) { g.fillStyle = shade("#6fa65a", (r() - 0.5) * 0.14); const x = r() * n, y = r() * n; g.fillRect(x, y, 2, 3 + r() * 4); }
  }, [24, 24]);
}

export function stone() {
  return make("stone", 128, (g, n) => {
    g.fillStyle = "#cdbfa6"; g.fillRect(0, 0, n, n);
    const r = rng(9);
    for (let i = 0; i < 900; i++) { g.fillStyle = shade("#cdbfa6", (r() - 0.5) * 0.12); g.fillRect(r() * n, r() * n, 2, 2); }
  });
}

export function sky() {
  return make("sky", 256, (g, n) => {
    const gr = g.createLinearGradient(0, 0, 0, n);
    gr.addColorStop(0, "#7fb6e8"); gr.addColorStop(0.6, "#bfe0f5"); gr.addColorStop(1, "#eaf4ea");
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
  });
}

// Which floor style each room uses (by room name).
export const FLOOR_STYLE = { "Kitchen": "tile", "Living room": "wood", "Bathroom": "tile", "Main bedroom": "carpet", "Kids' room": "carpet", "Den": "wood" };
export function floorTexture(style, color) {
  return style === "tile" ? tileFloor(color) : style === "carpet" ? carpet(color) : woodFloor(color);
}
