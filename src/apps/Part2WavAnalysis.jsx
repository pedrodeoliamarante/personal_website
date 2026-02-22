import { useRef, useEffect, useState, useCallback } from 'react';

/* ═══ Canvas palette (duplicated from PcmApp — intentional) ═══ */
const BG = '#1a1a2e';
const WAVE_GREEN = '#39ff14';
const SAMPLE_RED = '#ff4444';
const GRID_DIM = 'rgba(255,255,255,0.08)';
const TXT = 'rgba(255,255,255,0.6)';

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

/* ═══ Setup canvas for HiDPI ═══ */
function setupCanvas(el) {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0) return null;
  const dpr = window.devicePixelRatio || 1;
  el.width = rect.width * dpr;
  el.height = rect.height * dpr;
  const ctx = el.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height };
}

/* ═══ Full waveform overview — min/max bucketing per pixel ═══ */
function drawOverview(ctx, w, h, samples) {
  clear(ctx, w, h);
  grid(ctx, w, h);

  const pad = { l: 6, r: 6, t: 4, b: 4 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const mid = pad.t + plotH / 2;

  const len = samples.length;
  const cols = Math.floor(plotW);
  if (cols < 1) return;

  ctx.fillStyle = WAVE_GREEN;

  for (let col = 0; col < cols; col++) {
    const startIdx = Math.floor((col / cols) * len);
    const endIdx = Math.floor(((col + 1) / cols) * len);
    let min = 1, max = -1;
    for (let j = startIdx; j < endIdx; j++) {
      const v = samples[j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (endIdx <= startIdx) {
      // Fewer samples than pixels — just use the one sample
      const v = samples[startIdx] || 0;
      min = max = v;
    }

    const yTop = mid - max * (plotH / 2) * 0.9;
    const yBot = mid - min * (plotH / 2) * 0.9;
    const barH = Math.max(1, yBot - yTop);
    ctx.fillRect(pad.l + col, yTop, 1, barH);
  }
}

/* ═══ Find the most "chaotic" region — highest sum of |derivative| ═══ */
function getZoomOffset(samples, sampleRate) {
  // Slide a window across the track, score each by sum of |sample[i] - sample[i-1]|.
  // High derivative sum = lots of rapid change = visually interesting waveform.
  const windowLen = Math.max(20, Math.round(sampleRate * 0.0007)); // same as zoom view
  const step = Math.floor(sampleRate * 0.05); // check every 50ms
  let bestOffset = Math.floor(samples.length / 2);
  let bestScore = 0;

  for (let start = 0; start + windowLen < samples.length; start += step) {
    let score = 0;
    for (let i = start + 1; i < start + windowLen; i++) {
      score += Math.abs(samples[i] - samples[i - 1]);
    }
    if (score > bestScore) {
      bestScore = score;
      bestOffset = start;
    }
  }
  return bestOffset;
}

/* ═══ Sinc interpolation — reconstruct analog signal from PCM samples ═══ */
function sinc(x) {
  if (x === 0) return 1;
  const px = Math.PI * x;
  return Math.sin(px) / px;
}

function reconstructAnalog(samples, offset, count, resolution) {
  // Whittaker-Shannon interpolation: sum of sample[n] * sinc(t - n)
  // Uses neighbors beyond the visible window for accuracy at edges
  const neighbors = 16; // samples on each side
  const points = [];
  for (let p = 0; p < resolution; p++) {
    const t = (p / (resolution - 1)) * (count - 1); // fractional sample index
    let v = 0;
    const lo = Math.max(0, Math.floor(t) - neighbors);
    const hi = Math.min(count - 1 + neighbors, samples.length - offset - 1);
    for (let n = lo; n <= hi; n++) {
      v += samples[offset + n] * sinc(t - n);
    }
    points.push(v);
  }
  return points;
}

/* ═══ Zoomed view — individual sample dots + reconstructed analog curve ═══ */
function drawZoomed(ctx, w, h, samples, sampleRate) {
  clear(ctx, w, h);
  grid(ctx, w, h);

  const pad = { l: 40, r: 10, t: 10, b: 18 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const mid = pad.t + plotH / 2;

  // Find the most chaotic region — highest sum of sample-to-sample change
  const offset = getZoomOffset(samples, sampleRate);

  // Target ~30 visible samples — wide spacing so wave shape is unmistakable
  const targetSamples = Math.min(samples.length - offset, Math.max(20, Math.round(sampleRate * 0.0007)));
  const visibleSamples = Math.min(targetSamples, samples.length - offset);
  const pxPerSample = plotW / (visibleSamples - 1);
  const offsetMs = ((offset / sampleRate) * 1000).toFixed(1);
  const spanMs = ((visibleSamples / sampleRate) * 1000).toFixed(2);

  // Reconstructed analog curve (sinc interpolation)
  const analogRes = Math.floor(plotW); // one point per pixel
  const analog = reconstructAnalog(samples, offset, visibleSamples, analogRes);
  ctx.strokeStyle = WAVE_GREEN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let p = 0; p < analogRes; p++) {
    const x = pad.l + (p / (analogRes - 1)) * plotW;
    const y = mid - analog[p] * (plotH / 2) * 0.9;
    p === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Axis labels
  ctx.font = '9px Tahoma';
  ctx.fillStyle = TXT;
  ctx.textAlign = 'left';
  ctx.fillText('Amplitude', 2, mid - plotH * 0.35);
  ctx.textAlign = 'center';
  const offsetSec = (offset / sampleRate).toFixed(2);
  ctx.fillText(`${spanMs} ms at ${offsetSec}s, ${visibleSamples} samples`, pad.l + plotW / 2, h - 2);

  // Time markers
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '8px Tahoma';
  ctx.textAlign = 'center';
  const marks = 5;
  for (let i = 0; i <= marks; i++) {
    const frac = i / marks;
    const x = pad.l + frac * plotW;
    const ms = ((offset + frac * visibleSamples) / sampleRate * 1000).toFixed(1);
    ctx.fillText(`${ms}ms`, x, h - pad.b + 12);
  }
}

const STAIR_CYAN = '#00ccff';
const ERROR_FILL = 'rgba(255,68,68,0.2)';

/* ═══ Draw sampling + quantization on the zoomed analog region ═══ */
function drawSampled(ctx, w, h, samples, origRate, userRate, bitDepth, zoomOffset, zoomCount) {
  clear(ctx, w, h);
  grid(ctx, w, h);

  const pad = { l: 40, r: 10, t: 10, b: 18 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const mid = pad.t + plotH / 2;
  const amp = (plotH / 2) * 0.9;

  const startSec = zoomOffset / origRate;
  const endSec = (zoomOffset + zoomCount) / origRate;
  const spanSec = endSec - startSec;

  // Dim analog curve
  const analogRes = Math.floor(plotW);
  const analog = reconstructAnalog(samples, zoomOffset, zoomCount, analogRes);
  ctx.strokeStyle = 'rgba(57,255,20,0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let p = 0; p < analogRes; p++) {
    const x = pad.l + (p / (analogRes - 1)) * plotW;
    const y = mid - analog[p] * amp;
    p === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Sample at userRate within this time window
  const levels = Math.pow(2, bitDepth);
  const samplePeriod = 1 / userRate;
  const firstSampleTime = Math.ceil(startSec / samplePeriod) * samplePeriod;

  const pts = [];
  for (let t = firstSampleTime; t < endSec; t += samplePeriod) {
    const frac = (t - startSec) / spanSec;
    const origIdx = Math.round(t * origRate);
    if (origIdx < 0 || origIdx >= samples.length) continue;
    const v = samples[origIdx];
    // Quantize
    const norm = (v + 1) / 2;
    const code = Math.min(levels - 1, Math.max(0, Math.round(norm * (levels - 1))));
    const q = (code / (levels - 1)) * 2 - 1;
    pts.push({ frac, v, q, code });
  }

  if (pts.length < 1) return;

  // Error shading
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i];
    const x1 = pad.l + p.frac * plotW;
    const x2 = pad.l + pts[i + 1].frac * plotW;
    const origY = mid - p.v * amp;
    const qY = mid - p.q * amp;
    ctx.fillStyle = ERROR_FILL;
    ctx.fillRect(x1, Math.min(origY, qY), x2 - x1, Math.abs(origY - qY) || 1);
  }

  // Staircase
  ctx.strokeStyle = STAIR_CYAN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const x = pad.l + p.frac * plotW;
    const y = mid - p.q * amp;
    const nextX = i < pts.length - 1
      ? pad.l + pts[i + 1].frac * plotW
      : pad.l + plotW;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    ctx.lineTo(nextX, y);
  }
  ctx.stroke();

  // Sample dots
  ctx.fillStyle = SAMPLE_RED;
  for (const p of pts) {
    const x = pad.l + p.frac * plotW;
    const y = mid - p.v * amp;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Labels
  ctx.font = '9px Tahoma';
  ctx.fillStyle = TXT;
  ctx.textAlign = 'center';
  ctx.fillText(
    `${pts.length} samples at ${userRate >= 1000 ? (userRate/1000)+'kHz' : userRate+'Hz'} · ${bitDepth}-bit (${levels} levels)`,
    pad.l + plotW / 2, h - 2
  );
}

/* ═══ Resample + quantize full track, play via Web Audio ═══ */
function playResampled(origSamples, origRate, userRate, bitDepth, startOffset = 0, onEnded) {
  const levels = Math.pow(2, bitDepth);
  const duration = origSamples.length / origRate;
  // Web Audio requires >= 8000 Hz
  const bufRate = Math.max(8000, userRate);
  const ratio = bufRate / userRate;
  const bufN = Math.floor(bufRate * duration);

  const audioCtx = new AudioContext();
  const buffer = audioCtx.createBuffer(1, bufN, bufRate);
  const ch = buffer.getChannelData(0);

  for (let i = 0; i < bufN; i++) {
    const userIdx = Math.floor(i / ratio);
    const origIdx = Math.min(origSamples.length - 1, Math.round((userIdx / userRate) * origRate));
    const v = origSamples[origIdx];
    const norm = (v + 1) / 2;
    const code = Math.min(levels - 1, Math.max(0, Math.round(norm * (levels - 1))));
    ch[i] = (code / (levels - 1)) * 2 - 1;
  }

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try { src.stop(); } catch {}
    try { audioCtx.close(); } catch {}
  };

  src.connect(audioCtx.destination);
  src.start(0, startOffset);
  const ctxStartTime = audioCtx.currentTime;

  const getPosition = () => {
    if (stopped) return startOffset;
    return startOffset + (audioCtx.currentTime - ctxStartTime);
  };

  src.onended = () => {
    const wasExplicit = stopped;
    stop();
    if (!wasExplicit && onEnded) onEnded();
  };

  return { stop, getPosition };
}

const DEMO_TRACKS = [
  { label: 'Chocolate Matter - Sweet Trip', url: '/assets/Chocolate Matter - Sweet Trip.flac' },
  { label: 'World Revolution - Malcolm Robinson', url: '/assets/World Revolution - Malcolm Robinson.flac' },
];

/* ═══ Decode audio ArrayBuffer to Float32Array ═══ */
async function decodeArrayBuffer(arrayBuffer) {
  const audioCtx = new AudioContext();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const samples = audioBuffer.getChannelData(0);
    return {
      samples,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
      length: audioBuffer.length,
    };
  } finally {
    audioCtx.close();
  }
}

async function decodeAudioFile(file) {
  return decodeArrayBuffer(await file.arrayBuffer());
}

async function decodeFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return decodeArrayBuffer(await res.arrayBuffer());
}

/* ═══ Format helpers ═══ */
function fmtDuration(sec) {
  if (sec < 1) return `${(sec * 1000).toFixed(0)} ms`;
  if (sec < 60) return `${sec.toFixed(2)} s`;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1);
  return `${m}m ${s}s`;
}

function fmtSamples(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

/* ═══ Part 2 Component ═══ */
export default function Part2WavAnalysis() {
  const [audioData, setAudioData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userRate, setUserRate] = useState(44100);
  const [bitDepth, setBitDepth] = useState(16);
  const [playing, setPlaying] = useState(false);
  const playbackRef = useRef(null);
  const overviewRef = useRef(null);
  const zoomedRef = useRef(null);
  const sampledRef = useRef(null);
  const fileInputRef = useRef(null);
  // Cache the zoom offset so all canvases share the same region
  const zoomOffsetRef = useRef(0);

  const drawCanvases = useCallback(() => {
    if (!audioData) return;
    const { samples, sampleRate } = audioData;

    const s1 = setupCanvas(overviewRef.current);
    if (s1) drawOverview(s1.ctx, s1.w, s1.h, samples);

    const zoomCount = Math.max(20, Math.round(sampleRate * 0.0007));
    zoomOffsetRef.current = getZoomOffset(samples, sampleRate);

    const s2 = setupCanvas(zoomedRef.current);
    if (s2) drawZoomed(s2.ctx, s2.w, s2.h, samples, sampleRate);

    const s3 = setupCanvas(sampledRef.current);
    if (s3) drawSampled(s3.ctx, s3.w, s3.h, samples, sampleRate, userRate, bitDepth, zoomOffsetRef.current, zoomCount);
  }, [audioData, userRate, bitDepth]);

  // Draw when audioData changes
  useEffect(() => { drawCanvases(); }, [drawCanvases]);

  // Redraw on resize
  useEffect(() => {
    if (!audioData) return;
    const h = () => drawCanvases();
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [audioData, drawCanvases]);

  // Redraw when canvas becomes visible
  useEffect(() => {
    const el = overviewRef.current;
    if (!el || !audioData) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) drawCanvases();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [audioData, drawCanvases]);

  // Restart playback from current position when params change mid-play
  useEffect(() => {
    if (!playbackRef.current) return;
    const pos = playbackRef.current.getPosition();
    playbackRef.current.stop();
    playbackRef.current = playResampled(
      audioData.samples, audioData.sampleRate, userRate, bitDepth, pos,
      () => { playbackRef.current = null; setPlaying(false); }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRate, bitDepth]);

  const loadAudio = async (promise) => {
    setLoading(true);
    setError(null);
    try {
      setAudioData(await promise);
    } catch {
      setError('Could not decode this file. Try a .wav or .mp3.');
      setAudioData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) loadAudio(decodeAudioFile(file));
  };

  const handleDemo = (url) => loadAudio(decodeFromUrl(url));

  const stopPlayback = () => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setPlaying(false);
  };

  const handlePlay = () => {
    if (!audioData) return;
    stopPlayback();
    playbackRef.current = playResampled(
      audioData.samples, audioData.sampleRate, userRate, bitDepth, 0,
      () => { playbackRef.current = null; setPlaying(false); }
    );
    setPlaying(true);
  };

  return (
    <div className="pcm-section pcm-part2">
      <div className="pcm-section-label">Part 2: Parameter Experimentation</div>
      <p className="pcm-desc">
        In Part 1 we saw how analog audio is converted to digital. Now let's see how
        the parameters we talked about, <strong>sample rate</strong> and{' '}
        <strong>bit depth</strong>, affect the quality of real audio.
      </p>
      <p className="pcm-desc">
        Use one of the demo tracks below, or upload your
        own .wav, .flac, .mp3, .ogg, or .aac file.
      </p>

      <div className="pcm-playback">
        {DEMO_TRACKS.map(t => (
          <button
            key={t.url}
            className="pcm-play-btn"
            onClick={() => handleDemo(t.url)}
            disabled={loading}
          >
            {loading ? 'Loading...' : t.label}
          </button>
        ))}
        <button
          className="pcm-play-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          {audioData ? 'Choose a different file' : 'Upload your own file'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.flac"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        {error && <span style={{ color: '#b00', fontSize: 12 }}>{error}</span>}
      </div>

      {audioData && (
        <>
          <div className="pcm-wav-meta">
            <span>{audioData.sampleRate.toLocaleString()} Hz</span>
            <span>{fmtDuration(audioData.duration)}</span>
            <span>{fmtSamples(audioData.length)} samples</span>
            <span>mono (ch 0)</span>
          </div>

          <div className="pcm-section">
            <p className="pcm-desc">
              Here we see the entire analog signal of the track, compressed to fit
              the canvas width. Each pixel column represents the amplitude range
              across that slice of time.
            </p>
            <canvas ref={overviewRef} className="pcm-canvas pcm-canvas-stage" />
          </div>

          <div className="pcm-section">
            <p className="pcm-desc">
              Let's zoom in more closely on the audio signal. Here is a snippet
              of the track. We have to zoom in because for reasonable audio quality
              we need at least 4,000 samples per second (4 kHz), which means one
              sample every 0.25 milliseconds. In Part 1 we used a reduced number
              of samples to illustrate the process, but here we're showing the
              actual number of samples the file contains.
            </p>
            <canvas ref={zoomedRef} className="pcm-canvas pcm-canvas-stage" />
          </div>

          <div className="pcm-section">
            <p className="pcm-desc">
              Now let's digitize this analog wave. Remember from Part 1 that
              sample rate is how many measurements we take per second, and bit
              depth is how many discrete levels each measurement can be rounded
              to. Adjust the sample rate and bit depth to see how they affect
              the captured signal.
            </p>
            <div className="pcm-params">
              <select className="pcm-param-select" value={userRate} onChange={e => setUserRate(Number(e.target.value))}>
                <option value={4000}>4 kHz</option>
                <option value={8000}>8 kHz</option>
                <option value={16000}>16 kHz</option>
                <option value={22050}>22.05 kHz</option>
                <option value={44100}>44.1 kHz</option>
              </select>
              <select className="pcm-param-select" value={bitDepth} onChange={e => setBitDepth(Number(e.target.value))}>
                <option value={2}>2-bit</option>
                <option value={4}>4-bit</option>
                <option value={8}>8-bit</option>
                <option value={16}>16-bit</option>
              </select>
            </div>
            <canvas ref={sampledRef} className="pcm-canvas pcm-canvas-stage" />
            <p className="pcm-desc">
              Feel free to play the audio and adjust the parameters as the track
              plays.
            </p>
            <div className="pcm-playback">
              {!playing ? (
                <button className="pcm-play-btn" onClick={handlePlay}>
                  Play
                </button>
              ) : (
                <button className="pcm-play-btn" onClick={stopPlayback}>
                  Stop
                </button>
              )}
            </div>
          </div>

          <p className="pcm-desc" style={{ marginTop: 12, fontStyle: 'italic' }}>
            Notice how sample rate and bit depth affect the quality of the audio
            in different ways. Why do you think each one changes the sound the
            way it does?
          </p>
        </>
      )}
    </div>
  );
}
