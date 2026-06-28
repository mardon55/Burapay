import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = (process.env.REACT_APP_BACKEND_URL || '') + '/api';

const CELL_IDLE   = 'idle';
const CELL_GEM    = 'gem';
const CELL_MINE   = 'mine';
const CELL_REVEAL = 'reveal';

export default function MinesGame({ user }) {
  const navigate = useNavigate();

  const [balance, setBalance]           = useState(user?.balance_uzs || 0);
  const [betAmt, setBetAmt]             = useState('1000');
  const [minesCount, setMinesCount]     = useState(3);
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

  useEffect(() => {
    if (!user?.telegram_id) return;
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
    const amt = parseFloat(betAmt);
    if (!amt || amt < 1000)  { showErr('Minimal stavka: 1 000 UZS'); return; }
    if (amt > 10_000_000)    { showErr('Maksimal: 10 000 000 UZS'); return; }
    if (amt > balance)       { showErr('Balansingiz yetarli emas'); return; }
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
      showErr(ex.response?.data?.detail || 'Xatolik yuz berdi');
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
        showErr(`💣 Mina! O'yin tugadi. -${fmt(betAmount)} UZS`, 4000);
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
        showMsg(`🏆 Barcha xavfsiz kataklar! +${fmt(d.winnings)} UZS`, 4000);
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
      showMsg(`✅ Yechdingiz! +${fmt(res.data.winnings)} UZS (${fmtM(res.data.multiplier)})`, 4000);
    } catch (ex) {
      showErr(ex.response?.data?.detail || 'Xatolik');
    } finally { setLoading(false); }
  };

  const resetGame = () => {
    setGameStatus(null);
    setCells(Array(25).fill(CELL_IDLE));
    setOpenedCount(0);
    setCurrentMult(1);
    setErr(''); setMsg('');
  };

  const isActive   = gameStatus === 'active';
  const isFinished = gameStatus === 'won' || gameStatus === 'lost';
  const potentialWin = Math.round(betAmount * currentMult);

  const getCellStyle = (idx, state) => {
    const base = {
      borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 'clamp(18px, 5vw, 26px)',
      cursor: isActive && state === CELL_IDLE ? 'pointer' : 'default',
      border: '1.5px solid',
      transition: 'transform 0.1s, background 0.15s, border-color 0.15s, box-shadow 0.15s',
      transform: clickingCell === idx ? 'scale(0.86)' : 'scale(1)',
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
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100dvh',
      background: 'linear-gradient(180deg,#0a0f1e 0%,#0d1225 100%)',
      color: '#fff',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>

      {/* ══ 1. SARLAVHA & BALANS ══ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        paddingTop: 'max(48px, calc(env(safe-area-inset-top) + 12px))',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <button onClick={() => navigate('/casino')} style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.06)',
          color: '#fff', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>←</button>
        <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: 1.5 }}>💣 MINES</div>
        <div style={{
          fontSize: 13, fontWeight: 700, color: '#fbbf24',
          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 20, padding: '4px 12px',
        }}>{fmt(balance)} UZS</div>
      </div>

      {/* ══ 2. STATS BAR (faqat o'yin faol/tugagan paytda) ══ */}
      {gameStatus && (
        <div style={{
          display: 'flex', padding: '8px 12px',
          background: 'rgba(0,0,0,0.2)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}>
          {[
            { label: 'STAVKA',     value: fmt(betAmount),    color: '#fff' },
            { label: 'OCHILGAN',   value: openedCount,       color: '#4ade80' },
            { label: 'KOEF.',      value: fmtM(currentMult), color: '#fbbf24' },
            { label: 'YUTUQ',      value: fmt(potentialWin), color: '#a78bfa' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', fontWeight: 700, letterSpacing: 0.3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color, marginTop: 1 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ══ 3. MINES GRIDI — TEPA ══ */}
      <div style={{
        flex: 1,
        padding: '14px 14px 10px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {!gameStatus && (
          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.22)', fontWeight: 600,
            marginBottom: 10, textAlign: 'center',
          }}>
            Pastdagi boshqaruv panelidan stavka kiriting va o'yinni boshlang
          </div>
        )}

        {/* Feedback */}
        {(err || msg) && (
          <div style={{
            marginBottom: 10,
            padding: '9px 14px', borderRadius: 10,
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
          width: '100%',
          maxWidth: 370,
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
        paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom) + 12px))',
        background: 'rgba(255,255,255,0.03)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}>
        {/* Stavka + Mina soni */}
        <div style={{ display: 'flex', gap: 9 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', fontWeight: 700, marginBottom: 5, letterSpacing: 0.4 }}>STAVKA (UZS)</div>
            <input
              type="number" inputMode="numeric"
              disabled={isActive || loading}
              value={betAmt}
              onChange={e => setBetAmt(e.target.value)}
              onBlur={() => {
                const v = parseFloat(betAmt);
                if (!v || v < 1000) setBetAmt('1000');
                else if (v > 10000000) setBetAmt('10000000');
                else setBetAmt(String(Math.round(v)));
              }}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.07)',
                border: '1.5px solid rgba(255,255,255,0.12)',
                borderRadius: 10, color: '#fff',
                fontSize: 16, fontWeight: 800, padding: '10px 11px',
                outline: 'none', WebkitAppearance: 'none',
                opacity: isActive ? 0.45 : 1,
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', fontWeight: 700, marginBottom: 5, letterSpacing: 0.4 }}>MINALAR SONI</div>
            <select
              disabled={isActive || loading}
              value={minesCount}
              onChange={e => setMinesCount(Number(e.target.value))}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.07)',
                border: '1.5px solid rgba(255,255,255,0.12)',
                borderRadius: 10, color: '#fff',
                fontSize: 14, fontWeight: 700, padding: '10px 11px',
                outline: 'none', WebkitAppearance: 'none', appearance: 'none',
                opacity: isActive ? 0.45 : 1,
              }}
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n} style={{ background: '#1a1a2e' }}>{n} mina</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tezkor tugmalar — faqat o'yin boshlanmagan paytda */}
        {!isActive && !isFinished && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[1000, 5000, 10000, 50000].map(v => (
              <button key={v} onClick={() => setBetAmt(String(v))} style={{
                flex: 1, padding: '7px 0', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.55)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>{v >= 1000 ? `${v/1000}K` : v}</button>
            ))}
          </div>
        )}

        {/* Asosiy tugma */}
        {!gameStatus || isFinished ? (
          <button
            disabled={loading}
            onClick={isFinished ? resetGame : startGame}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              fontSize: 15, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer',
              color: '#fff', opacity: loading ? 0.5 : 1,
              background: isFinished
                ? 'linear-gradient(135deg,#6366f1,#4f46e5)'
                : 'linear-gradient(135deg,#7c3aed,#5b21b6)',
              boxShadow: '0 0 20px rgba(124,58,237,0.3)',
            }}
          >
            {loading ? '⏳ Yuklanmoqda...' : isFinished ? "🔄 Yangi o'yin" : "🚀 O'yinni boshlash"}
          </button>
        ) : (
          <button
            disabled={loading || openedCount === 0}
            onClick={cashOut}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              fontSize: 15, fontWeight: 900,
              cursor: (loading || openedCount === 0) ? 'not-allowed' : 'pointer',
              color: '#000', opacity: (loading || openedCount === 0) ? 0.4 : 1,
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              boxShadow: '0 0 22px rgba(34,197,94,0.35)',
            }}
          >
            {loading ? '⏳ ...' : `💰 YECHISH — ${fmt(potentialWin)} UZS (${fmtM(currentMult)})`}
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
        select option { background: #1a1a2e; }
      `}</style>
    </div>
  );
}
