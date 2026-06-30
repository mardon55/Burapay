import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = (process.env.REACT_APP_BACKEND_URL || '') + '/api';

function drawBackground(ctx, W, H) {
  // Pure black base
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  // Sunburst rays from bottom-left corner — bright white/light gray (like reference)
  const sx = W * 0.04, sy = H * 0.96;
  const rays = 30;
  const len = Math.sqrt(W * W + H * H) * 2.0;
  for (let i = 0; i < rays; i++) {
    const a1 = -Math.PI * 0.08 + (i / rays) * Math.PI * 1.45;
    const a2 = -Math.PI * 0.08 + ((i + 0.46) / rays) * Math.PI * 1.45;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a1) * len, sy + Math.sin(a1) * len);
    ctx.lineTo(sx + Math.cos(a2) * len, sy + Math.sin(a2) * len);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0)';
    ctx.fill();
  }
}

// Module-level plane image — starts loading immediately when script parses
// plane.png lives in frontend/public/static/ so CRA copies it to build/static/plane.png automatically
const _planeImg = new Image();
_planeImg.src = '/static/plane.png';
_planeImg.onerror = () => { _planeImg.src = '/plane.png'; };

function drawPlane(ctx, x, y, angle, crashed, scale = 1, canvasW = 720, skipClamp = false) {
  const loaded = _planeImg.complete && _planeImg.naturalWidth > 0;

  if (!loaded) return;
  const iw = _planeImg.width;
  const ih = _planeImg.height;

  const xOff = -(66 / 291) * iw;
  const yOff = -(192 / 197) * ih;

  let finalX = x, finalY = y;
  if (!skipClamp) {
    // Samolyot canvas chegarasidan chiqmasin — tumshuq va qanotlar to'liq ko'rinsin
    const W = ctx.canvas.width;
    const pad = 6;
    finalX = Math.min(x, W - (iw + xOff) - pad);
    finalY = Math.max(y, (-yOff) + pad);
  }

  ctx.save();
  ctx.translate(finalX, finalY);
  ctx.rotate(0);

  if (crashed) ctx.globalAlpha = 0.6;
  ctx.shadowColor = crashed ? '#ff0000' : '#ff4466';
  ctx.shadowBlur  = 14 * scale;

  ctx.drawImage(_planeImg, xOff, yOff, iw, ih);

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
  const countdownTimerRef = useRef(null);
  const countdownValRef = useRef(7);

  const [phase, setPhase] = useState('waiting');
  const [mult, setMult] = useState(1.0);
  const [countdown, setCountdown] = useState(7);
  const [history, setHistory] = useState([]);
  const [myHistory, setMyHistory] = useState([]);
  const [crashPt, setCrashPt] = useState(null);
  const [betAmt, setBetAmt] = useState('1000');
  const [activeBet, setActiveBet] = useState(null);
  const [nextRoundBet, setNextRoundBet] = useState(null);
  const [cashedOut, setCashedOut] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [balance, setBalance] = useState(user?.balance_uzs || 0);
  const [betTab, setBetTab] = useState('bet');
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = (msg) => {
    clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 1000);
  };

  const nextRoundBetRef = useRef(null);
  const crashAnimRef = useRef(null); // { startTime, startX, startY }

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

    const crashed = ph === 'crashed';
    drawBackground(ctx, W, H);

    const dpr = window.devicePixelRatio || 1;
    // PR must fit the plane (plane width ≈ 18% of W) so it doesn't clip off-screen
    const planeW = Math.max(80 * dpr, W * 0.18);
    const PL = 44 * dpr, PR = planeW * 1.05, PT = 14 * dpr, PB = 28 * dpr;
    const PW = W - PL - PR;
    const PH = H - PT - PB;
    const ox = PL, oy = H - PB;

    // Y o'qi diapazonini kengroq tutamiz — chiziq pastda yotiq o'ssin, tikka emas
    // currentMult * 3.5 → masalan 2x da Y o'qi 7x gacha, chiziq faqat 1/6 balandlikni egallaydi
    const axisMaxM = pts.length >= 2 ? Math.max(pts[pts.length - 1] * 3.5, 5.0) : 5.0;
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
    // 120 ticks (~12 seconds) = full width. Plane starts near left and moves right gradually.
    const cx = (i) => ox + (i / Math.max(pts.length - 1, 120)) * PW;
    const cy = (m) => oy - Math.min((m - 1) / (maxM - 1), 1) * PH;

    const lx = cx(pts.length - 1);
    const ly = cy(pts[pts.length - 1]);

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

    if (!crashed) {
      const MAX_ANGLE = Math.PI / 25;
      const lookback = Math.min(60, pts.length - 1);
      const refIdx = Math.max(0, pts.length - 1 - lookback);
      const prevX = cx(refIdx);
      const prevY = cy(pts[refIdx]);
      const rawAngle = Math.atan2(ly - prevY, lx - prevX);
      const blended = rawAngle * 0.2;
      const angle = Math.max(-MAX_ANGLE, Math.min(0, blended));
      drawPlane(ctx, lx, ly, angle, false, planeScale * dpr, W);
    } else {
      // Crash exit animatsiyasi — samolyot yuqori-o'ngga tezda uchib chiqib ketadi
      if (!crashAnimRef.current) {
        crashAnimRef.current = { startTime: Date.now(), startX: lx, startY: ly };
      }
      const elapsed = (Date.now() - crashAnimRef.current.startTime) / 1000;
      // Yuqori-o'ng tomonga ~55° burchak bilan tez chiqish
      const EXIT_ANGLE = -Math.PI * 0.38; // ~68° yuqoriga
      const speed = Math.sqrt(W * W + H * H) * 2.8; // 0.5s da butun ekrandan chiqadi
      const exitX = crashAnimRef.current.startX + Math.cos(EXIT_ANGLE) * speed * elapsed;
      const exitY = crashAnimRef.current.startY + Math.sin(EXIT_ANGLE) * speed * elapsed;
      // Canvas tashqarisiga chiqmagan bo'lsa chizish
      if (exitX < W + 400 && exitY > -400) {
        drawPlane(ctx, exitX, exitY, EXIT_ANGLE, false, planeScale * dpr, W, true);
      }
      // Canvas tashqarisiga to'liq chiqsa — hech narsa chizilmaydi
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
        const wasAlreadyWaiting = phaseRef.current === 'waiting';
        phaseRef.current = 'waiting';
        setPhase('waiting');

        const serverCd = d.countdown != null ? d.countdown : 7;

        // Only restart the local timer if this is a new/different countdown value
        // (avoids redundant restarts when multiple 'waiting' messages arrive in sequence)
        if (serverCd !== countdownValRef.current || !countdownTimerRef.current) {
          countdownValRef.current = serverCd;
          setCountdown(serverCd);

          // Clear any existing local timer
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }

          // Local timer: ticks every 1s independently of WebSocket,
          // providing smooth display even if messages arrive with slight jitter.
          countdownTimerRef.current = setInterval(() => {
            countdownValRef.current = Math.max(0, countdownValRef.current - 1);
            setCountdown(countdownValRef.current);
            if (countdownValRef.current <= 0) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
          }, 1000);
        }

        setMult(1.0); multRef.current = 1.0;
        setCrashPt(null);
        ptsRef.current = [1.0];
        crashAnimRef.current = null;
        if (d.history) setHistory(d.history.slice(0, 50));
        // Only clear the active bet and cashed-out state when first entering the
        // waiting phase (i.e. transitioning from crashed/flying → waiting).
        // Subsequent countdown ticks also arrive as 'waiting' messages — clearing
        // activeBet on every tick was the bug: a bet placed during the countdown
        // would be wiped by the very next tick before the round even started.
        if (!wasAlreadyWaiting) {
          setActiveBet(null); betRef.current = null;
          setCashedOut(null); setErr('');
        }
      } else if (d.type === 'flying') {
        // Clear countdown timer — round has started
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        countdownValRef.current = 0;
        phaseRef.current = 'flying';
        setPhase('flying');
        setMult(d.multiplier); multRef.current = d.multiplier;
        ptsRef.current = [...ptsRef.current, d.multiplier].slice(-500);
      } else if (d.type === 'crashed') {
        // Clear countdown timer on crash too
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        countdownValRef.current = 0;
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
        if (betRef.current) {
          const lostBet = betRef.current;
          setMyHistory(prev => [{
            crash_point: cp,
            result: 'lost',
            cashout_multiplier: null,
            amount: lostBet.amount,
            profit: -lostBet.amount,
          }, ...prev].slice(0, 50));
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
    return () => {
      clearTimeout(reconnRef.current);
      wsRef.current?.close();
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [connect]);

  useEffect(() => {
    if (!user?.telegram_id) return;
    axios.get(`${API_URL}/aviator/mybets/${user.telegram_id}`)
      .then(res => {
        const rows = res.data || [];
        const mapped = rows.map(r => ({
          crash_point: r.crash_point,
          result: r.result,
          cashout_multiplier: r.cashout_multiplier,
          amount: r.amount,
          profit: r.profit,
        }));
        setMyHistory(mapped);
      })
      .catch(() => {});
  }, [user?.telegram_id]); // eslint-disable-line

  const placeBet = async () => {
    const amt = parseFloat(betAmt);
    if (!amt || amt < 1000) { showErr('Min: 1 000 UZS', 1000); return; }
    if (amt > 1000000) { showErr('Maks: 1 000 000 UZS', 1000); return; }
    if (amt > balance) { showErr("Mablag' yetarli emas", 1000); return; }

    const currentPhase = phaseRef.current;

    // Samolyot uchayotgan payt → keyingi raund uchun saqlash
    if (currentPhase === 'flying') {
      if (nextRoundBetRef.current) { showErr('Keyingi raund uchun allaqachon tikdingiz', 1500); return; }
      nextRoundBetRef.current = { amount: amt };
      setNextRoundBet({ amount: amt });
      setErr('');
      return;
    }

    // Crash payt → bloklash
    if (currentPhase === 'crashed') { showErr('Yangi raundni kuting...', 1000); return; }

    // Kutish vaqti → oddiy tikish
    if (betRef.current) { showErr('Allaqachon tikdingiz', 1000); return; }
    setLoading(true); setErr('');
    try {
      await axios.post(`${API_URL}/aviator/bet`, { telegram_id: user.telegram_id, amount: amt, currency: 'UZS' });
      setActiveBet({ amount: amt }); betRef.current = { amount: amt };
      setBalance(b => b - amt);
      showToast(`${fmtUzs(amt)} so'm yechildi`);
    } catch (ex) {
      showErr(ex.response?.data?.detail || 'Xatolik', 2000);
    } finally { setLoading(false); }
  };

  const cancelNextRoundBet = () => {
    nextRoundBetRef.current = null;
    setNextRoundBet(null);
  };

  // Yangi raund boshlanganda (waiting) — keyingi raund tikishi avtomatik joylashtiriladi
  useEffect(() => {
    if (phase !== 'waiting') return;
    const nrb = nextRoundBetRef.current;
    if (!nrb) return;
    nextRoundBetRef.current = null;
    setNextRoundBet(null);

    const autoPlace = async () => {
      setLoading(true); setErr('');
      try {
        await axios.post(`${API_URL}/aviator/bet`, { telegram_id: user.telegram_id, amount: nrb.amount, currency: 'UZS' });
        setActiveBet({ amount: nrb.amount }); betRef.current = { amount: nrb.amount };
        setBalance(b => b - nrb.amount);
        showToast(`${fmtUzs(nrb.amount)} so'm yechildi`);
      } catch (ex) {
        showErr(ex.response?.data?.detail || "Keyingi raund tikishi amalga oshmadi", 2500);
      } finally { setLoading(false); }
    };
    autoPlace();
  }, [phase]); // eslint-disable-line

  const cashOut = async () => {
    if (!betRef.current || cashedOut || phaseRef.current !== 'flying') return;
    const betSnapshot = betRef.current;
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/aviator/cashout`, { telegram_id: user.telegram_id });
      setCashedOut({ mult: res.data.multiplier, win: res.data.winnings });
      setMyHistory(prev => [{
        crash_point: null,
        result: 'won',
        cashout_multiplier: res.data.multiplier,
        amount: betSnapshot.amount,
        profit: res.data.profit,
      }, ...prev].slice(0, 50));
      setActiveBet(null); betRef.current = null;
      setBalance(b => b + res.data.winnings);
      showToast(`Hisobingizga +${fmtUzs(res.data.winnings)} so'm qo'shildi`);
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
  // Uchayotganda input ochiq — keyingi raund summasini kiritish uchun (agar hali saqlanmagan bo'lsa)
  const inputDisabled = !!activeBet || !!nextRoundBet || phase === 'crashed';

  const fmtUzs = (n) => Math.round(n).toLocaleString('uz-UZ').replace(/,/g, ' ');

  const adjustAmt = (delta) => {
    const cur = parseFloat(betAmt) || 1000;
    const next = Math.min(1000000, Math.max(1000, Math.round(cur + delta)));
    setBetAmt(String(next));
  };

  const errTimerRef = useRef(null);
  const showErr = (msg, duration = null) => {
    setErr(msg);
    if (errTimerRef.current) clearTimeout(errTimerRef.current);
    if (duration) {
      errTimerRef.current = setTimeout(() => setErr(''), duration);
    }
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

        /* ── Canvas: 40% ── */
        .av-canvas-wrap {
          position: relative;
          flex: 0 0 40dvh;
          height: 40dvh;
          overflow: hidden;
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
          font-size: clamp(32px, 10vw, 58px);
          color: #fff;
          text-shadow: 0 2px 32px rgba(0,0,0,0.95);
          font-weight: 900;
          letter-spacing: -2px;
        }
        .av-countdown-wrap { text-align: center; }
        .av-countdown-label {
          font-size: clamp(9px, 2.5vw, 12px);
          color: rgba(255,255,255,0.45);
          margin-bottom: 2px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .av-countdown-text {
          font-size: clamp(32px, 10vw, 56px);
          color: #fff;
          font-weight: 900;
          letter-spacing: -1px;
        }
        .av-crashed-label {
          font-size: clamp(10px, 3vw, 13px);
          font-weight: 800;
          color: #ff2244;
          margin-bottom: 2px;
          text-shadow: 0 0 20px #ff0030;
          letter-spacing: 1px;
        }
        .av-crashed-mult {
          font-size: clamp(32px, 10vw, 58px);
          color: #ff2244;
          text-shadow: 0 0 30px #ff0030;
          font-weight: 900;
          letter-spacing: -2px;
        }
        .av-bet-placed-badge {
          margin-top: 6px;
          padding: 3px 12px;
          border-radius: 20px;
          font-size: clamp(9px, 2.5vw, 11px);
          font-weight: 700;
          color: #44ff88;
          background: rgba(0,180,80,0.15);
          border: 1px solid rgba(0,200,80,0.3);
        }
        /* Feedback overlay — absolute bottom of canvas */
        .av-feedback-wrap {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          pointer-events: none;
          padding: 0 10px 6px;
        }
        .av-feedback {
          padding: 5px 12px;
          border-radius: 8px;
          text-align: center;
          font-size: clamp(10px, 3vw, 12px);
          font-weight: 700;
        }
        .av-cashout-success { background: #006622; color: #aaffcc; }
        .av-err { color: #ff6677; background: rgba(180,0,30,0.25); border: 1px solid rgba(180,0,30,0.3); }

        /* ── X Tarixi: 40% ── */
        .av-xlist {
          flex: 0 0 40dvh;
          height: 40dvh;
          overflow-y: auto;
          background: #12122a;
          border-top: 1px solid rgba(255,255,255,0.07);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          padding: 10px 12px;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .av-xlist::-webkit-scrollbar { display: none; }
        .av-xlist-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .av-xlist-title {
          font-size: 12px;
          font-weight: 700;
          color: rgba(255,255,255,0.4);
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .av-xlist-back {
          width: 26px; height: 26px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 12px;
          -webkit-tap-highlight-color: transparent;
          color: rgba(255,255,255,0.5);
        }
        .av-xlist-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }
        .av-xlist-badge {
          padding: 5px 4px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 800;
          text-align: center;
          letter-spacing: 0.2px;
        }

        /* ── Bottom Panel: 20% ── */
        .av-panel {
          flex: 0 0 20dvh;
          height: 20dvh;
          background: #1e1e2e;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .av-panel { padding-bottom: max(8px, env(safe-area-inset-bottom)); }
        }
        .av-bet-row {
          display: flex;
          gap: 10px;
          align-items: stretch;
          height: 100%;
        }
        .av-left-block {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 12px;
          padding: 8px 12px;
        }
        .av-amount-input {
          width: 100%;
          text-align: center;
          font-size: clamp(16px, 5vw, 20px);
          font-weight: 900;
          color: #fff;
          letter-spacing: -0.5px;
          background: transparent;
          border: none;
          outline: none;
          -webkit-appearance: none;
          appearance: none;
          padding: 0; margin: 0;
          box-sizing: border-box;
        }
        .av-amount-input::placeholder { color: rgba(255,255,255,0.25); font-weight: 500; font-size: clamp(12px,3.5vw,14px); }
        .av-amount-input::-webkit-outer-spin-button,
        .av-amount-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .av-amount-input[type=number] { -moz-appearance: textfield; }
        .av-bet-btn {
          width: 110px;
          flex-shrink: 0;
          padding: 0 8px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          font-weight: 900;
          font-size: clamp(12px, 4vw, 15px);
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          line-height: 1.2;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          letter-spacing: 0.5px;
          height: 100%;
        }
        .av-bet-btn-sub {
          font-size: clamp(8px, 2.5vw, 10px);
          font-weight: 700;
          opacity: 0.85;
          margin-top: 2px;
        }
        .av-toast {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(30,30,50,0.97);
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          padding: 9px 20px;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.13);
          z-index: 9999;
          white-space: nowrap;
          pointer-events: none;
        }
      `}</style>

      {toast && <div className="av-toast">{toast}</div>}

      <div className="av-root">

        {/* ── 40% : Canvas ── */}
        <div className="av-canvas-wrap" ref={containerRef}>
          <canvas ref={canvasRef} className="av-canvas" />
          <div className="av-overlay">
            {phase === 'waiting' && (
              <div className="av-countdown-wrap">
                <div className="av-countdown-label">Yangi raund boshlangʼuncha</div>
                <div style={{ ...multStyle }} className="av-countdown-text">{countdown}s</div>
                {activeBet && (
                  <div className="av-bet-placed-badge">✓ {fmtUzs(activeBet.amount)} UZS tikildi</div>
                )}
              </div>
            )}
            {phase === 'flying' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...multStyle }} className="av-mult-text">{fmt(mult)}</div>
                {nextRoundBet && (
                  <div className="av-bet-placed-badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)' }}>
                    ⏳ Keyingi: {fmtUzs(nextRoundBet.amount)} UZS
                  </div>
                )}
              </div>
            )}
            {phase === 'crashed' && (
              <div style={{ textAlign: 'center' }}>
                <div className="av-crashed-label">✈ UCHIB KETDI!</div>
                <div style={{ ...multStyle }} className="av-crashed-mult">{fmt(crashPt || mult)}</div>
              </div>
            )}
          </div>
          {/* Feedback — canvas pastiga overlay */}
          <div className="av-feedback-wrap">
            {cashedOut && (
              <div className="av-feedback av-cashout-success">
                ✅ {fmt(cashedOut.mult)} da yechdingiz! +{fmtUzs(cashedOut.win)} UZS
              </div>
            )}
            {err && !cashedOut && (
              <div className="av-feedback av-err">{err}</div>
            )}
          </div>
        </div>

        {/* ── 20% : Bet Panel ── */}
        <div className="av-panel">
          <div className="av-bet-row">
            {/* Left: summa input */}
            <div className="av-left-block">
              <input
                className="av-amount-input"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={inputDisabled}
                value={betAmt}
                placeholder="Summa..."
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (v > 1000000) { setBetAmt('1000000'); showErr('Maks: 1 000 000 UZS', 1000); }
                  else setBetAmt(e.target.value);
                }}
                onBlur={() => {
                  const v = parseFloat(betAmt);
                  if (!v || v < 1000) { setBetAmt('1000'); showErr('Min: 1 000 UZS', 1000); }
                  else if (v > 1000000) { setBetAmt('1000000'); showErr('Maks: 1 000 000 UZS', 1000); }
                  else setBetAmt(String(Math.round(v)));
                }}
              />
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textAlign: 'center' }}>
                1 000 – 1 000 000 UZS
              </div>
            </div>

            {/* Right: CASHOUT / KEYINGI / BEKOR / TIKISH */}
            {isCashoutActive ? (
              <button onClick={cashOut} disabled={loading} className="av-bet-btn"
                style={{ background: '#22c55e', color: '#000', boxShadow: '0 0 20px rgba(34,197,94,0.4)' }}>
                <span>YECHISH</span>
                <span className="av-bet-btn-sub">{fmtUzs(parseFloat(liveCash))} UZS</span>
              </button>
            ) : nextRoundBet ? (
              <button onClick={cancelNextRoundBet} disabled={loading} className="av-bet-btn"
                style={{ background: '#dc2626', color: '#fff', boxShadow: '0 0 14px rgba(220,38,38,0.35)' }}>
                <span>BEKOR</span>
                <span className="av-bet-btn-sub">{fmtUzs(nextRoundBet.amount)} UZS</span>
              </button>
            ) : phase === 'flying' && !activeBet ? (
              <button onClick={placeBet} disabled={loading} className="av-bet-btn"
                style={{ background: '#f59e0b', color: '#000', boxShadow: '0 0 14px rgba(245,158,11,0.35)' }}>
                <span>KEYINGI</span>
                <span className="av-bet-btn-sub">RAUND ▸</span>
              </button>
            ) : (
              <button onClick={placeBet}
                disabled={loading || !!activeBet || phase !== 'waiting'}
                className="av-bet-btn"
                style={{
                  background: activeBet ? '#14532d' : '#22c55e',
                  color: activeBet ? '#4ade80' : '#000',
                  opacity: (loading || phase === 'crashed') ? 0.45 : 1,
                  boxShadow: (!activeBet && phase === 'waiting') ? '0 0 18px rgba(34,197,94,0.35)' : 'none',
                }}>
                {loading ? '...' : activeBet ? (
                  <><span>✓</span><span className="av-bet-btn-sub">TIKILDI</span></>
                ) : (
                  <>
                    <span>TIKISH</span>
                    <span className="av-bet-btn-sub">{fmtUzs(parseFloat(betAmt) || 1000)} UZS</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── 40% : Mening raundlarim tarixi ── */}
        <div className="av-xlist">
          <div className="av-xlist-header">
            <span className="av-xlist-title">Mening raundlarim</span>
          </div>
          {myHistory.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>
              Hali qatnashgan raundlar yo'q...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {myHistory.map((r, i) => {
                const isWon = r.result === 'won';
                const multiplier = isWon ? r.cashout_multiplier : r.crash_point;
                const profitAbs = Math.abs(r.profit || 0);
                return (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: isWon ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${isWon ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', minWidth: 40 }}>
                      {isWon ? '✅' : '❌'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: isWon ? '#4ade80' : '#f87171', flex: 1 }}>
                      {multiplier ? `${Number(multiplier).toFixed(2)}x` : '—'}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginRight: 8 }}>
                      {Math.round(r.amount || 0).toLocaleString()} UZS
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isWon ? '#4ade80' : '#f87171' }}>
                      {isWon ? '+' : '-'}{Math.round(profitAbs).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </>
  );
}
