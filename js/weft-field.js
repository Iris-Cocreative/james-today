/* weft-field.js — ambient lattice background for james.today
 *
 * A hand-compiled port of the Weft "iso lattice + three-phase breath + cursor
 * bloom" graph. The exported Weft runtime re-interprets 53 graph nodes across
 * every lattice point every frame (~17ms of pure JS at 1440x900); this version
 * evaluates the same math directly and batches the circles into one stroked
 * path per colour bucket, which is what makes it cheap enough to leave running.
 *
 * Theme-aware (reads data-theme on <html>), pauses under prefers-reduced-motion,
 * and rAF already parks it when the tab is hidden.
 *
 *   <canvas data-weft></canvas>   + this script.
 *   Add ?tune=1 to the URL for a live tuning panel.
 */
(function () {
'use strict';

var TAU = Math.PI * 2;
var PHASE = TAU / 3;               /* the lattice's 3-colour classes are 120° apart */

var cfg = {
  spacing:     72,    /* lattice pitch (px). point count falls quadratically */
  speed:       0.5,   /* breath rate */
  fps:         18,    /* ambient motion does not need 60; the breath is slow */
  idleFps:     6,     /* once the cursor has been still for idleAfter seconds */
  idleAfter:   3,     /* seconds of no pointer movement before dropping to idleFps */
  rMin:        2.4,   /* radius at the trough of the breath */
  bloomNear:   32,    /* radius at the crest, under the cursor */
  bloomFar:    7,     /* radius at the crest, far from the cursor */
  bloomRadius: 320,   /* how far the cursor's influence reaches (px) */
  ripple:      0.024, /* distance -> phase, so the breath ripples outward */
  width:       1.1,   /* stroke width */
  alpha:       1,     /* global multiplier on the palette alphas */
  ease:        1.6,   /* cursor follow speed (lower = laggier) */
  buckets:     20,    /* colour quantisation — also the draw-call count per set */
  dprCap:      1      /* hairline circles at alpha 0.1 do not need a retina raster;
                         2 quadrupled the fill cost and dragged the whole machine */
};

/* Three sets, drawn at lattice-index offsets 0/1/2 so they interleave.
   Hues track the site tokens: copper #c4956a (h≈0.08), iris-teal #3ea691 (h≈0.47).
   h0/h1 are lerped by the breath; set C reads it counter-phase. */
var PALETTES = {
  dark: [
    { h0: 0.075, h1: 0.110, s: 0.42, l: 0.62, a: 0.10 },
    { h0: 0.060, h1: 0.090, s: 0.40, l: 0.28, a: 0.13 },
    { h0: 0.440, h1: 0.500, s: 0.38, l: 0.36, a: 0.10, counter: true }
  ],
  light: [
    { h0: 0.075, h1: 0.110, s: 0.45, l: 0.44, a: 0.10 },
    { h0: 0.060, h1: 0.090, s: 0.42, l: 0.30, a: 0.08 },
    { h0: 0.440, h1: 0.500, s: 0.40, l: 0.36, a: 0.09, counter: true }
  ]
};

var canvas = document.querySelector('canvas[data-weft]');
if (!canvas) return;
var g2 = canvas.getContext('2d');
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── lattice ── */
var n = 0, px, py, kk, rr, bk, ord, cnt;

function buildLattice(W, H) {
  var s = Math.max(8, cfg.spacing);
  var vs = s * 0.8660254037844386;                    /* √3/2 → equilateral rows */
  var nx = Math.min(1024, Math.floor(W / s) + 2);
  var ny = Math.min(1024, Math.floor(H / vs) + 2);
  n = Math.min(nx * ny, 20000);

  px = new Float32Array(n); py = new Float32Array(n); kk = new Uint8Array(n);
  rr = new Float32Array(n); bk = new Uint8Array(n); ord = new Int32Array(n);
  cnt = new Int32Array(cfg.buckets + 1);

  var x0 = -(nx - 1) * s / 2, y0 = -(ny - 1) * vs / 2, i = 0;
  for (var j = 0; j < ny && i < n; j++) {
    var dx = (j & 1) ? s / 4 : -s / 4;                /* half-stagger */
    for (var c = 0; c < nx && i < n; c++, i++) {
      px[i] = x0 + c * s + dx;
      py[i] = y0 + j * vs;
      /* 3-colouring of the iso lattice via axial coords — no two neighbours share
         a class, so wiring k into the phase gives the whole three-phase field. */
      kk[i] = (((c - (j >> 1) + 2 * j) % 3) + 3) % 3;
    }
  }
}

/* ── palette ── */
var pal = [];

function buildPalette() {
  var theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  var sets = PALETTES[theme];
  var B = cfg.buckets;
  pal = sets.map(function (p) {
    var out = new Array(B);
    for (var b = 0; b < B; b++) {
      var u = (b + 0.5) / B;
      var t = p.counter ? 1 - u : u;
      var h = (p.h0 + (p.h1 - p.h0) * t) * 360;
      var a = Math.max(0, Math.min(1, p.a * cfg.alpha));
      out[b] = 'hsla(' + h.toFixed(1) + ',' + (p.s * 100).toFixed(0) + '%,' +
               (p.l * 100).toFixed(0) + '%,' + a.toFixed(3) + ')';
    }
    return out;
  });
}

new MutationObserver(buildPalette).observe(document.documentElement, {
  attributes: true, attributeFilter: ['data-theme']
});

/* ── cursor ── */
var tx = 0, ty = -1e6, sx = 0, sy = -1e6, haveMouse = false;
var lastMove = -1e9;                                          /* idle detection */
window.addEventListener('pointermove', function (e) {
  var r = canvas.getBoundingClientRect();
  tx = e.clientX - r.left - r.width / 2;
  ty = e.clientY - r.top - r.height / 2;
  lastMove = performance.now();
  if (!haveMouse) { haveMouse = true; sx = tx; sy = ty; }   /* no swoop-in from infinity */
}, { passive: true });

/* An unfocused window (site open beside other work) holds its last frame.
   rAF only parks itself for hidden tabs, not for visible-but-inactive ones. */
var focused = document.hasFocus();
window.addEventListener('focus', function () { focused = true; });
window.addEventListener('blur', function () { focused = false; });

/* ── frame ── */
var W = 0, H = 0, dpr = 1, lastSpacing = -1, lastBuckets = -1;
var t0 = performance.now(), lastDraw = 0;
var msAvg = 0;

function resize() {
  var r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  var d = Math.min(cfg.dprCap, window.devicePixelRatio || 1);
  if (r.width !== W || r.height !== H || d !== dpr || cfg.spacing !== lastSpacing || cfg.buckets !== lastBuckets) {
    W = r.width; H = r.height; dpr = d;
    lastSpacing = cfg.spacing; lastBuckets = cfg.buckets;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    buildLattice(W, H);
    buildPalette();
  }
  return true;
}

function render(t, dt) {
  var mark = performance.now();

  sx += (tx - sx) * (1 - Math.exp(-cfg.ease * dt));
  sy += (ty - sy) * (1 - Math.exp(-cfg.ease * dt));

  var B = cfg.buckets, i, u;
  var invBloom = 1 / Math.max(1, cfg.bloomRadius);
  cnt.fill(0);

  for (i = 0; i < n; i++) {
    var ax = px[i] - sx, ay = py[i] - sy;
    var d = Math.sqrt(ax * ax + ay * ay);
    var td = d * invBloom; if (td > 1) td = 1;
    var crest = cfg.bloomNear + (cfg.bloomFar - cfg.bloomNear) * td;

    u = Math.sin(t + kk[i] * PHASE - d * cfg.ripple) * 0.5 + 0.5;   /* the breath */
    rr[i] = cfg.rMin + (crest - cfg.rMin) * u;

    var b = (u * B) | 0; if (b >= B) b = B - 1; else if (b < 0) b = 0;
    bk[i] = b; cnt[b + 1]++;
  }

  for (i = 0; i < B; i++) cnt[i + 1] += cnt[i];        /* counting sort into colour runs */
  var cur = new Int32Array(B);
  for (i = 0; i < n; i++) { var bb = bk[i]; ord[cnt[bb] + cur[bb]++] = i; }

  g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  g2.clearRect(0, 0, W, H);
  g2.translate(W / 2, H / 2);
  g2.lineWidth = cfg.width;

  /* one beginPath/stroke per (set, colour bucket) — 60 draw calls, not 3n */
  for (var set = 0; set < 3; set++) {
    var colors = pal[set];
    for (var b2 = 0; b2 < B; b2++) {
      var s0 = cnt[b2], s1 = cnt[b2 + 1];
      if (s1 <= s0) continue;
      g2.beginPath();
      var drew = false;
      for (var q = s0; q < s1; q++) {
        var src = ord[q];
        var r = rr[src];
        if (r < 0.4) continue;
        var dst = src + set; if (dst >= n) dst -= n;   /* the three sets are index-shifted */
        var cx = px[dst], cy = py[dst];
        g2.moveTo(cx + r, cy);
        g2.arc(cx, cy, r, 0, TAU);
        drew = true;
      }
      if (!drew) continue;
      g2.strokeStyle = colors[b2];
      g2.stroke();
    }
  }

  msAvg = msAvg * 0.9 + (performance.now() - mark) * 0.1;
}

function loop(now) {
  requestAnimationFrame(loop);
  if (!focused) return;                                 /* hold the frame, burn nothing */
  if (!resize()) return;
  var idle = now - lastMove > cfg.idleAfter * 1000;
  var fps = idle ? cfg.idleFps : cfg.fps;               /* the breath reads fine at 6fps */
  if (now - lastDraw < 1000 / fps - 1) return;          /* frame cap */
  var dt = Math.min(0.2, (now - lastDraw) / 1000);      /* cursor ease over the real gap */
  lastDraw = now;
  render((now - t0) / 1000 * cfg.speed, dt);
}

if (reduced) {
  /* one still frame, no loop */
  requestAnimationFrame(function () { if (resize()) render(0, 0); });
  window.addEventListener('resize', function () { if (resize()) render(0, 0); });
} else {
  requestAnimationFrame(loop);
}

window.WeftField = {
  cfg: cfg,
  ms: function () { return msAvg; },
  idle: function () { return performance.now() - lastMove > cfg.idleAfter * 1000; },
  sinceMove: function () { return (performance.now() - lastMove) / 1000; },
  refresh: function () { lastSpacing = -1; buildPalette(); }
};

/* ── optional tuning panel (?tune=1) ── */
if (/[?&]tune=1/.test(location.search)) {
  var FIELDS = [
    ['spacing', 24, 140, 1], ['speed', 0, 2, 0.01], ['fps', 10, 60, 1],
    ['rMin', 0, 12, 0.1], ['bloomNear', 4, 70, 1], ['bloomFar', 2, 30, 0.5],
    ['bloomRadius', 60, 900, 10], ['ripple', 0, 0.08, 0.001],
    ['width', 0.4, 3, 0.1], ['alpha', 0.2, 3, 0.05], ['ease', 0.3, 12, 0.1],
    ['buckets', 4, 48, 1]
  ];
  var panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:200;width:230px;' +
    'padding:12px 14px;border-radius:10px;background:rgba(12,11,16,0.92);' +
    'border:1px solid rgba(196,149,106,0.28);backdrop-filter:blur(10px);' +
    'font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e8e4dc;';
  var stat = document.createElement('div');
  stat.style.cssText = 'margin-bottom:8px;color:#c4956a;letter-spacing:0.06em;';
  panel.appendChild(stat);
  FIELDS.forEach(function (f) {
    var row = document.createElement('label');
    row.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:2px 6px;margin:5px 0;';
    var name = document.createElement('span'); name.textContent = f[0];
    var val = document.createElement('span'); val.textContent = cfg[f[0]]; val.style.color = '#a8a39b';
    var input = document.createElement('input');
    input.type = 'range'; input.min = f[1]; input.max = f[2]; input.step = f[3];
    input.value = cfg[f[0]];
    input.style.cssText = 'grid-column:1/3;width:100%;accent-color:#c4956a;';
    input.addEventListener('input', function () {
      cfg[f[0]] = parseFloat(input.value);
      val.textContent = input.value;
      if (f[0] === 'alpha') buildPalette();
    });
    row.append(name, val, input);
    panel.appendChild(row);
  });
  var dump = document.createElement('button');
  dump.textContent = 'copy config';
  dump.style.cssText = 'margin-top:8px;width:100%;padding:5px;border-radius:6px;cursor:pointer;' +
    'background:transparent;border:1px solid rgba(196,149,106,0.4);color:#c4956a;font:inherit;';
  dump.onclick = function () {
    navigator.clipboard.writeText(JSON.stringify(cfg, null, 2));
    dump.textContent = 'copied ✓';
    setTimeout(function () { dump.textContent = 'copy config'; }, 1200);
  };
  panel.appendChild(dump);
  document.body.appendChild(panel);
  setInterval(function () {
    stat.textContent = n + ' pts · ' + msAvg.toFixed(1) + ' ms/frame';
  }, 400);
}
})();
