import { useRef, useEffect, useState, useCallback } from 'react';
import Part2WavAnalysis from './Part2WavAnalysis';

/* ═══ Constants ═══ */
const VIS_CYCLES = 2;       // cycles shown in the visual
const FREQ = 440;
const AUDIO_DURATION = 0.5;

/* ═══ Signal types ═══ */
// Proper modulo that always returns positive (JS % keeps sign of dividend)
function mod(n, m) { return ((n % m) + m) % m; }

const SIGNALS = {
  sine:     { label: 'Sine (440 Hz)',   vis: t => Math.sin(2 * Math.PI * VIS_CYCLES * t),
              audio: t => Math.sin(2 * Math.PI * FREQ * t) },
  square:   { label: 'Square (440 Hz)', vis: t => Math.sign(Math.sin(2 * Math.PI * VIS_CYCLES * t)) || 1,
              audio: t => Math.sign(Math.sin(2 * Math.PI * FREQ * t)) || 1 },
  sawtooth: { label: 'Sawtooth (440 Hz)', vis: t => 2 * mod(VIS_CYCLES * t, 1) - 1,
              audio: t => 2 * mod(FREQ * t, 1) - 1 },
  chord:    { label: 'Chord (A major)',
              vis: t => (Math.sin(2*Math.PI*VIS_CYCLES*t) + Math.sin(2*Math.PI*VIS_CYCLES*1.25*t) + Math.sin(2*Math.PI*VIS_CYCLES*1.5*t)) / 3,
              audio: t => (Math.sin(2*Math.PI*440*t) + Math.sin(2*Math.PI*550*t) + Math.sin(2*Math.PI*660*t)) / 3 },
};

// Canvas palette
const BG = '#1a1a2e';
const WAVE_GREEN = '#39ff14';
const SAMPLE_RED = '#ff4444';
const STAIR_CYAN = '#00ccff';
const ERROR_FILL = 'rgba(255,68,68,0.2)';
const GRID_DIM = 'rgba(255,255,255,0.08)';
const TXT = 'rgba(255,255,255,0.6)';

const STAGE_MS = 4000;

/* ═══ Data generation ═══ */
function genData(numSamples, bitDepth, signalFn) {
  const levels = Math.pow(2, bitDepth);
  // High-res curve for smooth drawing
  const analog = [];
  for (let i = 0; i <= 500; i++) {
    const t = i / 500;
    analog.push({ t, v: signalFn(t) });
  }
  // Discrete samples
  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples;
    samples.push({ i, t, v: signalFn(t) });
  }
  // Quantized
  const quantized = samples.map(s => {
    const norm = (s.v + 1) / 2;
    const code = Math.min(levels - 1, Math.max(0, Math.round(norm * (levels - 1))));
    const q = (code / (levels - 1)) * 2 - 1;
    return { ...s, q, code };
  });
  return { analog, samples, quantized };
}

/* ═══ Canvas helpers ═══ */
function clear(ctx, w, h) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
}

function grid(ctx, w, h) {
  ctx.strokeStyle = GRID_DIM;
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = (h / 4) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
}

function toxy(t, v, w, h) {
  return { x: t * w, y: h / 2 - v * (h / 2) * 0.82 };
}

/* ═══ Canvas rounded-rect helper ═══ */
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* ═══ Stage 1: Physical hardware ═══ */
function drawPhysical(ctx, w, h, progress, signalFn) {
  clear(ctx, w, h);

  const splitY = Math.floor(h * 0.85);
  const timePhase = progress * 3 * Math.PI;
  const topPad = 10;

  // ════════════════════════════════════════
  // 1. FACE / MOUTH (far left)
  // ════════════════════════════════════════
  const faceR = 96; // space reserved for face
  const faceCX = 48;
  const faceCY = (topPad + splitY - 14) / 2;
  const rampUp = Math.min(1, progress * 3);
  const headR = 38; // head radius

  // Mouth opening oscillates with the wave
  const mouthOpen = Math.sin(timePhase) * rampUp; // -1..1
  const mouthGap = 3 + Math.abs(mouthOpen) * 12;  // 3..15px

  // Head (side profile — circle)
  ctx.fillStyle = '#556';
  ctx.beginPath();
  ctx.arc(faceCX, faceCY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#778';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Eye (dot)
  ctx.fillStyle = '#bbc';
  ctx.beginPath();
  ctx.arc(faceCX + 8, faceCY - 10, 4, 0, Math.PI * 2);
  ctx.fill();

  // Nose (bump)
  ctx.strokeStyle = '#889';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(faceCX + 30, faceCY - 4);
  ctx.lineTo(faceCX + 36, faceCY + 2);
  ctx.lineTo(faceCX + 30, faceCY + 7);
  ctx.stroke();

  // Mouth (opens and closes)
  const mouthX = faceCX + 24;
  const mouthY = faceCY + 17;
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.ellipse(mouthX, mouthY, 9, mouthGap / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#889';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Sound arcs emanating from mouth — only when mouth is pushing air out
  if (rampUp > 0.2 && mouthOpen > 0.1) {
    const arcAlpha = mouthOpen * 0.4 * rampUp;
    ctx.strokeStyle = `rgba(57,255,20,${arcAlpha})`;
    ctx.lineWidth = 1;
    for (let a = 1; a <= 3; a++) {
      ctx.beginPath();
      ctx.arc(mouthX + 8, mouthY, 6 + a * 8, -0.7, 0.7);
      ctx.stroke();
    }
  }

  // ════════════════════════════════════════
  // 2. AIR PARTICLES — driven by the mouth
  // ════════════════════════════════════════
  const airL = faceR + 2;
  const airR = w * 0.63;
  const ROWS = 5, COLS = 30;
  const aT = topPad, aB = splitY - 14;
  const rowGap = (aB - aT) / (ROWS + 1);
  const colGap = (airR - airL) / (COLS + 1);
  const maxDisp = colGap * 0.42;

  for (let row = 0; row < ROWS; row++) {
    const by = aT + rowGap * (row + 1);
    for (let col = 0; col < COLS; col++) {
      const bx = airL + colGap * (col + 1);
      const cf = col / COLS;
      const env = Math.max(0, Math.min(1, (progress - cf * 0.7) * 4));

      // Wave propagates FROM the mouth (left→right):
      // delay increases with distance so the mouth is the source
      const spatialPhase = cf * VIS_CYCLES * 2 * Math.PI;
      const localPhase = timePhase - spatialPhase;

      // Amplitude decays with distance from mouth
      const distFade = 1 - cf * 0.4;
      const disp = maxDisp * env * distFade * Math.sin(localPhase);

      // Compression: positive = particles bunched, negative = spread apart
      const comp = Math.cos(localPhase) * env * distFade;

      // Bigger particles in compressed regions
      const radius = 2.5 + Math.max(0, comp) * 1.8;

      let pr, pg, pb;
      if (comp > 0) { pr = 255; pg = 170; pb = 60; }
      else          { pr = 80;  pg = 170; pb = 255; }
      const alpha = env * (0.3 + Math.abs(comp) * 0.55);

      ctx.fillStyle = `rgba(${pr},${pg},${pb},${alpha})`;
      ctx.beginPath();
      ctx.arc(bx + disp, by, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Compression / rarefaction labels
  if (progress > 0.3) {
    ctx.font = '8px Tahoma';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,170,60,0.7)';
    ctx.fillText('compressed', airL + (airR - airL) * 0.25, aB + 8);
    ctx.fillStyle = 'rgba(80,170,255,0.7)';
    ctx.fillText('rarefied', airL + (airR - airL) * 0.65, aB + 8);
  }

  // ── Arrow from air to mic ──
  const arrowX = airR + 4;
  const arrowY = (aT + aB) / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY - 5);
  ctx.lineTo(arrowX + 8, arrowY);
  ctx.lineTo(arrowX, arrowY + 5);
  ctx.closePath();
  ctx.fill();

  // ════════════════════════════════════════
  // 2. MICROPHONE — horizontal, grille faces left toward sound
  // ════════════════════════════════════════
  const micH = 64;
  const micX = airR + 16;
  const micTotalW = w - micX - 8;
  const micY = (aT + aB) / 2 - micH / 2;
  const micCY = micY + micH / 2;

  // Pressure for diaphragm deflection
  const micEnv = Math.max(0, Math.min(1, (progress - 0.5) * 4));
  const micPressure = Math.sin(VIS_CYCLES * 2 * Math.PI * 0.9 - timePhase) * micEnv;

  // "Microphone" title
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '9px Tahoma';
  ctx.textAlign = 'center';
  ctx.fillText('Microphone (cross-section)', micX + micTotalW / 2, micY - 4);

  // ── Outer housing (horizontal pill) ──
  ctx.fillStyle = '#3a3a4a';
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1.5;
  rrect(ctx, micX, micY, micTotalW, micH, micH / 2);
  ctx.fill();
  ctx.stroke();

  // ── Grille (left ~22%) — vertical mesh lines, faces the sound ──
  const grilleR = micX + micTotalW * 0.22;
  ctx.strokeStyle = '#5a5a6a';
  ctx.lineWidth = 0.8;
  const nMesh = 5;
  for (let i = 0; i < nMesh; i++) {
    const lx = micX + 12 + i * ((grilleR - micX - 12) / nMesh);
    ctx.beginPath();
    ctx.moveTo(lx, micY + 8);
    ctx.lineTo(lx, micY + micH - 8);
    ctx.stroke();
  }
  // Separator after grille
  ctx.strokeStyle = '#777';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(grilleR, micY + 3);
  ctx.lineTo(grilleR, micY + micH - 3);
  ctx.stroke();

  // ── Diaphragm (vertical membrane behind grille, deflects left/right) ──
  const dX = grilleR + 8;
  const dDeflect = micPressure * 5;
  ctx.strokeStyle = '#ccccdd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dX, micY + 6);
  ctx.quadraticCurveTo(dX + dDeflect, micCY, dX, micY + micH - 6);
  ctx.stroke();

  // ── Rod from diaphragm to coil (horizontal) ──
  const coilX = dX + 18;
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(dX + Math.abs(dDeflect), micCY);
  ctx.lineTo(coilX, micCY);
  ctx.stroke();

  // ── Coil (vertical ellipses, shifts slightly with diaphragm) ──
  const drift = dDeflect * 0.2;
  ctx.strokeStyle = '#cc9933';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const ex = coilX + 2 + i * 5.5 + drift;
    ctx.beginPath();
    ctx.ellipse(ex, micCY, 2.5, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── Permanent magnet (stationary, around coil) ──
  const magW2 = 26, magH2 = 34;
  const magX2 = coilX - 2;
  ctx.strokeStyle = '#883333';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(magX2, micCY - magH2 / 2, magW2, magH2);
  ctx.fillStyle = 'rgba(136,51,51,0.2)';
  ctx.fillRect(magX2, micCY - magH2 / 2, magW2, magH2);

  // ── Output wires with electrical signal ──
  const wireStartX = magX2 + magW2 + 6;
  const wireEndX = micX + micTotalW - 14;
  const wireLen = wireEndX - wireStartX;

  // Bottom reference wire (straight)
  ctx.strokeStyle = '#cc9933';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(wireStartX, micCY + 8);
  ctx.lineTo(wireEndX, micCY + 8);
  ctx.stroke();

  // Top wire carries the signal (sine wave along the wire)
  ctx.strokeStyle = WAVE_GREEN;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const wireAmp = 10 * micEnv; // amplitude grows as mic activates
  const wireSegs = 60;
  for (let i = 0; i <= wireSegs; i++) {
    const frac = i / wireSegs;
    const wx = wireStartX + frac * wireLen;
    // Signal travels left→right along the wire, synced to diaphragm
    const wy = micCY - 8 + wireAmp * signalFn(frac - progress);
    i === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
  }
  ctx.stroke();

  // Arrow at end
  ctx.fillStyle = WAVE_GREEN;
  ctx.beginPath();
  ctx.moveTo(wireEndX, micCY - 6);
  ctx.lineTo(wireEndX + 6, micCY);
  ctx.lineTo(wireEndX, micCY + 6);
  ctx.closePath();
  ctx.fill();

  // ── Component labels (below mic) ──
  const lblY = micY + micH + 10;
  ctx.font = '7px Tahoma';
  ctx.textAlign = 'center';

  ctx.fillStyle = 'rgba(200,200,220,0.55)';
  ctx.fillText('grille', (micX + grilleR) / 2, lblY);
  ctx.fillText('diaphragm', dX + 4, lblY);

  ctx.fillStyle = 'rgba(204,153,51,0.6)';
  ctx.fillText('coil', coilX + 10 , lblY);

  ctx.fillStyle = 'rgba(200,100,100,0.6)';
  ctx.fillText('magnet', magX2 + magW2 / 2, lblY + 9);

  ctx.fillStyle = 'rgba(204,153,51,0.6)';
  ctx.fillText('voltage out', (wireStartX + wireEndX) / 2 + 4, lblY);

  // ── Divider ──
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, splitY); ctx.lineTo(w, splitY); ctx.stroke();

  // ════════════════════════════════════════
  // 3. VOLTAGE WAVEFORM (bottom section)
  // ════════════════════════════════════════
  const gPadL = 40, gPadR = 10;
  const gTop = splitY + 4;
  const gH = h - splitY - 12;
  const gMid = gTop + gH / 2;

  // Axis
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(gPadL, gMid); ctx.lineTo(w - gPadR, gMid); ctx.stroke();

  // Axis labels
  ctx.font = '9px Tahoma';
  ctx.fillStyle = TXT;
  ctx.textAlign = 'left';
  ctx.fillText('Voltage', 2, gMid - gH * 0.3);
  ctx.textAlign = 'center';
  ctx.fillText('Time', (gPadL + w - gPadR) / 2, h - 1);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('Electrical signal from microphone', w - gPadR, gTop - 1);
  ctx.textAlign = 'left';

  // Draw wave up to progress
  const res = 300;
  const drawN = Math.floor(res * progress);
  if (drawN > 1) {
    ctx.strokeStyle = WAVE_GREEN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= drawN; i++) {
      const t = i / res;
      const v = signalFn(t);
      const x = gPadL + t * (w - gPadL - gPadR);
      const y = gMid - v * (gH / 2) * 0.82;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/* ═══ Label line helper (thin line from label to component) ═══ */
function drawLabelLine(ctx, fromX, fromY, toX, toY) {
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
}

/* ═══ Stage 2: Sampling ═══ */
function drawSampling(ctx, w, h, data, progress) {
  clear(ctx, w, h);
  grid(ctx, w, h);

  // Dim analog wave
  ctx.strokeStyle = 'rgba(57,255,20,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  data.analog.forEach((p, i) => {
    const { x, y } = toxy(p.t, p.v, w, h);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Sample dots one-by-one
  const count = Math.floor(data.samples.length * progress);
  for (let i = 0; i < count; i++) {
    const s = data.samples[i];
    const { x, y } = toxy(s.t, s.v, w, h);
    const baseY = h / 2;

    // Dashed vertical line
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255,68,68,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, y); ctx.stroke();
    ctx.setLineDash([]);

    // Red dot (larger for visibility)
    ctx.fillStyle = SAMPLE_RED;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Sample index label
    ctx.font = '9px monospace';
    ctx.fillStyle = TXT;
    ctx.textAlign = 'center';
    ctx.fillText(String(i), x, s.v >= 0 ? y - 8 : y + 12);
  }
}

/* ═══ Stage 3: Quantization ═══ */
function drawQuantized(ctx, w, h, data, progress) {
  clear(ctx, w, h);
  grid(ctx, w, h);

  // Quantization level hints
  const visLevels = 16;
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= visLevels; i++) {
    const v = (i / visLevels) * 2 - 1;
    const y = h / 2 - v * (h / 2) * 0.82;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Very dim original
  ctx.strokeStyle = 'rgba(57,255,20,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  data.analog.forEach((p, i) => {
    const { x, y } = toxy(p.t, p.v, w, h);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  const count = Math.floor(data.quantized.length * progress);
  if (count < 1) return;

  // Error shading
  for (let i = 0; i < count - 1; i++) {
    const q = data.quantized[i];
    const { x: x1 } = toxy(q.t, 0, w, h);
    const { x: x2 } = toxy(data.quantized[i + 1].t, 0, w, h);
    const origY = toxy(q.t, q.v, w, h).y;
    const qY = toxy(q.t, q.q, w, h).y;
    ctx.fillStyle = ERROR_FILL;
    ctx.fillRect(x1, Math.min(origY, qY), x2 - x1, Math.abs(origY - qY) || 1);
  }

  // Staircase
  ctx.strokeStyle = STAIR_CYAN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const q = data.quantized[i];
    const { x, y } = toxy(q.t, q.q, w, h);
    const nextX = i < count - 1
      ? toxy(data.quantized[i + 1].t, 0, w, h).x
      : w;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    ctx.lineTo(nextX, y);
  }
  ctx.stroke();

  // Code labels at each sample point
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i < count; i++) {
    const q = data.quantized[i];
    const { x, y } = toxy(q.t, q.q, w, h);
    // Dot
    ctx.fillStyle = STAIR_CYAN;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    // Value label — place above or below to avoid overlap with wave
    const above = q.q >= 0;
    const lblY = above ? y - 8 : y + 12;
    ctx.fillStyle = 'rgba(255,220,100,0.9)';
    ctx.fillText(String(q.code), x, lblY);
  }
}

/* ═══ PCM Buffer display ═══ */
function PcmBuffer({ quantized, progress, bitDepth }) {
  const count = Math.floor(quantized.length * progress);
  if (count === 0) return null;

  const hexDigits = Math.ceil(bitDepth / 4);
  return (
    <div className="pcm-buffer">
      <div className="pcm-buffer-header">
        <span className="pcm-buffer-label">PCM Buffer</span>
        <span className="pcm-buffer-meta">{count} samples &middot; {bitDepth}-bit unsigned &middot; mono</span>
      </div>
      <div className="pcm-buffer-hex">
        <div className="pcm-buffer-row">
          <span className="pcm-buffer-offset">0000</span>
          {quantized.slice(0, count).map((s, i) => (
            <span key={i} className="pcm-buffer-byte" title={`Sample ${i}: ${s.code} (${s.code.toString(2).padStart(bitDepth, '0')})`}>
              {s.code.toString(16).toUpperCase().padStart(hexDigits, '0')}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══ Data Table ═══ */
function DataTable({ quantized, samplingProg, quantProg, numSamples, bitDepth }) {
  const sampledN = Math.floor(numSamples * samplingProg);
  const quantN = Math.floor(numSamples * quantProg);
  const visN = Math.max(sampledN, quantN);

  if (visN === 0) return null;

  return (
    <div className="pcm-section">
      <div className="pcm-section-label">Sample Data</div>
      <div className="pcm-table-wrap">
        <table className="pcm-data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Analog</th>
              <th>Quantized</th>
              <th>Code</th>
              <th>Binary</th>
            </tr>
          </thead>
          <tbody>
            {quantized.slice(0, visN).map((s, i) => (
              <tr key={i} className={i === visN - 1 ? 'pcm-row-latest' : ''}>
                <td>{i}</td>
                <td>{i < sampledN ? s.v.toFixed(3) : ''}</td>
                <td className="pcm-td-cyan">{i < quantN ? s.q.toFixed(3) : ''}</td>
                <td className="pcm-td-cyan">{i < quantN ? s.code : ''}</td>
                <td className="pcm-td-mono">{i < quantN ? s.code.toString(2).padStart(bitDepth, '0') : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══ Audio playback ═══ */
function playTone(sampleRate, bitDepth, audioFn, loop) {
  const levels = Math.pow(2, bitDepth);
  // Web Audio API requires sample rate >= 8000; resample up if needed
  const bufRate = Math.max(8000, sampleRate);
  const ratio = bufRate / sampleRate;
  const srcN = Math.floor(sampleRate * AUDIO_DURATION);
  const bufN = Math.floor(bufRate * AUDIO_DURATION);

  const ctx = new AudioContext();
  const buffer = ctx.createBuffer(1, bufN, bufRate);
  const ch = buffer.getChannelData(0);
  for (let i = 0; i < bufN; i++) {
    // Map buffer index back to the source sample rate
    const srcIdx = Math.floor(i / ratio);
    const t = srcIdx / sampleRate;
    const v = audioFn(t);
    const norm = (v + 1) / 2;
    const code = Math.min(levels - 1, Math.max(0, Math.round(norm * (levels - 1))));
    ch[i] = (code / (levels - 1)) * 2 - 1;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = !!loop;

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try { src.stop(); } catch { /* already stopped */ }
    try { ctx.close(); } catch { /* already closed */ }
  };

  src.connect(ctx.destination);
  src.start();
  if (!loop) src.onended = stop;
  return stop;
}

/* ═══ Stage labels ═══ */
const STAGE_NAMES = [
  '1. Sound, Analog Signal',
  '2. Sampling',
  '3. Quantization',
  '4. Digital Output, PCM',
];

/* ═══ Main Component ═══ */
export default function PcmApp() {
  const refs = useRef([null, null, null]);
  const animId = useRef(null);
  const t0 = useRef(null);
  const progressRef = useRef([0, 0, 0, 0]);

  const [bitDepth, setBitDepth] = useState(8);
  const [sampleRate, setSampleRate] = useState(8000);
  const [signal, setSignal] = useState('sine');
  const [playing, setPlaying] = useState(false);
  const [currentPart, setCurrentPart] = useState(0);
  const stopRef = useRef(null);

  // Visual sample count derived from sample rate (scaled down for readability)
  const visSamples = Math.min(48, Math.round(sampleRate / 500));

  const data = useRef(genData(16, 8, SIGNALS.sine.vis));

  const [progress, setProgress] = useState([0, 0, 0, 0]);
  const [stage, setStage] = useState(-1);       // -1 = not started
  const [animating, setAnimating] = useState(false);

  const setupCanvas = useCallback((el) => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return null;
    const dpr = window.devicePixelRatio || 1;
    el.width = rect.width * dpr;
    el.height = rect.height * dpr;
    const ctx = el.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w: rect.width, h: rect.height };
  }, []);

  const draw = useCallback((prog) => {
    const d = data.current;
    const visFn = SIGNALS[signal].vis;
    for (let i = 0; i < 3; i++) {
      const s = setupCanvas(refs.current[i]);
      if (!s) continue;
      const { ctx, w, h } = s;
      switch (i) {
        case 0: drawPhysical(ctx, w, h, prog[0], visFn); break;
        case 1: drawSampling(ctx, w, h, d, prog[1]); break;
        case 2: drawQuantized(ctx, w, h, d, prog[2]); break;
      }
    }
  }, [setupCanvas, signal]);

  // Initial draw
  useEffect(() => { draw([0, 0, 0, 0]); }, [draw]);

  // Redraw when canvas becomes visible (e.g. restore from minimize)
  useEffect(() => {
    const el = refs.current[0];
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) draw(progressRef.current);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [draw]);

  // Resize
  useEffect(() => {
    const h = () => draw(progressRef.current);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [draw]);

  // Animate current stage
  useEffect(() => {
    if (!animating || stage < 0 || stage > 3) return;

    function tick(ts) {
      if (!t0.current) t0.current = ts;
      const elapsed = ts - t0.current;
      const p = Math.min(1, elapsed / STAGE_MS);

      const prog = [...progressRef.current];
      prog[stage] = p;
      progressRef.current = prog;
      setProgress([...prog]);
      draw(prog);

      if (p < 1) {
        animId.current = requestAnimationFrame(tick);
      } else {
        setAnimating(false);
      }
    }

    animId.current = requestAnimationFrame(tick);
    return () => { if (animId.current) cancelAnimationFrame(animId.current); };
  }, [animating, stage, draw]);

  const nextStep = () => {
    const next = stage + 1;
    if (next > 3) return;
    if (next === 0) data.current = genData(visSamples, bitDepth, SIGNALS[signal].vis);
    t0.current = null;
    setStage(next);
    setAnimating(true);
  };

  const stopPlayback = () => {
    if (stopRef.current) { stopRef.current(); stopRef.current = null; }
    setPlaying(false);
  };

  const reset = () => {
    stopPlayback();
    if (animId.current) cancelAnimationFrame(animId.current);
    data.current = genData(visSamples, bitDepth, SIGNALS[signal].vis);
    setStage(-1);
    setAnimating(false);
    setProgress([0, 0, 0, 0]);
    progressRef.current = [0, 0, 0, 0];
    t0.current = null;
    draw([0, 0, 0, 0]);
  };

  const skipAnimation = () => {
    if (!animating || stage < 0) return;
    if (animId.current) cancelAnimationFrame(animId.current);
    const prog = [...progressRef.current];
    prog[stage] = 1;
    progressRef.current = prog;
    setProgress([...prog]);
    draw(prog);
    setAnimating(false);
  };

  const stageComplete = stage >= 0 && !animating;
  const allDone = stage >= 3 && !animating;

  return (
    <div className="window-body pcm-body">
      <div className="pcm-scroll">
        {currentPart === 0 && (
          <div className="pcm-section">
            <div className="pcm-section-label">How Digital Audio Works</div>
            <p className="pcm-desc">
              This is an interactive deep dive into digital audio.
            </p>
            <div className="pcm-section-label" style={{ marginTop: 8 }}>Contents</div>
            <ul className="pcm-toc">
              <li><strong>Part 1: Analog to Digital</strong>, how sound waves become
                numbers through sampling and quantization</li>
              <li><strong>Part 2: Parameter Experimentation</strong>, load real audio
                and hear how sample rate and bit depth affect quality</li>
              <li className="pcm-toc-future">Part 3: Audio Compression (coming soon)</li>
              <li className="pcm-toc-future">Part 4: Spectral Analysis &amp; FFT (coming soon)</li>
              <li className="pcm-toc-future">Part 5: ...</li>
            </ul>
          </div>
        )}

        {currentPart === 1 && (
          <>
            <div className="pcm-section">
              <div className="pcm-section-label">Part 1: Analog to Digital</div>
              <p className="pcm-desc">
                How does sound become a sequence of numbers a computer can store?
                Walk through each step of the process below.
              </p>
            </div>

            <div className="pcm-controls">
              {!allDone && (
                <button className="pcm-run-btn" onClick={nextStep} disabled={animating}>
                  {stage < 0
                    ? 'Start'
                    : `Next: ${STAGE_NAMES[stage + 1]}`}
                </button>
              )}
              <button className="pcm-skip-btn" onClick={skipAnimation} disabled={!animating} title="Skip animation">
                Skip &#x23ED;
              </button>
              {stage >= 0 && (
                <button className="pcm-run-btn" onClick={reset}>
                  Reset
                </button>
              )}
              <div className="pcm-params">
                <select className="pcm-param-select" value={signal} onChange={e => setSignal(e.target.value)} disabled={stage >= 0}>
                  {Object.entries(SIGNALS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <select className="pcm-param-select" value={sampleRate} onChange={e => setSampleRate(Number(e.target.value))} disabled={stage >= 0}>
                  <option value={4000}>4 kHz</option>
                  <option value={8000}>8 kHz</option>
                  <option value={16000}>16 kHz</option>
                  <option value={44100}>44.1 kHz</option>
                </select>
                <select className="pcm-param-select" value={bitDepth} onChange={e => setBitDepth(Number(e.target.value))} disabled={stage >= 0}>
                  <option value={2}>2-bit</option>
                  <option value={4}>4-bit</option>
                  <option value={8}>8-bit</option>
                </select>
                <span>mono</span>
                {stage >= 0 && (
                  <span className="pcm-step-indicator">
                    Step {stage + 1}/4{animating ? ' ...' : ' done'}
                  </span>
                )}
              </div>
            </div>

            <div className="pcm-section">
              <div className="pcm-section-label">1. Sound, Analog Signal</div>
              <p className="pcm-desc">
                Sound is vibrations traveling through air. In the animation below, a
                person speaking opens and closes their mouth. When the mouth
                opens wide the vocal cords push air outward, squeezing nearby
                molecules together (compression, shown in orange).
                When the mouth closes, pressure drops and molecules spread apart
                (rarefaction, shown in blue). This pressure wave
                ripples outward from the speaker toward the microphone. Inside the
                mic, a thin diaphragm vibrates back and forth with the
                arriving pressure. That movement drives a coil through a magnetic
                field, generating a tiny electrical voltage, the
                continuous analog signal shown at the bottom of the canvas.
              </p>
              <canvas
                ref={el => { refs.current[0] = el; }}
                className="pcm-canvas pcm-canvas-physical"
              />
            </div>

            {stage >= 1 && (
              <div className="pcm-section">
                <div className="pcm-section-label">2. Sampling</div>
                <p className="pcm-desc">
                  The continuous voltage from the microphone changes every instant.
                  Sampling means measuring that voltage at evenly-spaced moments
                  in time. At {sampleRate.toLocaleString()} Hz we would
                  take {sampleRate.toLocaleString()} measurements per second. Here
                  we show <strong>{visSamples}</strong> samples for clarity. The
                  higher the sample rate, the more accurately we preserve the
                  original shape.
                </p>
                <canvas
                  ref={el => { refs.current[1] = el; }}
                  className="pcm-canvas pcm-canvas-stage"
                />
              </div>
            )}

            {stage >= 2 && (
              <div className="pcm-section">
                <div className="pcm-section-label">3. Quantization</div>
                <p className="pcm-desc">
                  A computer can only store discrete numbers. With {bitDepth}-bit
                  depth we can represent values
                  from 0 to {Math.pow(2, bitDepth) - 1}, just{' '}
                  <strong>{Math.pow(2, bitDepth)}</strong> possible levels. Each
                  sampled voltage must be converted to the nearest level and stored
                  as an integer code. The small difference between the original and
                  quantized value is the quantization error (shown in red).
                </p>
                <canvas
                  ref={el => { refs.current[2] = el; }}
                  className="pcm-canvas pcm-canvas-stage"
                />
              </div>
            )}

            {stage >= 2 && (
              <DataTable
                quantized={data.current.quantized}
                samplingProg={progress[1]}
                quantProg={progress[2]}
                numSamples={visSamples}
                bitDepth={bitDepth}
              />
            )}

            {stage >= 3 && (
              <div className="pcm-section">
                <div className="pcm-section-label">4. Digital Output, PCM</div>
                <p className="pcm-desc">
                  The sequence of integer codes is the PCM (Pulse-Code
                  Modulation) data, the standard format for uncompressed digital
                  audio (.wav files). Below is the raw data buffer: each sample is
                  stored as a {bitDepth}-bit unsigned integer (0
                  to {Math.pow(2, bitDepth) - 1}).{' '}
                  {Math.pow(2, bitDepth - 1)} means the speaker
                  is at rest (silence). {Math.pow(2, bitDepth) - 1} pushes
                  the speaker as far out as it can go,
                  0 pulls it as far in. The further a value is
                  from {Math.pow(2, bitDepth - 1)}, the louder the sound. To
                  play it back, a speaker outputs one sample
                  every 1/{sampleRate.toLocaleString()}th of a second.
                </p>
                <PcmBuffer quantized={data.current.quantized} progress={progress[3]} bitDepth={bitDepth} />
                {allDone && (
                  <div className="pcm-playback">
                    <button className="pcm-play-btn" onClick={() => {
                      stopPlayback();
                      stopRef.current = playTone(sampleRate, bitDepth, SIGNALS[signal].audio, false);
                    }}>
                      Play once
                    </button>
                    {!playing ? (
                      <button className="pcm-play-btn" onClick={() => {
                        stopPlayback();
                        stopRef.current = playTone(sampleRate, bitDepth, SIGNALS[signal].audio, true);
                        setPlaying(true);
                      }}>
                        Loop
                      </button>
                    ) : (
                      <button className="pcm-play-btn" onClick={stopPlayback}>
                        Stop
                      </button>
                    )}
                    <span className="pcm-playback-info">
                      {sampleRate >= 1000 ? `${sampleRate / 1000}kHz` : `${sampleRate}Hz`} / {bitDepth}-bit
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {allDone && (
          <div style={currentPart !== 2 ? { display: 'none' } : undefined}>
            <Part2WavAnalysis />
          </div>
        )}
      </div>

      <div className="pcm-nav">
        <button
          className={'pcm-nav-btn' + (currentPart === 0 ? ' pcm-nav-btn-active' : '')}
          onClick={() => setCurrentPart(0)}
        >
          Introduction
        </button>
        <button
          className={'pcm-nav-btn' + (currentPart === 1 ? ' pcm-nav-btn-active' : '')}
          onClick={() => setCurrentPart(1)}
        >
          Part 1
        </button>
        <button
          className={'pcm-nav-btn' + (currentPart === 2 ? ' pcm-nav-btn-active' : '')}
          onClick={() => setCurrentPart(2)}
          disabled={!allDone}
        >
          Part 2
        </button>
      </div>
    </div>
  );
}
