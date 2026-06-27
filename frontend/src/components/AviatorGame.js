import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = (process.env.REACT_APP_BACKEND_URL || '') + '/api';

function drawBackground(ctx, W, H, crashed) {
  // Base fill — near-black
  ctx.fillStyle = '#080810';
  ctx.fillRect(0, 0, W, H);

  // Radial glow in center (purple/violet like reference)
  const gCx = W * 0.42, gCy = H * 0.38;
  const gRad = Math.max(W, H) * 0.72;
  const purpleGlow = ctx.createRadialGradient(gCx, gCy, 0, gCx, gCy, gRad);
  purpleGlow.addColorStop(0,   crashed ? 'rgba(120,0,30,0.55)' : 'rgba(80,20,140,0.52)');
  purpleGlow.addColorStop(0.4, crashed ? 'rgba(80,0,20,0.28)' : 'rgba(50,10,100,0.25)');
  purpleGlow.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = purpleGlow;
  ctx.fillRect(0, 0, W, H);

  // Sunburst rays from bottom-left (like reference)
  const sx = W * 0.06, sy = H * 0.94;
  const rays = 32;
  const len = Math.sqrt(W * W + H * H) * 1.8;
  for (let i = 0; i < rays; i++) {
    const a1 = -Math.PI * 0.12 + (i / rays) * Math.PI * 1.55;
    const a2 = -Math.PI * 0.12 + ((i + 0.48) / rays) * Math.PI * 1.55;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a1) * len, sy + Math.sin(a1) * len);
    ctx.lineTo(sx + Math.cos(a2) * len, sy + Math.sin(a2) * len);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0)';
    ctx.fill();
  }
}

// Module-level plane image — starts loading immediately when script parses
const _planeImg = new Image();
_planeImg.src = '/static/plane.png';

function drawPlane(ctx, x, y, angle, crashed, scale = 1, canvasW = 720) {
  const loaded = _planeImg.complete && _planeImg.naturalWidth > 0;
  ctx.save();

  const iw = Math.max(80 * scale, canvasW * 0.18);
  const ih = loaded ? iw * (_planeImg.naturalHeight / _planeImg.naturalWidth) : iw * 0.46;

  const pull = iw * 0.55;
  ctx.translate(
    x - pull * Math.cos(angle),
    y - pull * Math.sin(angle)
  );
  ctx.rotate(angle);

  if (crashed) ctx.globalAlpha = 0.6;

  ctx.shadowColor = crashed ? '#ff0000' : '#ff4466';
  ctx.shadowBlur  = 16 * scale;

  if (loaded) {
    ctx.drawImage(_planeImg, -iw * 0.5, -ih * 0.5, iw, ih);
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

export default function AviatorGame({ user }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const reconnRef = useRef(null);
  const ptsRef = useRef([1.0]);
  const phaseRef = useRef('waiting');
  const multRef = useRef(1.0);
  const betRef = useRef(null);
  const frameRef = useRef(null);
  const canvasSizeRef = useRef({ w: 360, h: 240 });
  const planeImgRef = useRef(null);

  const [phase, setPhase] = useState('waiting');
  const [mult, setMult] = useState(1.0);
  const [countdown, setCountdown] = useState(7);
  const [history, setHistory] = useState([]);
  const [crashPt, setCrashPt] = useState(null);
  const [betAmt, setBetAmt] = useState('1.00');
  const [activeBet, setActiveBet] = useState(null);
  const [cashedOut, setCashedOut] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [balance, setBalance] = useState(user?.balance_usd || 0);
  const [betTab, setBetTab] = useState('bet');

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { multRef.current = mult; }, [mult]);
  useEffect(() => { betRef.current = activeBet; }, [activeBet]);

  // Load the custom plane image
  useEffect(() => {
    const img = new Image();
    img.src = '/plane.png';
    img.onload = () => { planeImgRef.current = img; };
  }, []);

  // Resize canvas to match container pixel size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        const canvas = canvasRef.current;
        if (canvas && width > 0 && height > 0) {
          canvas.width = Math.floor(width * dpr);
          canvas.height = Math.floor(height * dpr);
          canvasSizeRef.current = { w: canvas.width, h: canvas.height };
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const ph = phaseRef.current;
    const pts = ptsRef.current;

    const crashed = ph === 'crashed';
    drawBackground(ctx, W, H, crashed);

    const dpr = window.devicePixelRatio || 1;
    const PL = 44 * dpr, PR = 14 * dpr, PT = 14 * dpr, PB = 28 * dpr;
    const PW = W - PL - PR;
    const PH = H - PT - PB;
    const ox = PL, oy = H - PB;

    const axisMaxM = pts.length >= 2 ? Math.max(pts[pts.length - 1] * 1.18, 2.0) : 2.0;
    const cy0 = (m) => oy - Math.min((m - 1) / (axisMaxM - 1), 1) * PH;

    const fs = Math.max(8, Math.round(10 * dpr));
    ctx.font = `${fs}px monospace`;

    for (let i = 1; i <= 5; i++) {
      const m = 1 + (i / 5) * (axisMaxM - 1);
      const yy = cy0(m);
      ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(PL, yy); ctx.lineTo(W - PR, yy);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(PL - 6 * dpr, yy, 2 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,100,120,0.6)'; ctx.fill();
      ctx.fillStyle = 'rgba(150,150,170,0.6)';
      ctx.textAlign = 'right';
      ctx.fillText(`${m.toFixed(1)}x`, PL - 10 * dpr, yy + 3 * dpr);
    }
    for (let i = 0; i <= 8; i++) {
      const xx = ox + (i / 8) * PW;
      ctx.beginPath(); ctx.arc(xx, oy + 10 * dpr, 2 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,100,120,0.5)'; ctx.fill();
    }

    // Plane scale: base 1.0 at 720px wide, scale down proportionally
    const planeScale = Math.max(0.4, Math.min(1.0, (W / dpr) / 720));

    if (pts.length < 2) {
      drawPlane(ctx, ox + 10 * dpr, oy, 0, false, planeScale * dpr, W);
      return;
    }

    const maxM = axisMaxM;
    const cx = (i) => ox + (i / Math.max(pts.length - 1, 1)) * PW;
    const cy = (m) => oy - Math.min((m - 1) / (maxM - 1), 1) * PH;

    // ── Filled area under the curve (solid, like reference) ──
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    pts.forEach((m, i) => ctx.lineTo(cx(i), cy(m)));
    ctx.lineTo(cx(pts.length - 1), oy);
    ctx.closePath();

    const fillGrad = ctx.createLinearGradient(0, cy(pts[pts.length - 1]), 0, oy);
    fillGrad.addColorStop(0,   crashed ? 'rgba(180,0,40,0.92)' : 'rgba(160,0,35,0.88)');
    fillGrad.addColorStop(0.5, crashed ? 'rgba(140,0,30,0.82)' : 'rgba(120,0,28,0.78)');
    fillGrad.addColorStop(1,   crashed ? 'rgba(80,0,15,0.75)'  : 'rgba(60,0,12,0.72)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // ── Neon outer glow pass ──
    ctx.beginPath();
    pts.forEach((m, i) => {
      if (i === 0) ctx.moveTo(cx(i), cy(m));
      else ctx.lineTo(cx(i), cy(m));
    });
    ctx.strokeStyle = crashed ? 'rgba(255,0,34,0.55)' : 'rgba(255,0,54,0.55)';
    ctx.lineWidth = 12 * dpr;
    ctx.shadowColor = crashed ? '#ff0022' : '#ff0036';
    ctx.shadowBlur = 32;
    ctx.lineCap = 'round';
    ctx.stroke();

    // ── Neon mid glow pass ──
    ctx.beginPath();
    pts.forEach((m, i) => {
      if (i === 0) ctx.moveTo(cx(i), cy(m));
      else ctx.lineTo(cx(i), cy(m));
    });
    ctx.strokeStyle = crashed ? 'rgba(255,60,80,0.75)' : 'rgba(255,40,80,0.75)';
    ctx.lineWidth = 5 * dpr;
    ctx.shadowBlur = 16;
    ctx.stroke();

    // ── Bright core line ──
    ctx.beginPath();
    pts.forEach((m, i) => {
      if (i === 0) ctx.moveTo(cx(i), cy(m));
      else ctx.lineTo(cx(i), cy(m));
    });
    ctx.strokeStyle = crashed ? '#ff8888' : '#ffaaaa';
    ctx.lineWidth = 2 * dpr;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Neon spark dots along tip ──
    if (!crashed) {
      const tipCount = Math.min(12, pts.length);
      for (let i = pts.length - tipCount; i < pts.length; i++) {
        const t = (i - (pts.length - tipCount)) / tipCount;
        const alpha = t * 0.7;
        const r = (1.5 + t * 2) * dpr;
        ctx.beginPath();
        ctx.arc(cx(i), cy(pts[i]), r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,120,140,${alpha})`;
        ctx.shadowColor = '#ff2244';
        ctx.shadowBlur = 10;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    const lx = cx(pts.length - 1);
    const ly = cy(pts[pts.length - 1]);

    if (!crashed) {
      const refIdx = Math.max(0, pts.length - 6);
      const prevX = cx(refIdx);
      const prevY = cy(pts[refIdx]);
      const angle = Math.atan2(ly - prevY, lx - prevX);
      drawPlane(ctx, lx, ly, angle, false, planeScale * dpr, W);
    } else {
      drawPlane(ctx, lx, ly, Math.PI * 0.3, true, planeScale * dpr, W);
    }
  }, []);

  useEffect(() => {
    const loop = () => { draw(); frameRef.current = requestAnimationFrame(loop); };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  const connect = useCallback(() => {
    clearTimeout(reconnRef.current);
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/api/aviator/ws`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === 'waiting') {
        phaseRef.current = 'waiting';
        setPhase('waiting');
        setCountdown(d.countdown || 7);
        setMult(1.0); multRef.current = 1.0;
        setCrashPt(null);
        ptsRef.current = [1.0];
        if (d.history) setHistory(d.history.slice(0, 12));
        setActiveBet(null); betRef.current = null;
        setCashedOut(null); setErr('');
      } else if (d.type === 'flying') {
        phaseRef.current = 'flying';
        setPhase('flying');
        setMult(d.multiplier); multRef.current = d.multiplier;
        ptsRef.current = [...ptsRef.current, d.multiplier].slice(-500);
      } else if (d.type === 'crashed') {
        const cp = d.crash_point || d.multiplier || multRef.current || 1.0;
        phaseRef.current = 'crashed';
        setPhase('crashed');
        setCrashPt(cp);
        setMult(cp);
        if (ptsRef.current.length < 5) {
          const n = 70;
          ptsRef.current = Array.from({ length: n }, (_, i) => {
            const t = i / (n - 1);
            return 1.0 + (cp - 1.0) * Math.pow(t, 0.7);
          });
        } else {
          ptsRef.current = [...ptsRef.current, cp];
        }
        if (d.history) setHistory(d.history.slice(0, 12));
        if (betRef.current) {
          setErr(`✈ ${Number(cp).toFixed(2)}x da uchib ketdi`);
          setActiveBet(null); betRef.current = null;
        }
      }
    };

    ws.onclose = () => { reconnRef.current = setTimeout(connect, 2500); };
    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => { clearTimeout(reconnRef.current); wsRef.current?.close(); };
  }, [connect]);

  const placeBet = async () => {
    const amt = parseFloat(betAmt);
    if (!amt || amt < 1) { setErr('Min: 1.00 USD'); return; }
    if (phaseRef.current !== 'waiting') { setErr('Faqat kutish vaqtida tikish mumkin'); return; }
    if (betRef.current) { setErr('Allaqachon tikdingiz'); return; }
    setLoading(true); setErr('');
    try {
      await axios.post(`${API_URL}/aviator/bet`, { telegram_id: user.telegram_id, amount: amt, currency: 'USD' });
      setActiveBet({ amount: amt }); betRef.current = { amount: amt };
      setBalance(b => b - amt);
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Xatolik');
    } finally { setLoading(false); }
  };

  const cashOut = async () => {
    if (!betRef.current || cashedOut || phaseRef.current !== 'flying') return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/aviator/cashout`, { telegram_id: user.telegram_id });
      setCashedOut({ mult: res.data.multiplier, win: res.data.winnings });
      setActiveBet(null); betRef.current = null;
      setBalance(b => b + res.data.winnings);
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Xatolik');
    } finally { setLoading(false); }
  };

  const fmt = (m) => `${Number(m).toFixed(2)}x`;

  const multStyle = {
    fontFamily: "'Arial Black', 'Impact', sans-serif",
    fontWeight: 900,
    letterSpacing: '-1px',
  };

  const isCashoutActive = activeBet && phase === 'flying' && !cashedOut;
  const liveCash = ((activeBet?.amount || 0) * mult).toFixed(2);
  const canBet = !activeBet && phase === 'waiting';
  const inputDisabled = !!activeBet || phase === 'flying';

  const adjustAmt = (delta) => {
    const cur = parseFloat(betAmt) || 1;
    const next = Math.max(1, parseFloat((cur + delta).toFixed(2)));
    setBetAmt(next.toFixed(2));
  };

  return (
    <>
      <style>{`
        .av-root {
          display: flex;
          flex-direction: column;
          height: 100dvh;
          background: #1a1a2e;
          color: #fff;
          user-select: none;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .av-history {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          overflow-x: auto;
          flex-shrink: 0;
          background: #1a1a2e;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .av-history::-webkit-scrollbar { display: none; }
        .av-history-badge {
          flex-shrink: 0;
          padding: 3px 9px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.2px;
        }
        .av-hist-icon {
          margin-left: auto;
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13px;
          -webkit-tap-highlight-color: transparent;
        }
        .av-canvas-wrap {
          position: relative;
          flex: 1;
          overflow: hidden;
          min-height: 0;
        }
        .av-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
        .av-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .av-mult-text {
          font-size: clamp(42px, 14vw, 80px);
          color: #fff;
          text-shadow: 0 2px 32px rgba(0,0,0,0.95);
          font-weight: 900;
          letter-spacing: -2px;
        }
        .av-countdown-wrap {
          text-align: center;
        }
        .av-countdown-label {
          font-size: clamp(10px, 3vw, 13px);
          color: rgba(255,255,255,0.45);
          margin-bottom: 4px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .av-countdown-text {
          font-size: clamp(42px, 14vw, 72px);
          color: #fff;
          font-weight: 900;
          letter-spacing: -1px;
        }
        .av-crashed-label {
          font-size: clamp(11px, 3.5vw, 14px);
          font-weight: 800;
          color: #ff2244;
          margin-bottom: 4px;
          text-shadow: 0 0 20px #ff0030;
          letter-spacing: 1px;
        }
        .av-crashed-mult {
          font-size: clamp(42px, 13vw, 72px);
          color: #ff2244;
          text-shadow: 0 0 30px #ff0030;
          font-weight: 900;
          letter-spacing: -2px;
        }
        .av-bet-placed-badge {
          margin-top: 10px;
          padding: 5px 16px;
          border-radius: 20px;
          font-size: clamp(10px, 2.8vw, 12px);
          font-weight: 700;
          color: #44ff88;
          background: rgba(0,180,80,0.15);
          border: 1px solid rgba(0,200,80,0.3);
        }
        .av-feedback {
          flex-shrink: 0;
          margin: 0 10px 5px;
          padding: 6px 12px;
          border-radius: 8px;
          text-align: center;
          font-size: clamp(10px, 3vw, 12px);
          font-weight: 700;
        }
        .av-cashout-success { background: #006622; color: #aaffcc; }
        .av-err { color: #ff6677; background: rgba(180,0,30,0.25); border: 1px solid rgba(180,0,30,0.3); }

        /* ── Bottom Panel ── */
        .av-panel {
          flex-shrink: 0;
          background: #1e1e2e;
          border-top: 1px solid rgba(255,255,255,0.08);
          padding: 10px 12px 14px;
        }
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .av-panel { padding-bottom: max(14px, env(safe-area-inset-bottom)); }
        }

        /* Bet / Auto tabs */
        .av-tabs {
          display: flex;
          background: rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 3px;
          margin-bottom: 10px;
          width: fit-content;
        }
        .av-tab {
          padding: 5px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          background: transparent;
          color: rgba(255,255,255,0.4);
          -webkit-tap-highlight-color: transparent;
          transition: all 0.15s;
        }
        .av-tab.active {
          background: rgba(255,255,255,0.12);
          color: #fff;
        }

        /* Amount row */
        .av-amount-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .av-circle-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.2);
          background: transparent;
          color: rgba(255,255,255,0.7);
          font-size: 20px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: all 0.15s;
        }
        .av-circle-btn:disabled { opacity: 0.3; }
        .av-amount-display {
          flex: 1;
          text-align: center;
          font-size: clamp(18px, 5.5vw, 24px);
          font-weight: 900;
          color: #fff;
          letter-spacing: -0.5px;
        }

        /* Quick amounts */
        .av-quick-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin-bottom: 10px;
        }
        .av-quick-btn {
          padding: 6px 0;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.5);
        }
        .av-quick-btn.sel {
          background: rgba(255,255,255,0.13);
          color: #fff;
          border-color: rgba(255,255,255,0.22);
        }
        .av-quick-btn:disabled { opacity: 0.3; }

        /* BET / CASHOUT button */
        .av-bet-btn {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          font-weight: 900;
          font-size: clamp(15px, 4.5vw, 18px);
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          line-height: 1.2;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          letter-spacing: 0.5px;
        }
        .av-bet-btn-sub {
          font-size: clamp(10px, 3vw, 12px);
          font-weight: 700;
          opacity: 0.85;
          margin-top: 2px;
        }
      `}</style>

      <div className="av-root">

        {/* History bar */}
        <div className="av-history">
          {history.length === 0 && <span style={{ fontSize: '11px', color: '#444' }}>—</span>}
          {history.map((cp, i) => {
            let col, bg;
            if (cp < 2)       { col = 'rgba(255,255,255,0.75)'; bg = 'rgba(255,255,255,0.08)'; }
            else if (cp < 10) { col = '#c084fc'; bg = 'rgba(160,80,220,0.18)'; }
            else              { col = '#fb923c'; bg = 'rgba(220,100,30,0.18)'; }
            return (
              <span key={i} className="av-history-badge" style={{ color: col, background: bg }}>
                {fmt(cp)}
              </span>
            );
          })}
          <div className="av-hist-icon" onClick={() => navigate('/casino')}>🕐</div>
        </div>

        {/* Canvas */}
        <div className="av-canvas-wrap" ref={containerRef}>
          <canvas ref={canvasRef} className="av-canvas" />
          <div className="av-overlay">
            {phase === 'waiting' && (
              <div className="av-countdown-wrap">
                <div className="av-countdown-label">Yangi raund boshlangʼuncha</div>
                <div style={{ ...multStyle }} className="av-countdown-text">{countdown}s</div>
                {activeBet && (
                  <div className="av-bet-placed-badge">✓ ${activeBet.amount.toFixed(2)} tikildi</div>
                )}
              </div>
            )}
            {phase === 'flying' && (
              <div style={{ ...multStyle }} className="av-mult-text">{fmt(mult)}</div>
            )}
            {phase === 'crashed' && (
              <div style={{ textAlign: 'center' }}>
                <div className="av-crashed-label">✈ UCHIB KETDI!</div>
                <div style={{ ...multStyle }} className="av-crashed-mult">{fmt(crashPt || mult)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Feedback */}
        {cashedOut && (
          <div className="av-feedback av-cashout-success">
            ✅ {fmt(cashedOut.mult)} da yechdingiz! +${Number(cashedOut.win).toFixed(2)}
          </div>
        )}
        {err && !cashedOut && (
          <div className="av-feedback av-err">{err}</div>
        )}

        {/* Bet Panel */}
        <div className="av-panel">

          {/* Bet / Auto tabs */}
          <div className="av-tabs">
            <button className={`av-tab${betTab === 'bet' ? ' active' : ''}`}
              onClick={() => setBetTab('bet')}>Bet</button>
            <button className={`av-tab${betTab === 'auto' ? ' active' : ''}`}
              onClick={() => setBetTab('auto')}>Auto</button>
          </div>

          {/* Amount row: ⊖  1.00  ⊕ */}
          <div className="av-amount-row">
            <button className="av-circle-btn" disabled={inputDisabled}
              onClick={() => adjustAmt(-1)}>−</button>
            <div className="av-amount-display">{parseFloat(betAmt).toFixed(2)}</div>
            <button className="av-circle-btn" disabled={inputDisabled}
              onClick={() => adjustAmt(1)}>+</button>
          </div>

          {/* Quick amounts */}
          <div className="av-quick-grid">
            {[1, 2, 5, 10].map(v => {
              const sel = parseFloat(betAmt) === v;
              return (
                <button key={v}
                  disabled={inputDisabled}
                  onClick={() => setBetAmt(v.toFixed(2))}
                  className={`av-quick-btn${sel ? ' sel' : ''}`}>
                  {v}
                </button>
              );
            })}
          </div>

          {/* BET / CASHOUT button */}
          {isCashoutActive ? (
            <button onClick={cashOut} disabled={loading} className="av-bet-btn"
              style={{ background: '#22c55e', color: '#000', boxShadow: '0 0 24px rgba(34,197,94,0.4)' }}>
              <span>CASH OUT</span>
              <span className="av-bet-btn-sub">${liveCash} USD</span>
            </button>
          ) : (
            <button onClick={placeBet}
              disabled={loading || !!activeBet || phase !== 'waiting'}
              className="av-bet-btn"
              style={{
                background: activeBet ? '#14532d' : '#22c55e',
                color: activeBet ? '#4ade80' : '#000',
                opacity: (loading || (phase !== 'waiting' && !activeBet)) ? 0.45 : 1,
                boxShadow: (!activeBet && phase === 'waiting') ? '0 0 20px rgba(34,197,94,0.35)' : 'none',
              }}>
              {loading ? '...' : activeBet ? (
                <>✓ TIKILDI</>
              ) : (
                <>
                  <span>BET</span>
                  <span className="av-bet-btn-sub">{parseFloat(betAmt).toFixed(2)} USD</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
