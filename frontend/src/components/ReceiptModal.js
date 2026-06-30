import React, { useEffect } from 'react';
import { ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, Gamepad2 } from 'lucide-react';

export const _txFmtDate = (s) => {
  if (!s) return '—';
  const cleaned = s.replace('T', ' ');
  const [datePart, timePart] = cleaned.split(' ');
  if (!datePart) return s;
  const [y, mo, d] = datePart.split('-');
  return `${d}.${mo}.${y} ${timePart || ''}`.trim();
};

export const _txFmtDateShort = (s) => {
  if (!s) return '—';
  const cleaned = s.replace('T', ' ');
  const [datePart, timePart] = cleaned.split(' ');
  if (!datePart) return s;
  const [y, mo, d] = datePart.split('-');
  return `${d}.${mo}.${y} ${(timePart || '').slice(0, 5)}`;
};

export const _txGetPlatformBg = (tx) => {
  const m = (tx.method || '').toLowerCase();
  if (m === 'internal_sent') return 'rgba(239,68,68,0.12)';
  if (m === 'internal_received') return 'rgba(34,197,94,0.12)';
  if (m === 'balance') return 'rgba(34,197,94,0.12)';
  if (m.includes('1xbet')) return 'rgba(59,130,246,0.15)';
  if (m === 'aviator') return 'rgba(139,92,246,0.18)';
  if (m === 'mines') return 'rgba(249,115,22,0.18)';
  return 'rgba(250,204,21,0.12)';
};

export const _txGetAmountSign = (tx) => {
  const m = (tx.method || '').toLowerCase();
  const t = (tx.type || '').toLowerCase();
  if (m === 'internal_sent') return { sign: '−', color: 'text-red-400', amount: tx.total_deducted || tx.amount };
  if (m === 'internal_received') return { sign: '+', color: 'text-green-400', amount: tx.amount };
  if (t === 'casino_bet') return { sign: '−', color: 'text-red-400', amount: tx.amount };
  if (t === 'deposit') return { sign: '+', color: 'text-green-400', amount: tx.amount };
  return { sign: '−', color: 'text-red-400', amount: tx.amount };
};

export const _txGetStatusLabel = (status, lang) => {
  const s = (status || '').toLowerCase();
  if (s === 'approved' || s === 'completed') return { label: lang === 'uz' ? 'Muvaffaqiyatli' : 'Успешно', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
  if (s === 'pending') return { label: lang === 'uz' ? 'Kutilmoqda' : 'В ожидании', color: '#facc15', bg: 'rgba(250,204,21,0.12)' };
  if (s === 'lost') return { label: lang === 'uz' ? 'Yutqazildi' : 'Проигрыш', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  return { label: lang === 'uz' ? 'Rad etildi' : 'Отклонено', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
};

const ReceiptModal = ({ tx, onClose, lang = 'uz' }) => {
  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.touchAction = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.documentElement.style.overflow = '';
      document.documentElement.style.touchAction = '';
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, []);

  const m = (tx.method || '').toLowerCase();
  const isP2PSent     = m === 'internal_sent';
  const isP2PReceived = m === 'internal_received';
  const isP2P         = isP2PSent || isP2PReceived;
  const isCasino      = m === 'aviator' || m === 'mines';
  const isDeposit     = !isP2P && (tx.type || '').toLowerCase() === 'deposit';
  const isWithdraw    = !isP2P && !isDeposit;
  const { sign, color: amtColor, amount: displayAmount } = _txGetAmountSign(tx);
  const statusInfo = _txGetStatusLabel(tx.status, lang);
  const isCasinoBet = (tx.type || '').toLowerCase() === 'casino_bet';
  const isWin = isCasino && isDeposit && !isCasinoBet;
  const isLoss = isCasino && !isDeposit && !isCasinoBet;

  const platform =
    m === 'aviator' ? '✈️ Aviator' :
    m === 'mines'   ? '💣 Mines' :
    m.includes('1xbet') ? '1xbet' :
    m.includes('mostbet') ? 'Mostbet' :
    m === 'balance' ? 'BuraPay' : '—';

  const partnerName  = isP2PSent ? tx.receiver_name : tx.sender_name;
  const partnerBotId = isP2PSent ? tx.receiver_bot_id : tx.sender_bot_id;
  const shortId = tx.short_id || (tx.id || '').slice(-8).toUpperCase();

  const typeLabel = () => {
    if (isP2PSent)     return lang === 'uz' ? "Foydalanuvchiga o'tkazma" : 'Перевод пользователю';
    if (isP2PReceived) return lang === 'uz' ? 'Foydalanuvchidan qabul'   : 'Получено от пользователя';
    if (isCasinoBet)        return lang === 'uz' ? '🎮 Casino stavkasi'  : '🎮 Ставка в казино';
    if (isCasino && isWin)  return lang === 'uz' ? '🏆 Casino yutug\'i'  : '🏆 Выигрыш в казино';
    if (isCasino && isLoss) return lang === 'uz' ? '❌ Casino yutqazish' : '❌ Проигрыш в казино';
    if (isDeposit)     return lang === 'uz' ? "Hisobni to'ldirish" : 'Пополнение счёта';
    return                    lang === 'uz' ? 'Pul yechish' : 'Вывод средств';
  };

  const multiplierLabel = lang === 'uz' ? '📈 Koeffitsient' : '📈 Коэффициент';
  const playerIdLabel   = lang === 'uz' ? "🆔 O'yinchi ID" : '🆔 ID игрока';

  const Row = ({ label, value, valueClass = 'text-white font-semibold' }) => (
    <div className="flex justify-between items-start gap-3 py-2.5"
      style={{ borderBottom: '1px dashed rgba(255,255,255,0.07)' }}>
      <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-xs text-right ${valueClass}`}>{value}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end justify-center overflow-hidden select-none"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', touchAction: 'none', overscrollBehavior: 'none' }}
      onClick={onClose}
      onTouchMove={e => { e.preventDefault(); e.stopPropagation(); }}
      onWheel={e => e.stopPropagation()}
    >
      <div
        className="relative w-full max-w-md rounded-t-3xl overflow-y-auto"
        style={{ background: '#0d1225', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none', maxHeight: '90vh', overscrollBehavior: 'contain', touchAction: 'pan-y' }}
        onClick={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        onWheel={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>

        {/* Receipt header */}
        <div className="px-5 pt-3 pb-4 text-center" style={{ borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: _txGetPlatformBg(tx) }}>
            {isP2PSent     && <ArrowRightLeft size={22} className="text-red-400" />}
            {isP2PReceived && <ArrowRightLeft size={22} className="text-green-400" />}
            {isCasinoBet        && <Gamepad2 size={22} className="text-amber-400" />}
            {isCasino && isWin  && <Gamepad2 size={22} className="text-green-400" />}
            {isCasino && isLoss && <Gamepad2 size={22} className="text-red-400" />}
            {!isCasino && !isCasinoBet && isDeposit && !isP2P && <ArrowDownToLine size={22} className="text-green-400" />}
            {!isCasino && !isCasinoBet && isWithdraw && !isP2P && <ArrowUpFromLine size={22} className="text-red-400" />}
          </div>
          <p className="text-xs text-slate-500 mb-0.5">{lang === 'uz' ? 'Chek raqami' : 'Номер чека'}</p>
          <p className="text-sm font-bold text-yellow-400 font-mono tracking-wider">#{shortId}</p>
        </div>

        {/* Receipt body */}
        <div className="px-5 py-2">
          <Row label={lang === 'uz' ? '🕒 Sana va vaqt' : '🕒 Дата и время'} value={_txFmtDate(tx.created_at)} />
          <Row
            label={lang === 'uz' ? '🔄 Turi' : '🔄 Тип'}
            value={typeLabel()}
          />
          {!isP2P && <Row label={lang === 'uz' ? '🎮 Platforma' : '🎮 Платформа'} value={platform} />}
          {!isP2P && tx.wallet_number && (
            <Row
              label={isCasino ? multiplierLabel : playerIdLabel}
              value={tx.wallet_number}
              valueClass={isCasino && isWin ? 'text-green-400 font-bold' : 'text-white font-semibold'}
            />
          )}
          {isP2P && partnerBotId && (
            <Row
              label={isP2PSent ? (lang === 'uz' ? '🆔 Kimga' : '🆔 Кому') : (lang === 'uz' ? '🆔 Kimdan' : '🆔 От кого')}
              value={partnerBotId}
              valueClass="text-yellow-400 font-bold font-mono"
            />
          )}
          {isP2P && partnerName && <Row label={lang === 'uz' ? '👤 Foydalanuvchi' : '👤 Пользователь'} value={partnerName} />}
          {isP2PSent && tx.commission > 0 && (
            <Row
              label={lang === 'uz' ? 'Komissiya (3%)' : 'Комиссия (3%)'}
              value={`${Number(tx.commission).toLocaleString('uz-UZ')} UZS`}
              valueClass="text-yellow-400 font-semibold text-xs"
            />
          )}

          {/* Amount */}
          <div className="flex justify-between items-center py-3 mt-1" style={{ borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
            <span className="text-sm text-slate-300 font-semibold">{lang === 'uz' ? '💰 Summa' : '💰 Сумма'}</span>
            <span className={`text-xl font-bold ${amtColor}`}>
              {sign}{Number(displayAmount || 0).toLocaleString('uz-UZ')} <span className="text-sm">{tx.currency || 'UZS'}</span>
            </span>
          </div>

          {/* Status */}
          <div className="flex justify-between items-center py-2.5 mb-2" style={{ borderTop: '1px dashed rgba(255,255,255,0.07)' }}>
            <span className="text-xs text-slate-500">{lang === 'uz' ? '🟢 Status' : '🟢 Статус'}</span>
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ color: statusInfo.color, background: statusInfo.bg }}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Close button */}
        <div className="px-5 pb-6 pt-2">
          <button onClick={onClose} className="w-full py-3.5 rounded-2xl font-bold text-sm text-slate-300"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {lang === 'uz' ? 'Yopish' : 'Закрыть'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
