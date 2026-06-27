import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = (process.env.REACT_APP_BACKEND_URL || '') + '/api';

function drawSunburst(ctx, W, H) {
  const cx = W * 0.08, cy = H * 0.92;
  const rays = 28;
  const len = Math.sqrt(W * W + H * H) * 1.6;
  for (let i = 0; i < rays; i++) {
    const a1 = -Math.PI * 0.1 + (i / rays) * Math.PI * 1.6;
    const a2 = -Math.PI * 0.1 + ((i + 0.5) / rays) * Math.PI * 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a1) * len, cy + Math.sin(a1) * len);
    ctx.lineTo(cx + Math.cos(a2) * len, cy + Math.sin(a2) * len);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0)';
    ctx.fill();
  }
}

let _planeImg = null;
let _planeImgLoaded = false;
function getPlaneImage() {
  if (_planeImg) return _planeImg;
  _planeImg = new Image();
  _planeImg.onload = () => { _planeImgLoaded = true; };
  _planeImg.src = '/neon_plane.png';
  return _planeImg;
}

function drawPlane(ctx, x, y, angle, crashed, scale = 1) {
  const img = getPlaneImage();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle - 0.1);

  const iw = 160 * scale;
  const ih = iw * (img.naturalHeight / (img.naturalWidth || 160));

  if (_planeImgLoaded) {
    // Outer glow pass
    ctx.shadowColor = crashed ? '#ff0022' : '#ff2244';
    ctx.shadowBlur = 32 * scale;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(img, -iw * 0.6, -ih * 0.5, iw, ih);
    // Second pass for stronger glow
    ctx.shadowBlur = 16 * scale;
    ctx.drawImage(img, -iw * 0.6, -ih * 0.5, iw, ih);
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
  } else {
    // Fallback: simple neon shape while image loads
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = crashed ? '#ff0022' : '#ff3355';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(60 * scale, 0);
    ctx.lineTo(-50 * scale, -8 * scale);
    ctx.lineTo(-60 * scale, 0);
    ctx.lineTo(-50 * scale, 8 * scale);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
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

  const [phase, setPhase] = useState('waiting');
  const [mult, setMult] = useState(1.0);
  const [countdown, setCountdown] = useState(7);
  const [history, setHistory] = useState([]);
  const [crashPt, setCrashPt] = useState(null);
  const [betAmt, setBetAmt] = useState('10000');
  const [activeBet, setActiveBet] = useState(null);
  const [cashedOut, setCashedOut] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [balance, setBalance] = useState(user?.balance_uzs || 0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { multRef.current = mult; }, [mult]);
  useEffect(() => { betRef.current = activeBet; }, [activeBet]);

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

    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, W, H);

    drawSunburst(ctx, W, H);

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
      drawPlane(ctx, ox + 10 * dpr, oy, 0, false, planeScale * dpr);
      return;
    }

    const maxM = axisMaxM;
    const cx = (i) => ox + (i / Math.max(pts.length - 1, 1)) * PW;
    const cy = (m) => oy - Math.min((m - 1) / (maxM - 1), 1) * PH;
    const crashed = ph === 'crashed';

    ctx.beginPath();
    ctx.moveTo(ox, oy);
    pts.forEach((m, i) => ctx.lineTo(cx(i), cy(m)));
    ctx.lineTo(cx(pts.length - 1), oy);
    ctx.closePath();

    const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
    fillGrad.addColorStop(0, crashed ? 'rgba(160,0,40,0.7)' : 'rgba(140,0,35,0.65)');
    fillGrad.addColorStop(1, crashed ? 'rgba(80,0,20,0.2)' : 'rgba(60,0,15,0.2)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // ── Neon outer glow pass ──
    ctx.beginPath();
    pts.forEach((m, i) => {
      if (i === 0) ctx.moveTo(cx(i), cy(m));
      else ctx.lineTo(cx(i), cy(m));
    });
    ctx.strokeStyle = crashed ? 'rgba(255,0,34,0.5)' : 'rgba(255,0,54,0.5)';
    ctx.lineWidth = 10 * dpr;
    ctx.shadowColor = crashed ? '#ff0022' : '#ff0036';
    ctx.shadowBlur = 28;
    ctx.lineCap = 'round';
    ctx.stroke();

    // ── Neon mid glow pass ──
    ctx.beginPath();
    pts.forEach((m, i) => {
      if (i === 0) ctx.moveTo(cx(i), cy(m));
      else ctx.lineTo(cx(i), cy(m));
    });
    ctx.strokeStyle = crashed ? 'rgba(255,60,80,0.7)' : 'rgba(255,40,80,0.7)';
    ctx.lineWidth = 4 * dpr;
    ctx.shadowBlur = 14;
    ctx.stroke();

    // ── Bright core line ──
    ctx.beginPath();
    pts.forEach((m, i) => {
      if (i === 0) ctx.moveTo(cx(i), cy(m));
      else ctx.lineTo(cx(i), cy(m));
    });
    ctx.strokeStyle = crashed ? '#ff6677' : '#ff8899';
    ctx.lineWidth = 1.5 * dpr;
    ctx.shadowBlur = 6;
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
      drawPlane(ctx, lx, ly, angle, false, planeScale * dpr);
    } else {
      drawPlane(ctx, lx, ly, Math.PI * 0.3, true, planeScale * dpr);
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
    if (!amt || amt < 1000) { setErr('Min: 1,000 UZS'); return; }
    if (phaseRef.current !== 'waiting') { setErr('Faqat kutish vaqtida tikish mumkin'); return; }
    if (betRef.current) { setErr('Allaqachon tikdingiz'); return; }
    setLoading(true); setErr('');
    try {
      await axios.post(`${API_URL}/aviator/bet`, { telegram_id: user.telegram_id, amount: amt });
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
  const liveCash = Math.floor((activeBet?.amount || 0) * mult);
  const canBet = !activeBet && phase === 'waiting';
  const inputDisabled = !!activeBet || phase === 'flying';

  return (
    <>
      <style>{`
        .av-root {
          display: flex;
          flex-direction: column;
          height: 100dvh;
          background: #0c0c0c;
          color: #fff;
          user-select: none;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .av-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: #131313;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
          min-height: 44px;
        }
        .av-back-btn {
          color: #666;
          font-size: 13px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 8px;
          -webkit-tap-highlight-color: transparent;
        }
        .av-title {
          display: flex;
          align-items: center;
          gap: 5px;
          font-weight: 900;
          letter-spacing: 3px;
          font-size: 13px;
          color: #ff1a3a;
        }
        .av-balance {
          font-size: 11px;
          color: #d4af37;
          font-weight: 700;
          white-space: nowrap;
        }
        .av-history {
          display: flex;
          gap: 5px;
          padding: 5px 10px;
          overflow-x: auto;
          flex-shrink: 0;
          background: #131313;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .av-history::-webkit-scrollbar { display: none; }
        .av-history-badge {
          flex-shrink: 0;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 800;
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
          font-size: clamp(36px, 12vw, 72px);
          color: #fff;
          text-shadow: 0 2px 24px rgba(0,0,0,0.9);
        }
        .av-countdown-text {
          font-size: clamp(40px, 14vw, 68px);
          color: #fff;
        }
        .av-crashed-label {
          font-size: clamp(11px, 3.5vw, 14px);
          font-weight: 800;
          color: #ff2244;
          margin-bottom: 4px;
          text-shadow: 0 0 20px #ff0030;
        }
        .av-crashed-mult {
          font-size: clamp(34px, 11vw, 64px);
          color: #ff2244;
          text-shadow: 0 0 30px #ff0030;
        }
        .av-waiting-label {
          font-size: clamp(10px, 3vw, 13px);
          color: #555;
          margin-bottom: 4px;
        }
        .av-bet-placed-badge {
          margin-top: 8px;
          padding: 5px 14px;
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
        .av-cashout-success {
          background: #006622;
          color: #aaffcc;
        }
        .av-err {
          color: #ff6677;
          background: rgba(180,0,30,0.25);
          border: 1px solid rgba(180,0,30,0.3);
        }
        .av-panel {
          flex-shrink: 0;
          padding: 8px 10px 16px;
          background: #131313;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        /* safe area padding for iPhone home indicator */
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .av-panel {
            padding-bottom: max(16px, env(safe-area-inset-bottom));
          }
        }
        .av-quick-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 5px;
          margin-bottom: 7px;
        }
        .av-quick-btn {
          padding: 7px 0;
          border-radius: 7px;
          font-size: clamp(10px, 2.8vw, 12px);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .av-input-row {
          display: flex;
          gap: 7px;
          align-items: stretch;
        }
        .av-input-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          background: #1c1c1c;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          overflow: hidden;
          min-width: 0;
        }
        .av-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-weight: 700;
          font-size: clamp(12px, 3.5vw, 14px);
          padding: 11px 8px;
          min-width: 0;
          width: 100%;
          -webkit-appearance: none;
        }
        .av-input::-webkit-outer-spin-button,
        .av-input::-webkit-inner-spin-button { -webkit-appearance: none; }
        .av-input[type=number] { -moz-appearance: textfield; }
        .av-halve-col {
          display: flex;
          flex-direction: column;
          border-left: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .av-halve-btn {
          background: none;
          border: none;
          color: #666;
          font-size: 10px;
          padding: 5px 9px;
          cursor: pointer;
          font-weight: 700;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .av-halve-btn:last-child {
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .av-action-btn {
          flex: 1;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          font-weight: 900;
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          line-height: 1.2;
          min-width: 100px;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .av-action-btn-label {
          font-size: clamp(13px, 4vw, 16px);
        }
        .av-action-btn-sub {
          font-size: clamp(9px, 2.5vw, 11px);
          font-weight: 700;
          margin-top: 2px;
          opacity: 0.85;
        }

        @media (max-width: 380px) {
          .av-quick-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 4px;
          }
          .av-panel {
            padding: 6px 8px 14px;
          }
          .av-action-btn {
            min-width: 80px;
          }
        }
      `}</style>

      <div className="av-root">
        {/* Header */}
        <div className="av-header">
          <button className="av-back-btn" onClick={() => navigate('/casino')}>← Orqaga</button>
          <div className="av-title">✈ AVIATOR</div>
          <div className="av-balance">{Number(balance).toLocaleString()} UZS</div>
        </div>

        {/* History */}
        <div className="av-history">
          {history.length === 0 && <span style={{ fontSize: '11px', color: '#333' }}>Tarix yo'q</span>}
          {history.map((cp, i) => {
            const col = cp < 2 ? '#ff2244' : cp < 5 ? '#ffaa00' : '#00cc55';
            const bg = cp < 2 ? 'rgba(255,0,40,0.15)' : cp < 5 ? 'rgba(255,170,0,0.15)' : 'rgba(0,180,60,0.15)';
            return (
              <span key={i} className="av-history-badge"
                style={{ color: col, background: bg, border: `1px solid ${col}44` }}>
                {fmt(cp)}
              </span>
            );
          })}
        </div>

        {/* Canvas */}
        <div className="av-canvas-wrap" ref={containerRef}>
          <canvas ref={canvasRef} className="av-canvas" />

          <div className="av-overlay">
            {phase === 'waiting' && (
              <div style={{ textAlign: 'center' }}>
                <div className="av-waiting-label">Yangi raund boshlangʼuncha</div>
                <div style={{ ...multStyle }} className="av-countdown-text">{countdown}s</div>
                {activeBet && (
                  <div className="av-bet-placed-badge">✓ {activeBet.amount.toLocaleString()} UZS tikildi</div>
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
            ✅ {fmt(cashedOut.mult)} da yechdingiz! +{Number(cashedOut.win).toLocaleString()} UZS
          </div>
        )}
        {err && !cashedOut && (
          <div className="av-feedback av-err">{err}</div>
        )}

        {/* Bet Panel */}
        <div className="av-panel">
          <div className="av-quick-grid">
            {[5000, 10000, 25000, 50000].map(v => {
              const selected = betAmt === String(v);
              return (
                <button key={v}
                  disabled={inputDisabled}
                  onClick={() => setBetAmt(String(v))}
                  className="av-quick-btn"
                  style={{
                    background: selected ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                    color: selected ? '#fff' : '#666',
                    border: selected ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.06)',
                    opacity: inputDisabled ? 0.3 : 1,
                  }}>
                  {v >= 1000 ? `${v / 1000}K` : v}
                </button>
              );
            })}
          </div>

          <div className="av-input-row">
            <div className="av-input-wrap">
              <input
                type="number"
                value={betAmt}
                onChange={e => setBetAmt(e.target.value)}
                disabled={inputDisabled}
                className="av-input"
                placeholder="Stavka (UZS)"
                style={{ opacity: inputDisabled ? 0.4 : 1 }}
              />
              <div className="av-halve-col">
                <button disabled={inputDisabled} className="av-halve-btn"
                  onClick={() => setBetAmt(v => String(Math.round(parseFloat(v || 0) * 2)))}>×2</button>
                <button disabled={inputDisabled} className="av-halve-btn"
                  onClick={() => setBetAmt(v => String(Math.max(1000, Math.round(parseFloat(v || 0) / 2))))}>÷2</button>
              </div>
            </div>

            {isCashoutActive ? (
              <button onClick={cashOut} disabled={loading} className="av-action-btn"
                style={{ background: '#00bb44', color: '#000', boxShadow: '0 0 22px rgba(0,180,60,0.45)' }}>
                <span className="av-action-btn-label">CASH OUT</span>
                <span className="av-action-btn-sub">{liveCash.toLocaleString()} UZS</span>
              </button>
            ) : (
              <button onClick={placeBet}
                disabled={loading || !!activeBet || phase !== 'waiting'}
                className="av-action-btn"
                style={{
                  background: activeBet ? '#1a2e1a' : '#00bb44',
                  color: activeBet ? '#3a7a3a' : '#000',
                  opacity: (loading || (phase !== 'waiting' && !activeBet)) ? 0.5 : 1,
                  fontSize: 'clamp(13px, 4vw, 16px)',
                }}>
                {loading ? '...' : activeBet ? '✓ TIKILDI' : 'BET'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
