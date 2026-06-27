import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = (process.env.REACT_APP_BACKEND_URL || '') + '/api';
const QUICK = [5000, 10000, 25000, 50000];

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

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#080d18';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    if (pts.length < 2) return;

    const maxM = Math.max(pts[pts.length - 1] * 1.18, 2.0);
    const PL = 28, PR = 16, PT = 24, PB = 28;
    const PW = W - PL - PR, PH = H - PT - PB;
    const cx = (i) => PL + (i / (pts.length - 1)) * PW;
    const cy = (m) => H - PB - Math.min((m - 1) / (maxM - 1), 1) * PH;

    const crashed = ph === 'crashed';
    const col = crashed ? '#ff2244' : '#ff6935';

    // Fill under curve
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, crashed ? 'rgba(255,30,60,0.20)' : 'rgba(255,110,53,0.20)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.moveTo(cx(0), H - PB);
    pts.forEach((m, i) => ctx.lineTo(cx(i), cy(m)));
    ctx.lineTo(cx(pts.length - 1), H - PB);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Curve line
    ctx.beginPath();
    pts.forEach((m, i) => { if (i === 0) ctx.moveTo(cx(i), cy(m)); else ctx.lineTo(cx(i), cy(m)); });
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.shadowColor = col;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Plane
    const lx = cx(pts.length - 1), ly = cy(pts[pts.length - 1]);
    if (!crashed && pts.length > 1) {
      const px2 = cx(pts.length - 2), py2 = cy(pts[pts.length - 2]);
      const angle = Math.atan2(ly - py2, lx - px2) - 0.22;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(angle);
      ctx.font = '26px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = col;
      ctx.shadowBlur = 22;
      ctx.fillText('✈', 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    } else if (crashed) {
      ctx.font = '30px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💥', lx, ly);
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
        if (d.history) setHistory(d.history.slice(0, 10));
        setActiveBet(null); betRef.current = null;
        setCashedOut(null); setErr('');
      } else if (d.type === 'flying') {
        phaseRef.current = 'flying';
        setPhase('flying');
        setMult(d.multiplier); multRef.current = d.multiplier;
        ptsRef.current = [...ptsRef.current, d.multiplier].slice(-300);
      } else if (d.type === 'crashed') {
        phaseRef.current = 'crashed';
        setPhase('crashed');
        setCrashPt(d.crash_point);
        setMult(d.crash_point);
        if (d.history) setHistory(d.history.slice(0, 10));
        if (betRef.current) {
          setErr(`✈ ${d.crash_point}x da uchib ketdi — stavka yutqazildi`);
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
    if (!amt || amt < 1000) { setErr('Minimal stavka: 1,000 UZS'); return; }
    if (phaseRef.current !== 'waiting') { setErr('Faqat kutish vaqtida tikish mumkin'); return; }
    if (betRef.current) { setErr('Allaqachon tikdingiz'); return; }
    setLoading(true); setErr('');
    try {
      await axios.post(`${API_URL}/aviator/bet`, { telegram_id: user.telegram_id, amount: amt });
      setActiveBet({ amount: amt }); betRef.current = { amount: amt };
      setBalance(b => b - amt);
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Xatolik yuz berdi');
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

  const mCol = (m) => m < 1.5 ? '#ff4455' : m < 3 ? '#ffaa00' : '#00dd77';
  const fmt = (m) => `${Number(m).toFixed(2)}x`;
  const liveCash = activeBet ? Math.floor(activeBet.amount * mult).toLocaleString() : '0';
  const bgCash = 'linear-gradient(135deg,#00dd77,#00aa55)';

  return (
    <div className="min-h-screen flex flex-col text-white select-none" style={{ background: '#080d18' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <button onClick={() => navigate('/casino')} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors">
          ← Orqaga
        </button>
        <div className="flex items-center gap-2 font-black tracking-wider">
          <span className="text-lg">✈</span>
          <span style={{ color: '#ff6935' }}>AVIATOR</span>
        </div>
        <div className="text-xs font-bold text-yellow-400">
          {Number(balance).toLocaleString()} <span className="text-yellow-600">UZS</span>
        </div>
      </div>

      {/* History */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
        {history.length === 0 && <span className="text-xs text-slate-700 italic">Tarix yo'q</span>}
        {history.map((cp, i) => (
          <span key={i} className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-black"
            style={{ background: cp < 2 ? '#ff2244' : cp < 5 ? '#ffaa00' : '#00cc55', color: '#000' }}>
            {fmt(cp)}
          </span>
        ))}
      </div>

      {/* Canvas */}
      <div className="relative mx-3 rounded-2xl overflow-hidden flex-shrink-0"
        style={{ height: '210px', border: '1px solid rgba(255,255,255,0.07)', background: '#080d18' }}>
        <canvas ref={canvasRef} width={700} height={315} style={{ width: '100%', height: '100%', display: 'block' }} />

        {/* Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {phase === 'waiting' && (
            <div className="text-center">
              <div className="text-slate-500 text-sm mb-1">Yangi raund</div>
              <div className="text-5xl font-black text-white tabular-nums">{countdown}s</div>
              {activeBet && <div className="mt-2 text-green-400 text-sm font-bold animate-pulse">✓ {activeBet.amount.toLocaleString()} UZS tikildi</div>}
            </div>
          )}
          {phase === 'flying' && (
            <div className="tabular-nums font-black" style={{ fontSize: '64px', lineHeight: 1, color: mCol(mult), textShadow: `0 0 40px ${mCol(mult)}` }}>
              {fmt(mult)}
            </div>
          )}
          {phase === 'crashed' && (
            <div className="text-center">
              <div className="font-bold text-red-400 text-base mb-1" style={{ textShadow: '0 0 20px #ff2244' }}>✈ UCHIB KETDI!</div>
              <div className="font-black tabular-nums text-red-500" style={{ fontSize: '54px', lineHeight: 1, textShadow: '0 0 30px #ff2244' }}>
                {fmt(crashPt || mult)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cashout success */}
      {cashedOut && (
        <div className="mx-3 mt-2 px-4 py-3 rounded-xl text-center font-bold text-sm flex-shrink-0"
          style={{ background: '#00cc55', color: '#001a0d' }}>
          ✅ {fmt(cashedOut.mult)} da yechdingiz! +{Number(cashedOut.win).toLocaleString()} UZS
        </div>
      )}

      {/* Error */}
      {err && (
        <div className="mx-3 mt-2 px-4 py-2 rounded-xl text-center text-xs text-red-400 flex-shrink-0"
          style={{ background: 'rgba(255,50,70,0.10)', border: '1px solid rgba(255,50,70,0.2)' }}>
          {err}
        </div>
      )}

      {/* Betting panel */}
      <div className="px-3 pt-3 pb-8 space-y-3 flex-shrink-0 mt-auto">
        {/* Quick amounts */}
        <div className="grid grid-cols-4 gap-2">
          {QUICK.map(v => (
            <button key={v} disabled={!!activeBet || phase === 'flying'} onClick={() => setBetAmt(String(v))}
              className="py-1.5 rounded-lg text-xs font-bold border border-white/15 hover:border-yellow-400/60 hover:text-yellow-400 transition-colors disabled:opacity-30">
              {v / 1000}K
            </button>
          ))}
        </div>

        {/* Input + BET */}
        <div className="flex gap-2">
          <input type="number" value={betAmt} onChange={e => setBetAmt(e.target.value)}
            disabled={!!activeBet || phase === 'flying'}
            className="flex-1 rounded-xl px-4 py-3 text-white font-bold text-sm outline-none disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            placeholder="Stavka (UZS)" />

          {!(activeBet && phase === 'flying') && (
            <button onClick={placeBet} disabled={loading || !!activeBet || phase !== 'waiting'}
              className="px-6 py-3 rounded-xl font-black text-sm transition-all active:scale-95 disabled:opacity-40"
              style={{ background: activeBet ? '#1a3a1a' : '#ff6935', color: activeBet ? '#4a8a4a' : '#fff', minWidth: '90px' }}>
              {loading ? '...' : activeBet ? '✓ TIKILDI' : 'BET'}
            </button>
          )}
        </div>

        {/* CASH OUT big button */}
        {activeBet && phase === 'flying' && !cashedOut && (
          <button onClick={cashOut} disabled={loading}
            className="w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95"
            style={{ background: bgCash, color: '#001a0d', boxShadow: '0 0 28px rgba(0,200,80,0.55)' }}>
            <div>CASH OUT 💰</div>
            <div className="text-sm font-bold mt-0.5 opacity-90">{liveCash} UZS · {fmt(mult)}</div>
          </button>
        )}
      </div>
    </div>
  );
}
