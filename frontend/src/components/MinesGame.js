import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = (process.env.REACT_APP_BACKEND_URL || '') + '/api';

const CELL_IDLE   = 'idle';
const CELL_GEM    = 'gem';
const CELL_MINE   = 'mine';
const CELL_REVEAL = 'reveal';

const MAX_BET = 1_000_000;
const MIN_BET = 1_000;

export default function MinesGame({ user }) {
  const navigate = useNavigate();

  const [balance, setBalance]           = useState(user?.balance_uzs || 0);
  const [betAmt, setBetAmt]             = useState('1000');
  const [minesCount]                    = useState(6);
  const [gameStatus, setGameStatus]     = useState(null);
  const [betAmount, setBetAmount]       = useState(0);
  const [openedCount, setOpenedCount]   = useState(0);
  const [currentMult, setCurrentMult]   = useState(1);
  const [cells, setCells]               = useState(Array(25).fill(CELL_IDLE));
  const [loading, setLoading]           = useState(false);
  const [clickingCell, setClickingCell] = useState(null);
  const [err, setErr]                   = useState('');
  const [msg, setMsg]                   = useState('');
  const errTimer = useRef(null);
  const msgTimer = useRef(null);

  const fmt  = n => Math.round(n).toLocaleString('uz-UZ').replace(/,/g, ' ');
  const fmtM = m => `${Number(m).toFixed(2)}x`;

  const showErr = (txt, ms = 2800) => {
    clearTimeout(errTimer.current);
    setErr(txt); setMsg('');
    errTimer.current = setTimeout(() => setErr(''), ms);
  };
  const showMsg = (txt, ms = 3000) => {
    clearTimeout(msgTimer.current);
    setMsg(txt); setErr('');
    msgTimer.current = setTimeout(() => setMsg(''), ms);
  };

  // Clamp bet value
  const clampBet = raw => {
    const v = parseInt(raw, 10);
    if (!v || isNaN(v)) return MIN_BET;
    if (v < MIN_BET) return MIN_BET;
    if (v > MAX_BET) return MAX_BET;
    return v;
  };

  useEffect(() => {
    if (!user?.telegram_id) return;

    // Real balansni backenddan olish
    axios.get(`${API_URL}/user/${user.telegram_id}`)
      .then(res => {
        const realBalance = parseFloat(res.data.balance_uzs || 0);
        setBalance(realBalance);
      })
      .catch(() => {});

    // Faol o'yinni tekshirish
    axios.get(`${API_URL}/mines/current/${user.telegram_id}`)
      .then(res => {
        const g = res.data.game;
        if (!g) return;
        setGameStatus('active');
        setBetAmount(parseFloat(g.bet_amount));
        setOpenedCount((g.opened_cells || []).length);
        setCurrentMult(parseFloat(g.current_multiplier || 1));
        const c = Array(25).fill(CELL_IDLE);
        (g.opened_cells || []).forEach(i => { c[i] = CELL_GEM; });
        setCells(c);
      })
      .catch(() => {});
  }, [user?.telegram_id]);

  const startGame = async () => {
    if (loading) return;
    const amt = clampBet(betAmt);
    if (amt < MIN_BET) { showErr(`Minimal stavka: ${fmt(MIN_BET)} UZS`); return; }
    if (amt > MAX_BET) { showErr(`Maksimal stavka: ${fmt(MAX_BET)} UZS`); return; }
    if (amt > balance) { showErr('Mablag\' yetarli emas!'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/mines/start`, {
        telegram_id: user.telegram_id,
        bet_amount: amt,
        mines_count: minesCount,
      });
      setGameStatus('active');
      setBetAmount(amt);
      setOpenedCount(0);
      setCurrentMult(parseFloat(res.data.current_multiplier || 1));
      setCells(Array(25).fill(CELL_IDLE));
      setBalance(b => b - amt);
      setErr(''); setMsg('');
    } catch (ex) {
      const detail = ex.response?.data?.detail || 'Xatolik yuz berdi';
      showErr(detail.includes('yetarli') || detail.includes('Balans') ? "Mablag' yetarli emas!" : detail);
    } finally { setLoading(false); }
  };

  const clickCell = useCallback(async (idx) => {
    if (gameStatus !== 'active') return;
    if (cells[idx] !== CELL_IDLE) return;
    if (loading || clickingCell !== null) return;
    setClickingCell(idx);
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/mines/click`, {
        telegram_id: user.telegram_id,
        cell_index: idx,
      });
      const d = res.data;
      if (d.result === 'lost') {
        setCells(prev => { const n=[...prev]; n[idx]=CELL_MINE; return n; });
        setTimeout(() => {
          setCells(prev => {
            const n=[...prev];
            (d.mine_positions||[]).forEach(mi => { if(n[mi]===CELL_IDLE) n[mi]=CELL_REVEAL; });
            return n;
          });
        }, 350);
        setGameStatus('lost');
        showErr(`💣 Mina! -${fmt(betAmount)} UZS`, 3500);
      } else if (d.result === 'won') {
        setCells(prev => {
          const n=[...prev]; n[idx]=CELL_GEM;
          (d.mine_positions||[]).forEach(mi => { if(n[mi]===CELL_IDLE) n[mi]=CELL_REVEAL; });
          return n;
        });
        setOpenedCount((d.opened_cells||[]).length);
        setCurrentMult(parseFloat(d.current_multiplier));
        setGameStatus('won');
        setBalance(b => b + d.winnings);
        showMsg(`🏆 +${fmt(d.winnings)} UZS`, 3500);
      } else {
        setCells(prev => { const n=[...prev]; n[idx]=CELL_GEM; return n; });
        setOpenedCount((d.opened_cells||[]).length);
        setCurrentMult(parseFloat(d.current_multiplier));
      }
    } catch (ex) {
      showErr(ex.response?.data?.detail || 'Xatolik');
    } finally { setLoading(false); setClickingCell(null); }
  }, [gameStatus, cells, loading, clickingCell, user, betAmount]);

  const cashOut = async () => {
    if (gameStatus !== 'active' || loading) return;
    if (openedCount === 0) { showErr('Kamida bitta katak oching'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/mines/cashout`, { telegram_id: user.telegram_id });
      setCells(prev => {
        const n=[...prev];
        (res.data.mine_positions||[]).forEach(mi => { if(n[mi]===CELL_IDLE) n[mi]=CELL_REVEAL; });
        return n;
      });
      setGameStatus('won');
      setBalance(b => b + res.data.winnings);
      setCurrentMult(parseFloat(res.data.multiplier));
      showMsg(`✅ +${fmt(res.data.winnings)} UZS (${fmtM(res.data.multiplier)})`, 3500);
    } catch (ex) {
      showErr(ex.response?.data?.detail || 'Xatolik');
    } finally { setLoading(false); }
  };

  const resetGame = () => {
    setGameStatus(null);
    setCells(Array(25).fill(CELL_IDLE));
    setOpenedCount(0);
    setCurrentMult(1);
    setBetAmt('1000');
    setErr(''); setMsg('');
  };

  const isActive   = gameStatus === 'active';
  const isFinished = gameStatus === 'won' || gameStatus === 'lost';
  const potentialWin = Math.round(betAmount * currentMult);
  const displayBet  = clampBet(betAmt);

  const getCellStyle = (idx, state) => {
    const base = {
      borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 'clamp(18px, 5vw, 26px)',
      cursor: isActive && state === CELL_IDLE ? 'pointer' : 'default',
      border: '1.5px solid',
      transition: 'transform 0.1s, background 0.15s, border-color 0.15s, box-shadow 0.15s',
      transform: clickingCell === idx ? 'scale(0.85)' : 'scale(1)',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      touchAction: 'manipulation',
      aspectRatio: '1',
    };
    if (state === CELL_GEM)    return { ...base, background: 'linear-gradient(135deg,rgba(16,185,129,0.28),rgba(5,150,105,0.16))', borderColor: 'rgba(16,185,129,0.6)', boxShadow: '0 0 12px rgba(16,185,129,0.28)' };
    if (state === CELL_MINE)   return { ...base, background: 'linear-gradient(135deg,rgba(239,68,68,0.38),rgba(185,28,28,0.22))', borderColor: 'rgba(239,68,68,0.75)', boxShadow: '0 0 18px rgba(239,68,68,0.5)' };
    if (state === CELL_REVEAL) return { ...base, background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.22)', opacity: 0.6 };
    if (isActive)              return { ...base, background: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.35)', boxShadow: '0 0 6px rgba(139,92,246,0.12)' };
    return { ...base, background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' };
  };

  return (
    <>
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: 'linear-gradient(180deg,#0a0f1e 0%,#0d1225 100%)',
      color: '#fff',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      overflow: 'hidden',
    }}>

      {/* ══ 1. SARLAVHA & BALANS ══ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        paddingTop: 'max(44px, calc(env(safe-area-inset-top) + 10px))',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 1.5 }}>💣 MINES</div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#fbbf24',
          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 20, padding: '4px 11px',
        }}>{fmt(balance)} UZS</div>
      </div>

      {/* ══ 2. STATS (faqat o'yin faol/tugagan paytda) ══ */}
      {gameStatus && (
        <div style={{
          display: 'flex', padding: '7px 12px',
          background: 'rgba(0,0,0,0.2)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}>
          {[
            { label: 'STAVKA',   value: fmt(betAmount),    color: '#fff' },
            { label: 'OCHILGAN', value: openedCount,       color: '#4ade80' },
            { label: 'KOEF.',    value: fmtM(currentMult), color: '#fbbf24' },
            { label: 'YUTUQ',    value: fmt(potentialWin), color: '#a78bfa' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', fontWeight: 700, letterSpacing: 0.3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color, marginTop: 1 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ══ 3. MINES GRIDI — MARKAZDA ══ */}
      <div style={{
        flex: 1,
        padding: '12px 14px 8px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Feedback */}
        {(err || msg) && (
          <div style={{
            marginBottom: 10, padding: '8px 14px', borderRadius: 10,
            fontSize: 13, fontWeight: 700, textAlign: 'center',
            background: err ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
            color: err ? '#f87171' : '#4ade80',
            border: `1px solid ${err ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
            width: '100%', maxWidth: 360, boxSizing: 'border-box',
          }}>{err || msg}</div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 7,
          width: '100%', maxWidth: 370,
        }}>
          {cells.map((state, idx) => (
            <div
              key={idx}
              onClick={() => {
                if (isActive && state === CELL_IDLE && !loading && clickingCell === null)
                  clickCell(idx);
              }}
              style={{
                ...getCellStyle(idx, state),
                animation: (state === CELL_GEM || state === CELL_MINE) ? 'popIn 0.22s ease' : 'none',
              }}
            >
              {state === CELL_GEM    && <span style={{ filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.8))' }}>💎</span>}
              {state === CELL_MINE   && <span style={{ filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.9))' }}>💣</span>}
              {state === CELL_REVEAL && <span style={{ opacity: 0.55 }}>💣</span>}
              {state === CELL_IDLE && isActive && (
                <div style={{
                  width: '42%', height: '42%', borderRadius: '50%',
                  background: 'rgba(139,92,246,0.3)',
                  border: '1px solid rgba(139,92,246,0.5)',
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ══ 4. BOSHQARUV PANELI — PAST ══ */}
      <div style={{
        flexShrink: 0,
        padding: '12px 14px',
        paddingBottom: 'max(18px, calc(env(safe-area-inset-bottom) + 12px))',
        background: 'rgba(255,255,255,0.025)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>


        {/* Stavka inputi + TIKISH tugmasi — rasm kabi */}
        {!isActive && !isFinished && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            {/* Input */}
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              border: '1.5px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '10px 14px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <input
                type="number"
                inputMode="numeric"
                value={betAmt}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  const num = parseInt(raw, 10);
                  if (!raw) { setBetAmt(''); return; }
                  if (num > MAX_BET) { setBetAmt(String(MAX_BET)); return; }
                  setBetAmt(raw);
                }}
                onBlur={() => {
                  const v = clampBet(betAmt);
                  setBetAmt(String(v));
                }}
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: '#fff', fontSize: 22, fontWeight: 900,
                  width: '100%', padding: 0,
                  WebkitAppearance: 'none',
                }}
                placeholder="1000"
              />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2, fontWeight: 600 }}>
                1 000 – 1 000 000 UZS
              </div>
            </div>

            {/* TIKISH tugmasi */}
            <button
              disabled={loading}
              onClick={startGame}
              style={{
                background: loading ? 'rgba(34,197,94,0.4)' : 'linear-gradient(135deg,#22c55e,#16a34a)',
                border: 'none', borderRadius: 12,
                minWidth: 90, padding: '10px 12px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 0 18px rgba(34,197,94,0.3)',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 900, color: '#000', letterSpacing: 0.5 }}>
                {loading ? '...' : 'TIKISH'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#000', opacity: 0.7, marginTop: 2 }}>
                {fmt(displayBet || MIN_BET)} UZS
              </span>
            </button>
          </div>
        )}

        {/* O'yin faol — YECHISH tugmasi */}
        {isActive && (
          <button
            disabled={loading || openedCount === 0}
            onClick={cashOut}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              fontSize: 15, fontWeight: 900,
              cursor: (loading || openedCount === 0) ? 'not-allowed' : 'pointer',
              color: '#000', opacity: (loading || openedCount === 0) ? 0.4 : 1,
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              boxShadow: '0 0 22px rgba(34,197,94,0.3)',
            }}
          >
            {loading
              ? '⏳ ...'
              : openedCount === 0
                ? '💰 Katak oching...'
                : `💰 YECHISH — ${fmt(potentialWin)} UZS (${fmtM(currentMult)})`}
          </button>
        )}

        {/* O'yin tugagan — Yangi o'yin */}
        {isFinished && (
          <button
            onClick={resetGame}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              fontSize: 15, fontWeight: 900, cursor: 'pointer', color: '#fff',
              background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
              boxShadow: '0 0 18px rgba(99,102,241,0.3)',
            }}
          >
            🔄 Yangi o'yin
          </button>
        )}
      </div>

      <style>{`
        @keyframes popIn {
          0%   { transform: scale(0.6); opacity: 0.4; }
          65%  { transform: scale(1.15); }
          100% { transform: scale(1);   opacity: 1; }
        }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>

    </>
  );
}
