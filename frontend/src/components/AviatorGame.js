import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = (process.env.REACT_APP_BACKEND_URL || '') + '/api';

// Draw sunburst rays
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

// Draw detailed airplane silhouette (large, clear)
function drawPlane(ctx, x, y, angle, crashed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle - 0.18);

  const col = crashed ? '#ff2244' : '#dd0030';
  ctx.fillStyle = col;
  ctx.strokeStyle = '#ff4466';
  ctx.lineWidth = 1.2;
  ctx.shadowColor = '#ff1135';
  ctx.shadowBlur = 28;

  // ── Fuselage ──────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(62, 0);                          // nose tip
  ctx.bezierCurveTo(50, -11, 18, -13, -8, -10);
  ctx.lineTo(-52, -6);                        // tail top
  ctx.lineTo(-60, 0);                         // tail end
  ctx.lineTo(-52, 6);                         // tail bottom
  ctx.bezierCurveTo(-8, 10, 18, 13, 50, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ── Cockpit canopy (dark oval cutout) ────────────────────
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(28, -8, 14, 7, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Main wings ────────────────────────────────────────────
  // Left wing (up)
  ctx.beginPath();
  ctx.moveTo(18, -10);
  ctx.lineTo(8, -50);
  ctx.lineTo(-16, -44);
  ctx.lineTo(-8, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right wing (down)
  ctx.beginPath();
  ctx.moveTo(18, 10);
  ctx.lineTo(8, 50);
  ctx.lineTo(-16, 44);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ── Horizontal stabilizers ────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(-36, -6);
  ctx.lineTo(-42, -27);
  ctx.lineTo(-58, -22);
  ctx.lineTo(-52, -5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-36, 6);
  ctx.lineTo(-42, 27);
  ctx.lineTo(-58, 22);
  ctx.lineTo(-52, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ── Vertical fin ──────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(-36, 0);
  ctx.lineTo(-44, -30);
  ctx.lineTo(-60, -20);
  ctx.lineTo(-54, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ── Propeller (3 blades) ──────────────────────────────────
  ctx.save();
  ctx.translate(64, 0);
  const propSpin = (Date.now() / 80) % (Math.PI * 2);
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(propSpin + (i / 3) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, -20, 5, 18, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // Hub
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.shadowBlur = 0;
  ctx.restore();
}

export default function AviatorGame({ user }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const reconnRef = useRef(null);
  const ptsRef = useRef([1.0]);
  const phaseRef = useRef('waiting');
  const multRef = useRef(1.0);
  const betRef = useRef(null);
  const frameRef = useRef(null);

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

  // ── Canvas ─────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const ph = phaseRef.current;
    const pts = ptsRef.current;

    // Black background
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, W, H);

    // Sunburst
    drawSunburst(ctx, W, H);

    const PL = 50, PR = 18, PT = 18, PB = 32;
    const PW = W - PL - PR;
    const PH = H - PT - PB;
    const ox = PL, oy = H - PB;

    // Always draw axes even if no data yet
    const axisMaxM = pts.length >= 2 ? Math.max(pts[pts.length - 1] * 1.18, 2.0) : 2.0;
    const cy0 = (m) => oy - Math.min((m - 1) / (axisMaxM - 1), 1) * PH;

    // Y-axis
    for (let i = 1; i <= 5; i++) {
      const m = 1 + (i / 5) * (axisMaxM - 1);
      const yy = cy0(m);
      ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(PL, yy); ctx.lineTo(W - PR, yy);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(PL - 6, yy, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,100,120,0.6)'; ctx.fill();
      ctx.fillStyle = 'rgba(150,150,170,0.6)';
      ctx.font = '10px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`${m.toFixed(1)}x`, PL - 10, yy + 3);
    }
    // X-axis
    for (let i = 0; i <= 8; i++) {
      const xx = ox + (i / 8) * PW;
      ctx.beginPath(); ctx.arc(xx, oy + 10, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,100,120,0.5)'; ctx.fill();
    }

    if (pts.length < 2) {
      // Waiting: draw plane parked at origin
      drawPlane(ctx, ox + 10, oy, 0, false);
      return;
    }

    const maxM = axisMaxM;
    const cx = (i) => ox + (i / Math.max(pts.length - 1, 1)) * PW;
    const cy = (m) => oy - Math.min((m - 1) / (maxM - 1), 1) * PH;

    const crashed = ph === 'crashed';

    // ── Fill under curve ──
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

    // ── Curve line ──
    ctx.beginPath();
    pts.forEach((m, i) => {
      if (i === 0) ctx.moveTo(cx(i), cy(m));
      else ctx.lineTo(cx(i), cy(m));
    });
    ctx.strokeStyle = crashed ? '#ff2244' : '#ff0036';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = crashed ? '#ff2244' : '#ff0036';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Airplane at tip ──
    const lx = cx(pts.length - 1);
    const ly = cy(pts[pts.length - 1]);

    if (!crashed) {
      const refIdx = Math.max(0, pts.length - 6);
      const prevX = cx(refIdx);
      const prevY = cy(pts[refIdx]);
      const angle = Math.atan2(ly - prevY, lx - prevX);
      drawPlane(ctx, lx, ly, angle, false);
    } else {
      drawPlane(ctx, lx, ly, Math.PI * 0.3, true);
    }
  }, []);

  useEffect(() => {
    const loop = () => { draw(); frameRef.current = requestAnimationFrame(loop); };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  // ── WebSocket ──────────────────────────────────────────────────────────────
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
        // If page loaded in crashed state with no trajectory, generate one
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

  // ── Actions ────────────────────────────────────────────────────────────────
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0c0c0c', color: '#fff', userSelect: 'none', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#131313', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <button onClick={() => navigate('/casino')} style={{ color: '#555', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
          ← Orqaga
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 900, letterSpacing: '3px', fontSize: '13px', color: '#ff1a3a' }}>
          ✈ AVIATOR
        </div>
        <div style={{ fontSize: '11px', color: '#d4af37', fontWeight: 700 }}>
          {Number(balance).toLocaleString()} UZS
        </div>
      </div>

      {/* ── History badges ── */}
      <div style={{ display: 'flex', gap: '6px', padding: '6px 12px', overflowX: 'auto', flexShrink: 0, background: '#131313', scrollbarWidth: 'none' }}>
        {history.length === 0 && <span style={{ fontSize: '11px', color: '#333' }}>Tarix yo'q</span>}
        {history.map((cp, i) => {
          const col = cp < 2 ? '#ff2244' : cp < 5 ? '#ffaa00' : '#00cc55';
          const bg = cp < 2 ? 'rgba(255,0,40,0.15)' : cp < 5 ? 'rgba(255,170,0,0.15)' : 'rgba(0,180,60,0.15)';
          return (
            <span key={i} style={{ flexShrink: 0, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, color: col, background: bg, border: `1px solid ${col}44` }}>
              {fmt(cp)}
            </span>
          );
        })}
      </div>

      {/* ── Canvas ── */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <canvas ref={canvasRef} width={720} height={420}
          style={{ width: '100%', height: '100%', display: 'block' }} />

        {/* Multiplier / status overlay */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {phase === 'waiting' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>Yangi raund boshlangʼuncha</div>
              <div style={{ ...multStyle, fontSize: '68px', color: '#fff' }}>{countdown}s</div>
              {activeBet && (
                <div style={{ marginTop: '10px', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, color: '#44ff88', background: 'rgba(0,180,80,0.15)', border: '1px solid rgba(0,200,80,0.3)' }}>
                  ✓ {activeBet.amount.toLocaleString()} UZS tikildi
                </div>
              )}
            </div>
          )}
          {phase === 'flying' && (
            <div style={{ ...multStyle, fontSize: '72px', color: '#fff', textShadow: '0 2px 24px rgba(0,0,0,0.9)' }}>
              {fmt(mult)}
            </div>
          )}
          {phase === 'crashed' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#ff2244', marginBottom: '6px', textShadow: '0 0 20px #ff0030' }}>
                ✈ UCHIB KETDI!
              </div>
              <div style={{ ...multStyle, fontSize: '64px', color: '#ff2244', textShadow: '0 0 30px #ff0030' }}>
                {fmt(crashPt || mult)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Cashout success ── */}
      {cashedOut && (
        <div style={{ margin: '0 12px 6px', padding: '8px 16px', borderRadius: '10px', textAlign: 'center', fontWeight: 700, fontSize: '13px', background: '#006622', color: '#aaffcc', flexShrink: 0 }}>
          ✅ {fmt(cashedOut.mult)} da yechdingiz! +{Number(cashedOut.win).toLocaleString()} UZS
        </div>
      )}
      {err && !cashedOut && (
        <div style={{ margin: '0 12px 4px', padding: '6px 12px', borderRadius: '8px', textAlign: 'center', fontSize: '11px', color: '#ff6677', background: 'rgba(180,0,30,0.25)', border: '1px solid rgba(180,0,30,0.3)', flexShrink: 0 }}>
          {err}
        </div>
      )}

      {/* ── Bet Panel ── */}
      <div style={{ flexShrink: 0, padding: '10px 12px 20px', background: '#131313', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Quick amounts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '8px' }}>
          {[5000, 10000, 25000, 50000].map(v => (
            <button key={v} disabled={!!activeBet || phase === 'flying'}
              onClick={() => setBetAmt(String(v))}
              style={{
                padding: '5px 0', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                background: betAmt === String(v) ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                color: betAmt === String(v) ? '#fff' : '#555',
                border: betAmt === String(v) ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.06)',
                opacity: (!!activeBet || phase === 'flying') ? 0.3 : 1,
              }}>
              {v / 1000}K
            </button>
          ))}
        </div>

        {/* Input row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
          {/* Amount input with ×2 ÷2 */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#1c1c1c', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <input type="number" value={betAmt}
              onChange={e => setBetAmt(e.target.value)}
              disabled={!!activeBet || phase === 'flying'}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontWeight: 700, fontSize: '14px', padding: '12px 10px', opacity: (!!activeBet || phase === 'flying') ? 0.4 : 1 }}
              placeholder="Stavka (UZS)" />
            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
              <button disabled={!!activeBet || phase === 'flying'}
                onClick={() => setBetAmt(v => String(Math.round(parseFloat(v || 0) * 2)))}
                style={{ background: 'none', border: 'none', color: '#666', fontSize: '10px', padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}>×2</button>
              <button disabled={!!activeBet || phase === 'flying'}
                onClick={() => setBetAmt(v => String(Math.max(1000, Math.round(parseFloat(v || 0) / 2))))}
                style={{ background: 'none', border: 'none', color: '#666', fontSize: '10px', padding: '4px 10px', cursor: 'pointer', fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.05)' }}>÷2</button>
            </div>
          </div>

          {/* BET / CASHOUT */}
          {isCashoutActive ? (
            <button onClick={cashOut} disabled={loading}
              style={{ flex: 1, borderRadius: '12px', border: 'none', cursor: 'pointer', background: '#00bb44', color: '#000', fontWeight: 900, fontSize: '15px', boxShadow: '0 0 22px rgba(0,180,60,0.45)', transition: 'all .15s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.2 }}>
              <span>CASH OUT</span>
              <span style={{ fontSize: '11px', fontWeight: 700, marginTop: '2px', opacity: 0.85 }}>{liveCash.toLocaleString()} UZS</span>
            </button>
          ) : (
            <button onClick={placeBet}
              disabled={loading || !!activeBet || phase !== 'waiting'}
              style={{
                flex: 1, borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '16px', transition: 'all .15s',
                background: activeBet ? '#1a2e1a' : '#00bb44',
                color: activeBet ? '#3a7a3a' : '#000',
                opacity: (loading || (phase !== 'waiting' && !activeBet)) ? 0.5 : 1,
              }}>
              {loading ? '...' : activeBet ? '✓ TIKILDI' : 'BET'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
