import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = (process.env.REACT_APP_BACKEND_URL || '') + '/api';

const MINE = '💣';
const GEM  = '💎';

export default function MinesGame({ user }) {
  const navigate = useNavigate();

  const [balance, setBalance]       = useState(user?.balance_uzs || 0);
  const [betAmt, setBetAmt]         = useState('1000');
  const [minesCount, setMinesCount] = useState(3);
  const [game, setGame]             = useState(null);
  const [cells, setCells]           = useState(Array(25).fill(null)); // null | 'gem' | 'mine'
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState('');
  const [msg, setMsg]               = useState('');
  const [revealedMines, setRevealedMines] = useState([]);

  const fmt  = n => Math.round(n).toLocaleString('uz-UZ').replace(/,/g, ' ');
  const fmtM = m => `${Number(m).toFixed(2)}x`;

  const showErr = (txt, ms = 2500) => {
    setErr(txt);
    setTimeout(() => setErr(''), ms);
  };

  const showMsg = (txt, ms = 2500) => {
    setMsg(txt);
    setTimeout(() => setMsg(''), ms);
  };

  // Resume active game on mount
  useEffect(() => {
    if (!user?.telegram_id) return;
    axios.get(`${API_URL}/mines/current/${user.telegram_id}`)
      .then(res => {
        const g = res.data.game;
        if (!g) return;
        setGame(g);
        const opened = g.opened_cells || [];
        const newCells = Array(25).fill(null);
        opened.forEach(i => { newCells[i] = 'gem'; });
        setCells(newCells);
      })
      .catch(() => {});
  }, [user?.telegram_id]);

  const startGame = async () => {
    const amt = parseFloat(betAmt);
    if (!amt || amt < 1000) { showErr('Minimal stavka: 1 000 UZS'); return; }
    if (amt > balance)      { showErr("Balans yetarli emas"); return; }
    setLoading(true); setErr(''); setMsg('');
    try {
      const res = await axios.post(`${API_URL}/mines/start`, {
        telegram_id: user.telegram_id,
        bet_amount: amt,
        mines_count: minesCount,
      });
      setGame(res.data);
      setCells(Array(25).fill(null));
      setRevealedMines([]);
      setBalance(b => b - amt);
    } catch (ex) {
      showErr(ex.response?.data?.detail || 'Xatolik yuz berdi');
    } finally { setLoading(false); }
  };

  const clickCell = useCallback(async (idx) => {
    if (!game || game.status !== 'active') return;
    if (cells[idx] !== null) return;
    if (loading) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/mines/click`, {
        telegram_id: user.telegram_id,
        cell_index: idx,
      });
      const d = res.data;
      if (d.result === 'lost') {
        const newCells = [...cells];
        newCells[idx] = 'mine';
        setCells(newCells);
        setRevealedMines(d.mine_positions || []);
        setGame(prev => ({ ...prev, status: 'lost' }));
        showErr(`💣 Mina! O'yin tugadi. -${fmt(game.bet_amount)} UZS`, 4000);
      } else if (d.result === 'won') {
        const newCells = [...cells];
        newCells[idx] = 'gem';
        setCells(newCells);
        setRevealedMines(d.mine_positions || []);
        setGame(prev => ({ ...prev, status: 'won', current_multiplier: d.current_multiplier }));
        setBalance(b => b + d.winnings);
        showMsg(`🏆 Barcha xavfsiz kataklar! +${fmt(d.winnings)} UZS`, 4000);
      } else {
        const newCells = [...cells];
        newCells[idx] = 'gem';
        setCells(newCells);
        setGame(prev => ({ ...prev, opened_cells: d.opened_cells, current_multiplier: d.current_multiplier }));
      }
    } catch (ex) {
      showErr(ex.response?.data?.detail || 'Xatolik');
    } finally { setLoading(false); }
  }, [game, cells, loading, user]);

  const cashOut = async () => {
    if (!game || game.status !== 'active') return;
    if ((game.opened_cells || []).length === 0) { showErr('Kamida bitta katak oching'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/mines/cashout`, {
        telegram_id: user.telegram_id,
      });
      setRevealedMines(res.data.mine_positions || []);
      setGame(prev => ({ ...prev, status: 'won' }));
      setBalance(b => b + res.data.winnings);
      showMsg(`✅ Yechdingiz! +${fmt(res.data.winnings)} UZS (${fmtM(res.data.multiplier)})`, 4000);
    } catch (ex) {
      showErr(ex.response?.data?.detail || 'Xatolik');
    } finally { setLoading(false); }
  };

  const resetGame = () => {
    setGame(null);
    setCells(Array(25).fill(null));
    setRevealedMines([]);
    setErr(''); setMsg('');
  };

  const isActive    = game?.status === 'active';
  const isFinished  = game && game.status !== 'active';
  const openedCount = (game?.opened_cells || []).length;
  const currentMult = game ? parseFloat(game.current_multiplier || 1) : 1;
  const potentialWin = game ? Math.round(parseFloat(game.bet_amount) * currentMult) : 0;

  return (
    <>
      <style>{`
        .mg-root {
          display: flex;
          flex-direction: column;
          min-height: 100dvh;
          background: #0a0f1e;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding-bottom: 80px;
        }
        .mg-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          padding-top: max(48px, calc(env(safe-area-inset-top) + 12px));
          background: rgba(255,255,255,0.03);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .mg-back {
          width: 36px; height: 36px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 16px;
          -webkit-tap-highlight-color: transparent;
        }
        .mg-title { font-size: 18px; font-weight: 800; letter-spacing: 1px; }
        .mg-balance {
          font-size: 13px; font-weight: 700;
          color: #fbbf24;
          background: rgba(251,191,36,0.1);
          border: 1px solid rgba(251,191,36,0.2);
          border-radius: 20px;
          padding: 4px 12px;
        }

        /* Controls */
        .mg-controls {
          padding: 14px 16px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .mg-row { display: flex; gap: 10px; align-items: center; }
        .mg-label { font-size: 11px; color: rgba(255,255,255,0.4); font-weight: 600; margin-bottom: 4px; letter-spacing: 0.5px; }
        .mg-input-wrap { flex: 1; }
        .mg-input {
          width: 100%; box-sizing: border-box;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: #fff;
          font-size: 16px; font-weight: 800;
          padding: 10px 12px;
          outline: none;
          -webkit-appearance: none;
        }
        .mg-input::-webkit-outer-spin-button,
        .mg-input::-webkit-inner-spin-button { -webkit-appearance: none; }
        .mg-input[type=number] { -moz-appearance: textfield; }
        .mg-select {
          width: 100%; box-sizing: border-box;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: #fff;
          font-size: 15px; font-weight: 700;
          padding: 10px 12px;
          outline: none;
          -webkit-appearance: none;
          appearance: none;
        }
        .mg-select option { background: #1a1a2e; }
        .mg-quick { display: flex; gap: 6px; }
        .mg-quick-btn {
          flex: 1;
          padding: 6px 0;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.6);
          font-size: 11px; font-weight: 700;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .mg-start-btn {
          width: 100%; padding: 14px;
          border-radius: 12px; border: none;
          font-size: 15px; font-weight: 900;
          cursor: pointer; letter-spacing: 0.5px;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: opacity 0.15s;
        }
        .mg-cashout-btn {
          width: 100%; padding: 14px;
          border-radius: 12px; border: none;
          font-size: 15px; font-weight: 900;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #000;
          box-shadow: 0 0 20px rgba(34,197,94,0.35);
          transition: opacity 0.15s;
        }

        /* Stats bar */
        .mg-stats {
          display: flex;
          gap: 0;
          padding: 10px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .mg-stat {
          flex: 1;
          text-align: center;
        }
        .mg-stat-label { font-size: 10px; color: rgba(255,255,255,0.3); font-weight: 600; }
        .mg-stat-value { font-size: 14px; font-weight: 800; color: #fff; margin-top: 2px; }

        /* Grid */
        .mg-grid-wrap { padding: 14px 16px; flex: 1; }
        .mg-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          max-width: 400px;
          margin: 0 auto;
        }
        .mg-cell {
          aspect-ratio: 1;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: clamp(18px, 5vw, 24px);
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.05);
          transition: transform 0.12s, background 0.15s;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          user-select: none;
          position: relative;
          overflow: hidden;
        }
        .mg-cell:active { transform: scale(0.92); }
        .mg-cell.active-cell:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
        .mg-cell.gem {
          background: linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.12));
          border-color: rgba(16,185,129,0.4);
          animation: popIn 0.2s ease;
        }
        .mg-cell.mine {
          background: linear-gradient(135deg, rgba(239,68,68,0.25), rgba(185,28,28,0.15));
          border-color: rgba(239,68,68,0.5);
          animation: popIn 0.2s ease;
        }
        .mg-cell.revealed-mine {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.25);
          opacity: 0.7;
        }
        .mg-cell.disabled { cursor: default; }
        @keyframes popIn {
          0%   { transform: scale(0.7); opacity: 0.5; }
          60%  { transform: scale(1.1); }
          100% { transform: scale(1);   opacity: 1; }
        }

        /* Feedback */
        .mg-feedback {
          margin: 0 16px 12px;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px; font-weight: 700;
          text-align: center;
        }
        .mg-feedback.err  { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.25); }
        .mg-feedback.succ { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.25); }
      `}</style>

      <div className="mg-root">
        {/* Header */}
        <div className="mg-header">
          <div className="mg-back" onClick={() => navigate('/casino')}>←</div>
          <div className="mg-title">💣 MINES</div>
          <div className="mg-balance">{fmt(balance)} UZS</div>
        </div>

        {/* Controls */}
        <div className="mg-controls">
          <div className="mg-row">
            <div className="mg-input-wrap">
              <div className="mg-label">STAVKA (UZS)</div>
              <input
                className="mg-input"
                type="number"
                inputMode="numeric"
                disabled={isActive}
                value={betAmt}
                onChange={e => setBetAmt(e.target.value)}
                onBlur={() => {
                  const v = parseFloat(betAmt);
                  if (!v || v < 1000) setBetAmt('1000');
                  else if (v > 10000000) setBetAmt('10000000');
                  else setBetAmt(String(Math.round(v)));
                }}
              />
            </div>
            <div className="mg-input-wrap">
              <div className="mg-label">MINALAR SONI</div>
              <select
                className="mg-select"
                disabled={isActive}
                value={minesCount}
                onChange={e => setMinesCount(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n} mina</option>
                ))}
              </select>
            </div>
          </div>

          {!isActive && (
            <div className="mg-quick">
              {[1000, 5000, 10000, 50000].map(v => (
                <button key={v} className="mg-quick-btn" onClick={() => setBetAmt(String(v))}>
                  {v >= 1000 ? `${v/1000}K` : v}
                </button>
              ))}
            </div>
          )}

          {!game || isFinished ? (
            <button
              className="mg-start-btn"
              disabled={loading}
              onClick={isFinished ? resetGame : startGame}
              style={{
                background: isFinished
                  ? 'linear-gradient(135deg,#6366f1,#4f46e5)'
                  : 'linear-gradient(135deg,#7c3aed,#5b21b6)',
                color: '#fff',
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? '...' : isFinished ? '🔄 Yangi o\'yin' : '🚀 O\'yinni boshlash'}
            </button>
          ) : (
            <button
              className="mg-cashout-btn"
              disabled={loading || openedCount === 0}
              onClick={cashOut}
              style={{ opacity: (loading || openedCount === 0) ? 0.45 : 1 }}
            >
              {loading ? '...' : `💰 YECHISH — ${fmt(potentialWin)} UZS (${fmtM(currentMult)})`}
            </button>
          )}
        </div>

        {/* Stats */}
        {game && (
          <div className="mg-stats">
            <div className="mg-stat">
              <div className="mg-stat-label">STAVKA</div>
              <div className="mg-stat-value">{fmt(game.bet_amount)}</div>
            </div>
            <div className="mg-stat">
              <div className="mg-stat-label">OCHILGAN</div>
              <div className="mg-stat-value" style={{ color: '#4ade80' }}>{openedCount}</div>
            </div>
            <div className="mg-stat">
              <div className="mg-stat-label">KOEFFITSIYENT</div>
              <div className="mg-stat-value" style={{ color: '#fbbf24' }}>{fmtM(currentMult)}</div>
            </div>
            <div className="mg-stat">
              <div className="mg-stat-label">POTENTSIAL</div>
              <div className="mg-stat-value" style={{ color: '#a78bfa' }}>{fmt(potentialWin)}</div>
            </div>
          </div>
        )}

        {/* Feedback */}
        {err && <div className="mg-feedback err">{err}</div>}
        {msg && !err && <div className="mg-feedback succ">{msg}</div>}

        {/* Grid */}
        <div className="mg-grid-wrap">
          <div className="mg-grid">
            {cells.map((state, idx) => {
              const isMineRevealed = revealedMines.includes(idx) && state !== 'mine';
              let cellClass = 'mg-cell';
              let content = null;

              if (state === 'gem') {
                cellClass += ' gem disabled';
                content = GEM;
              } else if (state === 'mine') {
                cellClass += ' mine disabled';
                content = MINE;
              } else if (isMineRevealed) {
                cellClass += ' revealed-mine disabled';
                content = MINE;
              } else if (isActive && !loading) {
                cellClass += ' active-cell';
                content = null;
              } else {
                cellClass += ' disabled';
                content = null;
              }

              return (
                <div
                  key={idx}
                  className={cellClass}
                  onClick={() => isActive && state === null && !isMineRevealed && clickCell(idx)}
                >
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
