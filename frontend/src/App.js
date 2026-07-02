import React, { useEffect, useState } from "react";
import ReceiptModal, { _txFmtDate, _txFmtDateShort, _txGetPlatformBg, _txGetAmountSign, _txGetStatusLabel } from "./components/ReceiptModal";
import casinoImg from "./casino.png";
import AviatorGame from "./components/AviatorGame";
import MinesGame from "./components/MinesGame";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { 
  Wallet, 
  ArrowUpRight, 
  History, 
  Settings, 
  ShieldCheck, 
  CreditCard,
  ChevronRight,
  LogOut,
  Menu,
  X,
  UserCheck,
  Users,
  Copy,
  Calendar,
  Search,
  LayoutDashboard,
  List,
  Edit,
  Globe,
  CheckCircle2,
  Megaphone,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowDownUp,
  ArrowRightLeft,
  Key,
  Trash2,
  Plus,
  Coins,
  Shield,
  Gamepad2,
  ChevronDown,
  Home as HomeIcon,
  User,
  Star
} from "lucide-react";
import axios from "axios";
import translations from "./translations";

// ── Axios Global Config & Interceptors ────────────────────────────────────────
axios.defaults.timeout = 30000;

let _currentLang = 'uz';
export const setAxiosLang = (l) => { _currentLang = l; };

axios.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail;
    const msg = typeof detail === "string" ? detail : null;
    const t = translations[_currentLang];

    if (status === 429) {
      toast.error(_currentLang === 'ru' ? "Слишком много запросов. Подождите ⏳" : "Juda ko'p so'rov yuborildi. Biroz kuting ⏳");
    } else if (status === 422) {
      toast.error(msg || (_currentLang === 'ru' ? "Данные отправлены в неверном формате" : "Ma'lumot noto'g'ri formatda yuborildi"));
    } else if (status >= 500) {
      toast.error(_currentLang === 'ru' ? "Временный сбой системы. Попробуйте снова 🔄" : "Tizimda vaqtincha uzilish yuz berdi. Qayta urinib ko'ring 🔄");
    } else if (!error.response) {
      if (error.code === "ECONNABORTED") {
        toast.error(_currentLang === 'ru' ? "Время запроса истекло. Проверьте интернет 📡" : "So'rov vaqti tugadi. Internet aloqani tekshiring 📡");
      } else if (error.message && error.message.includes("Network")) {
        toast.error(_currentLang === 'ru' ? "Ошибка сети. Нет подключения к серверу 🔌" : "Tarmoq xatosi. Serverga ulanib bo'lmadi 🔌");
      }
    }
    return Promise.reject(error);
  }
);

// Config
const API_URL = process.env.REACT_APP_BACKEND_URL + "/api";

// Superadmin — always has full admin access regardless of DB value
const SUPERADMIN_ID = 8321879273;
const isSuperAdmin = (id) => Number(id) === SUPERADMIN_ID || String(id) === String(SUPERADMIN_ID);

// Telegram Utils
const tg = window.Telegram?.WebApp;


// Components
const Button = ({ children, variant = "primary", className = "", ...props }) => {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-gold-hover shadow-[0_0_15px_rgba(250,204,21,0.3)]",
    secondary: "bg-secondary text-secondary-foreground hover:bg-slate-700 border border-slate-700",
    ghost: "bg-transparent text-slate-400 hover:text-white hover:bg-white/5",
    destructive: "bg-red-500/10 text-red-500 hover:bg-red-500/20"
  };
  
  return (
    <button 
      className={`px-4 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = "", highlight = false }) => (
  <div className={`p-5 rounded-2xl relative overflow-hidden ${
    highlight 
      ? "bg-gradient-to-br from-midnight-light to-midnight-lighter border border-gold/20 shadow-lg" 
      : "bg-midnight-light border border-slate-800 shadow-md"
    } ${className}`}>
    {children}
  </div>
);

const Input = ({ className = "", ...props }) => (
  <input 
    className={`w-full bg-midnight border border-slate-700 text-white placeholder:text-slate-500 focus:border-gold focus:ring-1 focus:ring-gold rounded-xl h-12 px-4 transition-all outline-none ${className}`}
    {...props}
  />
);

const ROOT_PATHS = ['/', '/transfers', '/deposit', '/reports', '/profile', '/profil', '/admin', '/balance-deposit'];

const BottomNav = ({ isAdmin, lang }) => {
  const location = useLocation();
  const p = location.pathname;
  const t = translations[lang];

  const isRootPage = ROOT_PATHS.includes(p);
  if (!isRootPage) return null;
  if (p === '/admin' && !isAdmin) return null;

  const isActive = (paths) => paths.includes(p);

  const navItems = [
    { icon: <HomeIcon size={22} />, label: t.home, path: "/", match: ["/"] },
    { icon: <ArrowDownUp size={22} />, label: t.otkazmalar, path: "/transfers", match: ["/transfers", "/deposit"] },
    { icon: <History size={22} />, label: t.reports, path: "/reports", match: ["/reports"] },
    { icon: <User size={22} />, label: t.profile, path: "/profile", match: ["/profile", "/profil"] },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[10000]" style={{ background: 'rgba(2,6,23,0.92)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-around px-2 pt-2 ios-safe-bottom" style={{ paddingBottom: 'max(var(--tg-safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px), 12px)' }}>
        {navItems.map((item) => {
          const active = isActive(item.match);
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-1 min-w-[56px] py-1 transition-all duration-200"
            >
              <div className={`transition-all duration-200 ${active ? 'text-yellow-400 scale-110' : 'text-slate-500'}`}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-semibold transition-colors duration-200 ${active ? 'text-yellow-400' : 'text-slate-600'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

// Pages
const Home = ({ user, lang, setLang }) => {
  const [history, setHistory] = useState([]);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const navigate = useNavigate();
  const t = translations[lang];

  useEffect(() => {
    if(user?.telegram_id) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const histRes = await axios.get(`${API_URL}/transactions/${user.telegram_id}`);
      setHistory(histRes.data);
    } catch (e) { console.error(e); }
  };

  const toggleLang = async () => {
      const newLang = lang === 'uz' ? 'ru' : 'uz';
      setLang(newLang);
      try {
          await axios.post(`${API_URL}/user/language`, {
              telegram_id: user.telegram_id,
              language: newLang
          });
          toast.success(translations[newLang].lang_changed);
      } catch(e) {}
  };

  const hasCard = user?.wallets?.some(w => w.type === 'uzcard' || w.type === 'humo') || user?.has_card;
  const balanceUZS = user?.balance_uzs ?? 0;
  const balanceUSD = user?.balance_usd ?? 0;

  if (!user) return <div className="p-8 text-center text-slate-500">...</div>;

  return (
    <div className="pb-28 space-y-0 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Top Header */}
      <div className="flex justify-between items-center px-4 pb-2" style={{ paddingTop: 'calc(var(--sa-top) + 12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-black font-bold text-lg shadow-lg">
            {user.first_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="user-greeting text-slate-400">{t.hello}</p>
            <h1 className="user-name-header">{user.first_name}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleLang} className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-base">
            {lang === 'uz' ? '🇺🇿' : '🇷🇺'}
          </button>
        </div>
      </div>

      {/* Bank Balance Card */}
      <div className="mx-4 mt-2 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #0f1420 50%, #1a2a1a 100%)", border: "1px solid rgba(250,204,21,0.2)" }}>
        <div className="p-5">
          <div className="flex justify-between items-start mb-1">
            <p className="text-xs text-slate-400 uppercase tracking-widest">{t.total_balance}</p>
            <button onClick={() => setBalanceVisible(v => !v)} className="text-slate-500 text-xs">
              {balanceVisible ? '👁' : '🙈'}
            </button>
          </div>

          {/* UZS Balance — main */}
          <div className="mt-1 mb-3">
            <div className="flex items-end gap-2">
              <span className="balance-amount text-white">
                {balanceVisible ? (balanceUZS).toLocaleString('uz-UZ') : '••••••'}
              </span>
              <span className="text-base font-semibold text-yellow-400 mb-0.5 flex-shrink-0">UZS</span>
            </div>
            {balanceUZS === 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                {t.no_balance}
              </p>
            )}
          </div>

          {/* UZS Balance — secondary pill */}
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2 w-fit">
            <span className="text-xs text-slate-400">UZS</span>
            <span className="text-sm font-bold text-white">
              {balanceVisible ? balanceUZS.toLocaleString('uz-UZ') : '••••'}
            </span>
          </div>

          {/* Card footer info */}
          <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-xs text-slate-400">{user.bot_id || `ID: ${user.internal_id || user.telegram_id}`}</span>
            </div>
            <div className="flex gap-1">
              <div className="w-5 h-5 rounded-full bg-yellow-500 opacity-80 -mr-2"></div>
              <div className="w-5 h-5 rounded-full bg-red-500 opacity-80"></div>
            </div>
          </div>
        </div>
      </div>



    </div>
  );
};

const Otkazmalar = ({ user, lang }) => {
  const navigate = useNavigate();
  const t = translations[lang];

  return (
    <div className="px-4 pb-28 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto" style={{ paddingTop: 'calc(var(--sa-top) + 12px)', height: '100vh' }}>
      <h1 className="text-2xl font-bold">{t.otkazmalar}</h1>

      {/* Mostbet */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <span className="text-xs font-extrabold text-yellow-400">MB</span>
          </div>
          <h2 className="text-lg font-bold text-white">Mostbet</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/mostbet-deposit')} className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 active:scale-95 transition-all">
            <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center"><ArrowDownToLine size={20} className="text-yellow-400" /></div>
            <span className="text-sm font-bold text-yellow-400">{t.deposit}</span>
          </button>
          <button onClick={() => navigate('/mostbet-withdraw')} className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-slate-700/30 border border-slate-700/50 hover:bg-slate-700/50 active:scale-95 transition-all">
            <div className="w-10 h-10 rounded-full bg-slate-600/50 flex items-center justify-center"><ArrowUpFromLine size={20} className="text-slate-300" /></div>
            <span className="text-sm font-bold text-slate-300">{t.withdraw}</span>
          </button>
        </div>
      </div>

      {/* 1xbet */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <span className="text-xs font-extrabold text-blue-400">1X</span>
          </div>
          <h2 className="text-lg font-bold text-white">1xbet</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/1xbet-deposit')} className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 active:scale-95 transition-all">
            <div className="w-10 h-10 rounded-full bg-blue-400/20 flex items-center justify-center"><ArrowDownToLine size={20} className="text-blue-400" /></div>
            <span className="text-sm font-bold text-blue-400">{t.deposit}</span>
          </button>
          <button onClick={() => navigate('/1xbet-withdraw')} className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-slate-700/30 border border-slate-700/50 hover:bg-slate-700/50 active:scale-95 transition-all">
            <div className="w-10 h-10 rounded-full bg-slate-600/50 flex items-center justify-center"><ArrowUpFromLine size={20} className="text-slate-300" /></div>
            <span className="text-sm font-bold text-slate-300">{t.withdraw}</span>
          </button>
        </div>
      </div>

      {/* P2P — Foydalanuvchiga pul o'tkazish */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center">
            <Users size={16} className="text-green-400" />
          </div>
          <h2 className="text-lg font-bold text-white">{t.p2p_title}</h2>
        </div>
        <button
          onClick={() => navigate('/p2p-transfer')}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-green-500/10 border border-green-500/20 active:scale-95 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-400/20 flex items-center justify-center">
              <ArrowRightLeft size={18} className="text-green-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-green-400">{t.p2p_btn}</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-500" />
        </button>
      </div>

      {/* Kriptovalyuta sotib olish */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Coins size={16} className="text-purple-400" />
          </div>
          <h2 className="text-lg font-bold text-white">{t.crypto_title}</h2>
        </div>
        <button
          onClick={() => navigate('/crypto-buy')}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 active:scale-95 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-400/20 flex items-center justify-center">
              <Coins size={18} className="text-purple-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-purple-400">{t.crypto_btn}</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-500" />
        </button>
      </div>

      {/* Telegram Stars sotib olish */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Star size={16} className="text-yellow-400" />
          </div>
          <h2 className="text-lg font-bold text-white">{t.stars_title}</h2>
        </div>
        <button
          onClick={() => navigate('/stars-buy')}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 active:scale-95 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center">
              <Star size={18} className="text-yellow-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-yellow-400">{t.stars_btn}</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-500" />
        </button>
      </div>
    </div>
  );
};

// ── Crypto Buy Page ────────────────────────────────────────────────────────────
const CryptoBuy = ({ user, lang }) => {
  const navigate = useNavigate();
  const t = translations[lang];

  const EXCHANGES = ['Binance', 'Bybit', 'Trust Wallet', 'Tonkeeper'];
  const CRYPTO_TYPES = [
    { value: 'USDT', label: 'USDT (Tether)' },
    { value: 'TON',  label: 'TON (Toncoin)' },
    { value: 'BTC',  label: 'BTC (Bitcoin)' },
    { value: 'ETH',  label: 'ETH (Ethereum)' },
  ];

  const [exchange, setExchange]   = useState(EXCHANGES[0]);
  const [cryptoType, setCryptoType] = useState(CRYPTO_TYPES[0].value);
  const [address, setAddress]     = useState('');
  const [amount, setAmount]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);

  const balance   = user?.balance_uzs ?? 0;
  const amtNum    = parseFloat(amount) || 0;
  const notEnough = amtNum > 0 && amtNum > balance;
  const isValid   = amtNum >= 1000 && address.trim().length > 0 && !notEnough;

  const handleSubmit = async () => {
    if (!address.trim()) return toast.error(t.crypto_enter_address);
    if (!amtNum)         return toast.error(t.crypto_enter_amount);
    if (amtNum < 1000)   return toast.error(t.crypto_min_amount);
    if (notEnough)       return toast.error(t.crypto_insufficient);

    setLoading(true);
    try {
      await axios.post(`${API_URL}/crypto/buy`, {
        telegram_id:  user.telegram_id,
        exchange,
        crypto_type:  cryptoType,
        wallet_address: address.trim(),
        amount:       amtNum,
      });
      setDone(true);
      toast.success(t.crypto_success);
    } catch (e) {
      const msg = e?.response?.data?.detail;
      toast.error(msg || t.crypto_insufficient);
    } finally {
      setLoading(false);
    }
  };

  const selectCls = "w-full bg-midnight border border-slate-700 text-white rounded-xl h-12 px-4 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none";

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center space-y-5 animate-in fade-in">
      <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center">
        <CheckCircle2 size={40} className="text-purple-400" />
      </div>
      <h2 className="text-xl font-bold text-white">{t.crypto_success}</h2>
      <p className="text-slate-400 text-sm">{t.crypto_pending_info}</p>
      <button
        onClick={() => { setDone(false); setAddress(''); setAmount(''); }}
        className="w-full py-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold"
      >
        {lang === 'uz' ? 'Yangi so\'rov' : 'Новый запрос'}
      </button>
      <button onClick={() => navigate('/transfers')} className="text-slate-500 text-sm">{t.back}</button>
    </div>
  );

  return (
    <div className="px-4 pb-28 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto" style={{ paddingTop: 'calc(var(--sa-top) + 12px)', height: '100vh' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/transfers')} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
          <ChevronDown size={18} className="text-slate-400 rotate-90" />
        </button>
        <h1 className="text-xl font-bold text-white">{t.crypto_title}</h1>
      </div>

      {/* Balance card */}
      <div className="rounded-2xl p-4 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg,#1a1032 0%,#0f0a20 100%)', border: '1px solid rgba(168,85,247,0.25)' }}>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{t.crypto_balance_label}</p>
          <p className="text-2xl font-bold text-white">{balance.toLocaleString('uz-UZ')} <span className="text-base text-purple-400">UZS</span></p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center">
          <Coins size={24} className="text-purple-400" />
        </div>
      </div>

      {/* Exchange select */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300">{t.crypto_exchange_label}</label>
        <div className="relative">
          <select value={exchange} onChange={e => setExchange(e.target.value)} className={selectCls}>
            {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Crypto type select */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300">{t.crypto_type_label}</label>
        <div className="relative">
          <select value={cryptoType} onChange={e => setCryptoType(e.target.value)} className={selectCls}>
            {CRYPTO_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Wallet address */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300">{t.crypto_address_label}</label>
        <Input
          placeholder={t.crypto_address_placeholder}
          value={address}
          onChange={e => setAddress(e.target.value)}
          className="focus:border-purple-500 focus:ring-purple-500"
        />
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300">{t.crypto_amount_label}</label>
        <Input
          type="number"
          inputMode="numeric"
          placeholder={t.crypto_amount_placeholder}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className={`focus:border-purple-500 focus:ring-purple-500 ${notEnough ? 'border-red-500' : ''}`}
        />
        {notEnough && (
          <p className="text-xs text-red-400 flex items-center gap-1">⚠️ {t.crypto_insufficient}</p>
        )}
        {amtNum >= 1000 && !notEnough && (
          <p className="text-xs text-slate-500">{t.crypto_min_amount.replace('Minimal summa 1 000 UZS','').replace('Минимальная сумма 1 000 UZS','')}
            <span className="text-purple-400 font-semibold">{amtNum.toLocaleString()} UZS</span>
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !isValid}
        className={`w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 shadow-lg
          ${isValid
            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/30'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
      >
        {loading ? (lang === 'uz' ? 'Yuborilmoqda...' : 'Отправка...') : t.crypto_submit_btn}
      </button>
    </div>
  );
};

// ── Stars Buy Page ─────────────────────────────────────────────────────────────
const STAR_PRICE_UZS = 200;

const StarsBuy = ({ user, lang }) => {
  const navigate = useNavigate();
  const t = translations[lang];

  const [username, setUsername] = useState('');
  const [stars, setStars]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  const balance    = user?.balance_uzs ?? 0;
  const starsNum   = parseInt(stars, 10) || 0;
  const totalUzs   = starsNum * STAR_PRICE_UZS;
  const notEnough  = starsNum > 0 && totalUzs > balance;
  const isValid    = starsNum >= 1 && username.trim().length > 0 && !notEnough;

  const handleSubmit = async () => {
    if (!username.trim()) return toast.error(t.stars_enter_username);
    if (!starsNum)        return toast.error(t.stars_enter_amount);
    if (starsNum < 1)     return toast.error(t.stars_min_stars);
    if (notEnough)        return toast.error(t.stars_insufficient);

    setLoading(true);
    try {
      await axios.post(`${API_URL}/stars/buy`, {
        telegram_id: user.telegram_id,
        username:    username.trim(),
        stars_count: starsNum,
        amount_uzs:  totalUzs,
      });
      setDone(true);
      toast.success(t.stars_success);
    } catch (e) {
      const msg = e?.response?.data?.detail;
      toast.error(msg || t.stars_insufficient);
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center space-y-5 animate-in fade-in">
      <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center">
        <CheckCircle2 size={40} className="text-yellow-400" />
      </div>
      <h2 className="text-xl font-bold text-white">{t.stars_success}</h2>
      <p className="text-slate-400 text-sm">{t.stars_pending_info}</p>
      <button
        onClick={() => { setDone(false); setUsername(''); setStars(''); }}
        className="w-full py-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-bold"
      >
        {lang === 'uz' ? 'Yangi so\'rov' : 'Новый запрос'}
      </button>
      <button onClick={() => navigate('/transfers')} className="text-slate-500 text-sm">{t.back}</button>
    </div>
  );

  return (
    <div className="px-4 pb-28 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto" style={{ paddingTop: 'calc(var(--sa-top) + 12px)', height: '100vh' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/transfers')} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
          <ChevronDown size={18} className="text-slate-400 rotate-90" />
        </button>
        <h1 className="text-xl font-bold text-white">{t.stars_title}</h1>
      </div>

      {/* Balance card */}
      <div className="rounded-2xl p-4 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg,#1a1400 0%,#0f0d00 100%)', border: '1px solid rgba(234,179,8,0.25)' }}>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{t.stars_balance_label}</p>
          <p className="text-2xl font-bold text-white">{balance.toLocaleString('uz-UZ')} <span className="text-base text-yellow-400">UZS</span></p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center">
          <Star size={24} className="text-yellow-400" />
        </div>
      </div>

      {/* Price info */}
      <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 px-4 py-3 flex items-center gap-2">
        <Star size={14} className="text-yellow-400 flex-shrink-0" />
        <p className="text-xs text-yellow-300 font-semibold">{t.stars_price_per}</p>
      </div>

      {/* Username input */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300">{t.stars_username_label}</label>
        <Input
          placeholder={t.stars_username_placeholder}
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="focus:border-yellow-500 focus:ring-yellow-500"
        />
      </div>

      {/* Stars amount input */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300">{t.stars_amount_label}</label>
        <Input
          type="number"
          inputMode="numeric"
          placeholder={t.stars_amount_placeholder}
          value={stars}
          onChange={e => setStars(e.target.value)}
          className={`focus:border-yellow-500 focus:ring-yellow-500 ${notEnough ? 'border-red-500' : ''}`}
        />
        {notEnough && (
          <p className="text-xs text-red-400 flex items-center gap-1">⚠️ {t.stars_insufficient}</p>
        )}
        {starsNum >= 1 && !notEnough && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700">
            <span className="text-xs text-slate-400">{t.stars_total_label}</span>
            <span className="text-sm font-bold text-yellow-400">{totalUzs.toLocaleString('uz-UZ')} UZS</span>
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !isValid}
        className={`w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 shadow-lg
          ${isValid
            ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/30'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
      >
        {loading ? (lang === 'uz' ? 'Yuborilmoqda...' : 'Отправка...') : t.stars_submit_btn}
      </button>
    </div>
  );
};

// ── P2P Transfer Page ──────────────────────────────────────────────────────────
const P2PTransfer = ({ user, lang, setUser }) => {
  const navigate = useNavigate();
  const t = translations[lang];

  // "MR" + suffix → full bot ID
  const [idSuffix, setIdSuffix] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState(null);
  const [idError, setIdError] = useState('');
  const [amtError, setAmtError] = useState('');
  const [currentBalance, setCurrentBalance] = useState(user?.balance_uzs || 0);

  // Keep balance in sync with prop
  useEffect(() => { setCurrentBalance(user?.balance_uzs || 0); }, [user]);

  const amtNum = parseFloat(amount) || 0;
  const commission = amtNum >= 1000 ? Math.round(amtNum * 0.03) : 0;
  const totalDeducted = amtNum >= 1000 ? amtNum + commission : 0;
  const fullBotId = 'MR' + idSuffix.trim().toUpperCase();
  const isValid = idSuffix.trim().length > 0 && amtNum >= 1000;

  const handleIdChange = (val) => {
    // Strip any "MR" if user pastes full ID
    const clean = val.replace(/^MR/i, '');
    setIdSuffix(clean);
    if (idError) setIdError('');
  };

  const handleAmtChange = (val) => {
    setAmount(val);
    if (amtError) setAmtError('');
  };

  const handleSend = async () => {
    let valid = true;
    if (!idSuffix.trim()) { setIdError(t.p2p_enter_id); valid = false; }
    if (!amount || amtNum < 1000) { setAmtError(t.p2p_min_amount); valid = false; }
    if (!valid) return;

    setLoading(true);
    setIdError('');
    setAmtError('');
    try {
      const res = await axios.post(`${API_URL}/transfers/internal`, {
        sender_id: user?.telegram_id,
        receiver_bot_id: fullBotId,
        amount: amtNum,
      });
      setResult(res.data);
      setLoading(false);

      // ── 3-soniyalik sinxronizatsiya animatsiyasi ──────────────────────────
      setSyncing(true);
      setSyncProgress(0);

      // Progress bar: 0 → 100 over 3 seconds (every 30ms)
      let prog = 0;
      const progressTick = setInterval(() => {
        prog += 100 / (3000 / 30);
        setSyncProgress(Math.min(prog, 100));
      }, 30);

      // After exactly 3 seconds — fetch fresh balance then show success
      setTimeout(async () => {
        clearInterval(progressTick);
        setSyncProgress(100);
        try {
          const r = await axios.get(`${API_URL}/user/${user?.telegram_id}`);
          const freshBalance = r.data.balance_uzs || 0;
          setCurrentBalance(freshBalance);
          if (setUser) setUser(prev => prev ? { ...prev, ...r.data } : r.data);
        } catch (_) {}
        setSyncing(false);
        setDone(true);
      }, 3000);

    } catch (err) {
      const detail = err?.response?.data?.detail || '';
      if (detail.includes('topilmadi') || detail.includes('не найден'))
        setIdError(t.p2p_error_not_found);
      else if (detail.includes('yetarli') || detail.includes('средств'))
        setAmtError(t.p2p_error_insufficient);
      else if (detail.includes("o'zingizga") || detail.includes('себе'))
        setIdError(t.p2p_error_self);
      else if (detail.includes('MR bilan'))
        setIdError(t.p2p_error_format);
      else
        toast.error(detail || t.error);
    } finally {
      setLoading(false);
    }
  };

  // ── Syncing screen (3 seconds) ─────────────────────────────────────────────
  if (syncing && result) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center px-6 animate-in fade-in duration-300"
        style={{ background: '#080d18', paddingTop: 'calc(var(--sa-top) + 12px)' }}
      >
        {/* Pulsing ring animation */}
        <div className="relative flex items-center justify-center mb-8">
          <div className="absolute w-28 h-28 rounded-full animate-ping opacity-20"
            style={{ background: 'rgba(34,197,94,0.4)' }} />
          <div className="absolute w-22 h-22 rounded-full animate-pulse opacity-30"
            style={{ width: 88, height: 88, background: 'rgba(34,197,94,0.3)' }} />
          <div className="w-20 h-20 rounded-full flex items-center justify-center z-10"
            style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.5)' }}>
            <ArrowRightLeft size={32} className="text-green-400" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          {lang === 'uz' ? "Balanslar yangilanmoqda..." : "Синхронизация баланса..."}
        </h2>
        <p className="text-slate-500 text-sm text-center mb-10">
          {lang === 'uz'
            ? "Iltimos, kuting. Ikkala tomon balansi tekshirilmoqda"
            : "Пожалуйста, подождите. Проверяем балансы обеих сторон"}
        </p>

        {/* Animated progress bar */}
        <div className="w-full mb-3">
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${syncProgress}%`,
                background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                transition: 'width 0.03s linear',
              }}
            />
          </div>
        </div>

        {/* Syncing steps */}
        <div className="w-full space-y-2.5 mt-2">
          {[
            lang === 'uz' ? "✓ Tranzaksiya tasdiqlandi" : "✓ Транзакция подтверждена",
            lang === 'uz' ? (syncProgress >= 50 ? "✓ Yuboruvchi balansi yangilandi" : "⟳ Yuboruvchi balansi yangilanmoqda...") : (syncProgress >= 50 ? "✓ Баланс отправителя обновлён" : "⟳ Обновление баланса отправителя..."),
            lang === 'uz' ? (syncProgress >= 85 ? "✓ Qabul qiluvchi balansi yangilandi" : "⟳ Qabul qiluvchi balansi yangilanmoqda...") : (syncProgress >= 85 ? "✓ Баланс получателя обновлён" : "⟳ Обновление баланса получателя..."),
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2.5 px-1">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${step.startsWith('✓') ? 'bg-green-400' : 'bg-slate-600'}`} />
              <p className={`text-xs font-medium ${step.startsWith('✓') ? 'text-green-400' : 'text-slate-500'}`}>
                {step.replace('✓ ', '').replace('⟳ ', '')}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (done && result) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center px-6 animate-in fade-in duration-500"
        style={{ background: '#080d18', paddingTop: 'calc(var(--sa-top) + 12px)' }}
      >
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)' }}>
          <CheckCircle2 size={40} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">{t.p2p_success}</h2>
        <p className="text-slate-400 text-sm text-center mb-6">
          {lang === 'uz'
            ? `${(result.amount || 0).toLocaleString()} UZS — ${result.receiver_name || ''} ga o'tkazildi`
            : `${(result.amount || 0).toLocaleString()} UZS переведено — ${result.receiver_name || ''}`}
        </p>

        {/* Chek */}
        <div className="w-full rounded-2xl overflow-hidden mb-6"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              {lang === 'uz' ? "O'tkazma tafsiloti" : "Детали перевода"}
            </p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{lang === 'uz' ? "Qabul qiluvchi" : "Получатель"}</span>
              <span className="text-white font-semibold">{result.receiver_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{lang === 'uz' ? "O'tkazma" : "Перевод"}</span>
              <span className="text-white font-semibold">{(result.amount || 0).toLocaleString()} UZS</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{lang === 'uz' ? "Komissiya (3%)" : "Комиссия (3%)"}</span>
              <span className="text-yellow-400 font-semibold">{(result.commission || 0).toLocaleString()} UZS</span>
            </div>
            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{lang === 'uz' ? "Balansdan yechildi" : "Списано с баланса"}</span>
              <span className="text-red-400 font-bold">{(result.total_deducted || 0).toLocaleString()} UZS</span>
            </div>
            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{lang === 'uz' ? "Yangi balans" : "Новый баланс"}</span>
              <span className="text-green-400 font-bold">{currentBalance.toLocaleString()} UZS</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/transfers')}
          className="w-full py-4 rounded-2xl font-bold text-black text-base"
          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
        >
          {lang === 'uz' ? "O'tkazmalarga qaytish" : "Вернуться к переводам"}
        </button>
      </div>
    );
  }

  // ── Form screen ──
  return (
    <div
      className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300"
      style={{ background: '#080d18', paddingTop: 'calc(var(--sa-top) + 12px)' }}
    >
      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h1 className="text-lg font-bold text-white leading-tight">{t.p2p_modal_title}</h1>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scrollable px-4 pt-6 pb-4 space-y-5">

        {/* Sender balance info */}
        <div className="rounded-2xl px-5 py-4 flex items-center gap-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
            <Wallet size={18} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">{lang === 'uz' ? "Mavjud balans" : "Доступный баланс"}</p>
            <p className="text-lg font-bold text-white">
              {currentBalance.toLocaleString()} <span className="text-yellow-400 text-sm">UZS</span>
            </p>
          </div>
        </div>

        {/* Bot ID field — MR prefix badge */}
        <div>
          <label className="block text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">
            {t.p2p_receiver_label}
          </label>
          <div className="relative flex items-center">
            {/* Fixed MR badge */}
            <div
              className="absolute left-0 top-0 bottom-0 flex items-center px-4 rounded-l-2xl font-bold text-sm select-none z-10"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderRight: '1px solid rgba(34,197,94,0.25)', minWidth: '54px', justifyContent: 'center' }}
            >
              MR
            </div>
            <input
              type="text"
              value={idSuffix}
              onChange={e => handleIdChange(e.target.value)}
              placeholder="2324407"
              className="w-full pl-16 pr-4 py-3.5 rounded-2xl text-white text-base font-medium placeholder-slate-700 outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${idError ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.1)'}`,
              }}
            />
          </div>
          {idError && (
            <p className="mt-1.5 px-1 text-xs font-medium text-red-400 flex items-center gap-1">
              <span>⚠</span> {idError}
            </p>
          )}
        </div>

        {/* Amount field */}
        <div>
          <label className="block text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">
            {t.p2p_amount_label}
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={e => handleAmtChange(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3.5 rounded-2xl text-white text-2xl font-bold placeholder-slate-700 outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${amtError ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.1)'}`,
              }}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">UZS</span>
          </div>
          {amtError ? (
            <p className="mt-1.5 px-1 text-xs font-medium text-red-400 flex items-center gap-1">
              <span>⚠</span> {amtError}
            </p>
          ) : (
            <p className="text-xs text-slate-600 mt-1.5 px-1">{t.p2p_amount_placeholder}</p>
          )}
        </div>

        {/* Real-time commission breakdown */}
        {amtNum >= 1000 && (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(250,204,21,0.2)' }}>
            <div className="px-4 py-2" style={{ background: 'rgba(250,204,21,0.08)' }}>
              <p className="text-xs text-yellow-500 font-semibold uppercase tracking-wider">
                {lang === 'uz' ? "Hisob-kitob" : "Расчёт"}
              </p>
            </div>
            <div className="px-4 py-3 space-y-2.5" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">{lang === 'uz' ? "O'tkazma" : "Перевод"}</span>
                <span className="text-sm font-bold text-white">{amtNum.toLocaleString()} UZS</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">{lang === 'uz' ? "Komissiya (3%)" : "Комиссия (3%)"}</span>
                <span className="text-sm font-bold text-yellow-400">{commission.toLocaleString()} UZS</span>
              </div>
              <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-300 font-semibold">{lang === 'uz' ? "Balansdan yechiladi" : "Спишется с баланса"}</span>
                <span className="text-base font-bold text-red-400">{totalDeducted.toLocaleString()} UZS</span>
              </div>
            </div>
          </div>
        )}

        {/* Confirm button — inside scroll area so keyboard hides it instead of pushing it up */}
        <div className="pt-2" style={{ paddingBottom: 'max(16px, calc(var(--sa-bottom, 0px) + 12px))' }}>
          <button
            onClick={handleSend}
            disabled={loading || !isValid}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-40"
            style={{ background: isValid ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.08)', color: isValid ? '#000' : '#64748b' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                {lang === 'uz' ? "Yuborilmoqda..." : "Отправка..."}
              </span>
            ) : t.p2p_confirm_btn}
          </button>
        </div>
      </div>
    </div>
  );
};

const Deposit = ({ user, lang, platform = "mostbet" }) => {
  const platformLabel = platform === "1xbet" ? "1xbet" : "Mostbet";
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UZS");
  const [step, setStep] = useState(1); 
  const [adminSettings, setAdminSettings] = useState({});
  const [adminCards, setAdminCards] = useState([]);
  const [userPlatformId, setUserPlatformId] = useState("");
  const t = translations[lang];

  useEffect(() => {
      if (user?.telegram_id) fetchData();
  }, [user]);

  const fetchData = async () => {
      try { 
          const [settingsRes, cardsRes, userRes] = await Promise.all([
              axios.get(`${API_URL}/admin/settings`),
              axios.get(`${API_URL}/admin/cards`),
              axios.get(`${API_URL}/user/${user.telegram_id}`)
          ]);
          setAdminSettings(settingsRes.data);
          setAdminCards(cardsRes.data || []);
          const wallets = userRes.data.wallets || [];
          const hasCard = wallets.some(w => w.type === 'uzcard' || w.type === 'humo');
          if (!hasCard) {
              toast.error(t.add_card_required);
              navigate('/wallets');
              return;
          }
          const idTypes = platform === "1xbet" ? ['1xbet'] : ['mostbet_uzs', 'mostbet_usd', 'mostbet'];
          const platformWallet = wallets.find(w => idTypes.includes(w.type));
          if (platformWallet) setUserPlatformId(platformWallet.number);
      } catch(e) {}
  };

  const getAdminCard = () => {
      const uzTypes = ['uzcard', 'humo', 'mostbet_uzs'];
      const usdTypes = ['uzcard', 'humo', 'mostbet_usd'];
      const types = currency === 'USD' ? usdTypes : uzTypes;
      return adminCards.find(c => types.includes(c.type)) || null;
  };

  const handleNext = () => {
      if(!amount) return toast.error(t.enter_valid_amount);
      if(currency === 'UZS' && Number(amount) < 20000) return toast.error(t.min_amount);
      if(!userPlatformId) return toast.error(t.platform_id_hint.replace('{platform}', platformLabel));
      setStep(2);
  };

  const handleDeposit = async () => {
    try {
      await axios.post(`${API_URL}/transactions/create`, {
        user_id: user.telegram_id,
        type: "deposit",
        amount: Number(amount),
        currency: currency,
        method: platformLabel + " ID",
        wallet_number: userPlatformId,
        manual_check: true
      });
      toast.success(t.success_deposit);
      navigate("/");
    } catch (e) { toast.error(t.error); }
  };

  const copyId = () => {
      if(userPlatformId) {
          navigator.clipboard.writeText(userPlatformId);
          toast.success(t.copied);
      }
  };

  const usdRate = adminSettings.exchange_rate || 12800;
  const calculatedUZS = amount ? (Number(amount) * usdRate).toLocaleString() : 0;

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center gap-3" style={{ paddingTop: 'calc(var(--sa-top) + 12px)' }}>
        <h1 className="text-2xl font-bold">{platformLabel} — {t.deposit_title}</h1>
      </div>
      
      {step === 1 ? (
          <div className="space-y-6 animate-in fade-in">
            
            {/* Currency Toggle */}
            <div className="bg-midnight-light p-1 rounded-xl flex">
                <button 
                    onClick={() => setCurrency('UZS')}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${currency === 'UZS' ? 'bg-primary text-black shadow-lg' : 'text-slate-400'}`}
                >
                    UZS
                </button>
                <button 
                    onClick={() => setCurrency('USD')}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${currency === 'USD' ? 'bg-primary text-black shadow-lg' : 'text-slate-400'}`}
                >
                    USD
                </button>
            </div>

            {/* User Platform ID display */}
            <Card>
                <label className="text-sm text-slate-400 mb-3 block">{t.platform_id_label.replace('{platform}', platformLabel)}</label>
                {userPlatformId ? (
                    <div className="flex items-center justify-between">
                        <span className="text-xl font-mono font-bold text-white">{userPlatformId}</span>
                        <button onClick={copyId} className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 active:scale-95 transition-all">
                            <Copy size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-sm">{t.id_not_entered}</span>
                        <button onClick={() => navigate('/wallets')} className="text-primary text-sm font-bold">{t.add_id}</button>
                    </div>
                )}
            </Card>

            <Card>
                <label className="text-sm text-slate-400 mb-2 block">{t.enter_amount}</label>
                <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
                    <span className="text-2xl font-bold text-slate-500">{currency}</span>
                    <input 
                        type="number" 
                        value={amount} 
                        onChange={e => setAmount(e.target.value)} 
                        className="bg-transparent text-3xl font-bold w-full outline-none text-right placeholder:text-slate-700" 
                        placeholder="0" 
                    />
                </div>
                {currency === 'UZS' && <p className="text-xs text-slate-500 mt-2 text-right">Min: 20,000 UZS</p>}
                
                {currency === 'USD' && amount && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-400">{t.exchange_rate}:</span>
                            <span className="font-mono text-white">1 USD = {usdRate} UZS</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-slate-400">{t.total_uzs}</span>
                            <span className="text-xl font-bold text-primary">{calculatedUZS} UZS</span>
                        </div>
                    </div>
                )}
            </Card>

            <Button onClick={handleNext} className="w-full py-4 text-lg">{t.continue_btn}</Button>
          </div>
      ) : (
          <div className="space-y-4 animate-in slide-in-from-right">
              <Card highlight className="py-6 space-y-4">
                  <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">{platformLabel} ID</span>
                      <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-lg">{userPlatformId}</span>
                          <button onClick={copyId} className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 active:scale-95 transition-all">
                              <Copy size={14} />
                          </button>
                      </div>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-700/50 pt-4">
                      <span className="text-slate-400 text-sm">{t.amount_label}</span>
                      <span className="font-bold text-white text-lg">{Number(amount).toLocaleString()} {currency}</span>
                  </div>
                  {(() => {
                      const adminCard = getAdminCard();
                      return adminCard ? (
                          <div className="flex justify-between items-center border-t border-slate-700/50 pt-4">
                              <span className="text-slate-400 text-sm">{t.payment_card}</span>
                              <div className="flex items-center gap-2">
                                  <span className="font-mono text-slate-300 text-sm">{adminCard.number}</span>
                                  <button onClick={() => { navigator.clipboard.writeText(adminCard.number); toast.success(t.copied); }} className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 active:scale-95 transition-all">
                                      <Copy size={12} />
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className="border-t border-slate-700/50 pt-4 text-center text-slate-500 text-sm">
                              {t.admin_card_missing}
                          </div>
                      );
                  })()}
              </Card>

              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm text-blue-200">
                <CheckCircle2 className="inline-block mr-2 mb-1" size={16} />
                {t.pay_instruction}
              </div>

              <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">{t.back}</Button>
                  <Button onClick={handleDeposit} className="flex-[2]">{t.i_paid}</Button>
              </div>
          </div>
      )}
    </div>
  );
};

const Withdraw = ({ user, lang, platform = "mostbet" }) => {
  const platformLabel = platform === "1xbet" ? "1xbet" : "Mostbet";
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [code, setCode] = useState("");
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [adminSettings, setAdminSettings] = useState({});
  const t = translations[lang];

  useEffect(() => { 
      if(user?.telegram_id) fetchWallets();
      fetchSettings();
  }, [user]);

  const fetchWallets = async () => { 
      try { 
          const res = await axios.get(`${API_URL}/user/${user.telegram_id}`); 
          const allWallets = res.data.wallets || [];
          const hasCard = allWallets.some(w => w.type === 'uzcard' || w.type === 'humo');
          if (!hasCard) {
              toast.error(t.add_card_required);
              navigate('/wallets');
              return;
          }
          const platformWallets = platform === "1xbet"
              ? allWallets.filter(w => w.type === '1xbet')
              : allWallets.filter(w => w.type.startsWith('mostbet'));
          setWallets(platformWallets); 
      } catch (e) { console.error(e); } 
  };

  const fetchSettings = async () => {
      try { const res = await axios.get(`${API_URL}/admin/settings`); setAdminSettings(res.data); } catch(e) {}
  };

  const handleWithdraw = async () => {
    if (!selectedWallet) return toast.error(t.select_wallet);
    if (!code || code.length < 6) return toast.error(t.enter_code);

    let verifyData;
    try {
        const res = await axios.post(`${API_URL}/transactions/verify_code`, {
            code: code,
            player_id: selectedWallet.number
        });
        verifyData = res.data;
    } catch (err) {
        return toast.error(err.response?.data?.detail || t.invalid_code);
    }

    const currency = selectedWallet.type.includes('usd') ? 'USD' : 'UZS';
    const verifiedAmount = verifyData.amount || 0;

    try {
      await axios.post(`${API_URL}/transactions/create`, {
        user_id: user.telegram_id,
        type: "withdraw",
        amount: verifiedAmount,
        currency: currency,
        method: selectedWallet.type,
        wallet_number: selectedWallet.number,
        secret_code: code
      });
      toast.success(t.success_withdraw);
      navigate("/");
    } catch (e) { toast.error(e.response?.data?.detail || t.error); }
  };

  const getCurrencySymbol = () => {
      if(!selectedWallet) return 'UZS';
      if(selectedWallet.type.includes('usd')) return '$';
      return 'UZS';
  };

  const isUSD = selectedWallet?.type.includes('usd');
  const usdRate = adminSettings.exchange_rate || 12800;
  const calculatedUZS = amount ? (Number(amount) * usdRate).toLocaleString() : 0;

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center gap-3" style={{ paddingTop: 'calc(var(--sa-top) + 12px)' }}>
        <h1 className="text-2xl font-bold">{platformLabel} — {t.withdraw_title}</h1>
      </div>
      <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-slate-400">{t.select_wallet}</label>
            <Link to="/wallets" className="text-primary text-xs">{t.manage_wallets}</Link>
          </div>
          <div className="space-y-2">
              {wallets.length === 0 ? (
                  <div className="text-center p-4 border border-dashed border-slate-700 rounded-xl text-slate-500 text-sm">
                      {t.no_wallets}
                  </div>
              ) : (
                  wallets.map(w => (
                      <div 
                        key={w.id}
                        onClick={() => setSelectedWallet(w)}
                        className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                            selectedWallet?.id === w.id
                            ? 'bg-primary/10 border-primary'
                            : 'bg-midnight-light border-slate-800'
                        }`}
                      >
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                                  <CreditCard size={20} className="text-slate-300" />
                              </div>
                              <div>
                                  <div className="font-bold text-white uppercase">{w.type.replace('_', ' ')}</div>
                                  <div className="text-xs text-slate-500">{w.number}</div>
                              </div>
                          </div>
                          {selectedWallet?.id === w.id && <div className="w-4 h-4 rounded-full bg-primary" />}
                      </div>
                  ))
              )}
          </div>
      </div>
      <Card>
          <div className="space-y-4">
            <div>
                <label className="text-sm text-slate-400 mb-2 block">{t.secret_code}</label>
                <div className="relative">
                    <Input 
                        value={code} 
                        onChange={(e) => {
                            const maxLen = platform === "1xbet" ? 6 : 8;
                            const val = platform === "1xbet"
                                ? e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
                                : e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
                            setCode(val);
                            if (platform !== "1xbet" && val.length >= 8 && selectedWallet) {
                                axios.post(`${API_URL}/transactions/verify_code`, {
                                    code: val,
                                    player_id: selectedWallet.number
                                }).then(() => {
                                    toast.success(t.code_confirmed);
                                }).catch((err) => {
                                    toast.error(err.response?.data?.detail || t.error_occurred);
                                });
                            }
                        }}
                        placeholder={platform === "1xbet" ? (lang === 'ru' ? "Код 1xbet (6 цифр)" : "1xbet kodi (6 xonali)") : t.code_placeholder}
                        maxLength={platform === "1xbet" ? 6 : 8}
                        type={platform === "1xbet" ? "number" : "text"}
                    />
                    <Key className="absolute right-4 top-3 text-slate-500" size={18} />
                </div>
            </div>
          </div>
      </Card>
      <Button onClick={handleWithdraw} className="w-full py-4 text-lg" disabled={wallets.length === 0}>{t.request_withdraw}</Button>
    </div>
  );
};

const NavCard = ({ icon, title, subtitle, accentColor = 'yellow', onClick }) => {
    const colors = {
        yellow: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
        blue:   { bg: 'bg-blue-500/15',   text: 'text-blue-400' },
        purple: { bg: 'bg-purple-500/15',  text: 'text-purple-400' },
        green:  { bg: 'bg-green-500/15',   text: 'text-green-400' },
    };
    const c = colors[accentColor];
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border border-slate-800 bg-slate-900/60 text-left
                       hover:bg-slate-900 hover:border-slate-700 active:scale-[0.98] transition-all duration-200"
        >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg}`}>
                <span className={c.text}>{icon}</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-white">{title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>
            <ChevronRight size={18} className="text-slate-500 flex-shrink-0"/>
        </button>
    );
};

const PageHeader = ({ title }) => {
    return (
        <div className="page-header-bar" style={{ paddingTop: 'calc(var(--sa-top) + 12px)' }}>
            <h1>{title}</h1>
        </div>
    );
};

const maskCardFull = (num) => {
    if (!num) return '';
    const d = num.replace(/\s/g, '');
    if (d.length < 8) return d;
    return d.slice(0, 4) + ' **** **** ' + d.slice(-4);
};

const BalanceDepositPage = ({ user, lang = 'uz' }) => {
    const t = translations[lang];
    const navigate = useNavigate();
    const [amount, setAmount]       = useState('');
    const [adminCard, setAdminCard] = useState(null);
    const [loading, setLoading]     = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const botId = user?.bot_id || '';

    useEffect(() => {
        const fetchCard = async () => {
            try {
                const res = await axios.get(`${API_URL}/admin/cards`);
                const cards = res.data || [];
                const card = cards.find(c => c.type === 'uzcard' || c.type === 'humo');
                setAdminCard(card || null);
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        setLoading(true);
        fetchCard();
    }, []);

    const copyCard = () => {
        if (!adminCard?.number) return;
        const num = adminCard.number.replace(/\s/g, '');
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(num).then(() => toast.success(t.card_copied));
        } else {
            const el = document.createElement('textarea');
            el.value = num;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            toast.success(t.card_copied);
        }
    };

    const handleSubmit = async () => {
        const amt = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
        if (!amt || amt < 1000) return toast.error(t.min_balance_amount);
        if (!adminCard) return toast.error(t.admin_card_not_found);
        setSubmitting(true);
        try {
            await axios.post(`${API_URL}/balance/deposit`, {
                telegram_id: user.telegram_id,
                amount: amt
            });
            setSubmitted(true);
        } catch (e) {
            toast.error(e?.response?.data?.detail || t.error_occurred);
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-in fade-in duration-300" style={{ background: '#0a0e1a' }}>
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-5">
                <CheckCircle2 size={40} className="text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t.request_sent_title}</h2>
            <p className="text-slate-400 text-sm text-center mb-1">{t.admin_checking}</p>
            <p className="text-slate-500 text-xs text-center mb-8">{t.auto_credit}</p>
            <div className="w-full max-w-xs space-y-3">
                <button onClick={() => navigate('/wallet')}
                    className="w-full py-3 rounded-xl font-bold text-black text-sm active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(135deg,#facc15,#f59e0b)' }}>
                    {t.back_to_wallet}
                </button>
                <button onClick={() => { setSubmitted(false); setAmount(''); }}
                    className="w-full py-3 rounded-xl font-bold text-slate-400 text-sm bg-white/5 active:scale-95 transition-all">
                    {t.new_request}
                </button>
            </div>
        </div>
    );

    return (
        <div className="page-full animate-in fade-in duration-300" style={{ background: '#0a0e1a' }}>
            <PageHeader title={t.balance_deposit_title} />

            <div className="page-body scrollable space-y-4">
                {/* Bot ID — readonly */}
                <div className="rounded-2xl p-4" style={{ background: 'rgba(15,20,32,1)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Bot ID</p>
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                        <span className="text-base font-bold font-mono text-yellow-400 tracking-widest flex-1">{botId || '—'}</span>
                        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1.5 px-1">{t.bot_id_hint}</p>
                </div>

                {/* Amount input */}
                <div className="rounded-2xl p-4" style={{ background: 'rgba(15,20,32,1)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{t.amount_label}</p>
                    <div className="relative">
                        <input
                            type="number"
                            inputMode="numeric"
                            placeholder="0"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="w-full bg-white/5 border border-white/8 text-white text-xl font-bold rounded-xl px-4 py-3 pr-16 outline-none focus:border-yellow-400/40 transition-all placeholder:text-slate-700"
                            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">UZS</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1.5 px-1">{t.min_balance_short}</p>
                </div>

                {/* Admin card */}
                <div className="rounded-2xl p-4" style={{ background: 'rgba(15,20,32,1)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">{t.payment_card_label}</p>
                    {loading ? (
                        <div className="flex items-center gap-3 py-2">
                            <div className="w-5 h-5 border-2 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
                            <span className="text-sm text-slate-500">{t.loading}</span>
                        </div>
                    ) : adminCard ? (
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(250,204,21,0.1)' }}>
                                    <CreditCard size={18} className="text-yellow-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-semibold">{adminCard.type}</p>
                                    <p className="text-sm font-bold font-mono text-white tracking-widest">{maskCardFull(adminCard.number)}</p>
                                </div>
                            </div>
                            <button onClick={copyCard}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all active:scale-95"
                                style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.15)' }}>
                                <Copy size={13} className="text-yellow-400" />
                                <span className="text-xs font-semibold text-yellow-400">{t.copy_card}</span>
                            </button>
                        </div>
                    ) : (
                        <p className="text-sm text-red-400">{t.admin_card_red}</p>
                    )}
                </div>

                {/* Instruction */}
                <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(250,204,21,0.04)', border: '1px solid rgba(250,204,21,0.1)' }}>
                    <p className="text-[11px] text-yellow-400/70 leading-relaxed">
                        {t.instruction_text}
                    </p>
                </div>

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={submitting || !amount || !adminCard}
                    className="w-full py-4 rounded-2xl font-bold text-black text-base active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg,#facc15,#f59e0b)' }}
                >
                    {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            {t.submitting}
                        </span>
                    ) : t.i_paid}
                </button>
            </div>
        </div>
    );
};

const WalletPage = ({ user, lang = 'uz' }) => {
    const t = translations[lang];
    const navigate = useNavigate();
    const balanceUZS = user?.balance_uzs ?? 0;
    const balanceUSD = user?.balance_usd ?? 0;
    return (
        <div className="page-full animate-in fade-in duration-300">
            <PageHeader title={t.wallet_title}/>
            <div className="page-body scrollable space-y-4">
                <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg,#1a1f2e 0%,#0f1420 50%,#1a2a1a 100%)", border: "1px solid rgba(250,204,21,0.15)" }}>
                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">{t.my_account}</p>
                    <div className="flex items-end gap-2 mb-2">
                        <span className="balance-amount text-white">{balanceUZS.toLocaleString('uz-UZ')}</span>
                        <span className="text-base font-semibold text-yellow-400 mb-0.5 flex-shrink-0">UZS</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1 w-fit">
                        <span className="text-xs text-slate-400">USD</span>
                        <span className="text-sm font-bold text-white">${balanceUSD.toFixed(2)}</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => navigate('/balance-deposit')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 font-bold text-sm active:scale-95 transition-all duration-200">
                        <ArrowDownToLine size={16}/> {t.deposit_btn}
                    </button>
                    <button onClick={() => navigate('/withdraw')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 border border-white/10 text-white font-bold text-sm active:scale-95 transition-all duration-200">
                        <ArrowUpFromLine size={16}/> {t.withdraw_btn}
                    </button>
                </div>
            </div>
        </div>
    );
};

const WALLET_PLATFORMS = [
    {
        key: 'mostbet',
        name: 'Mostbet UZS',
        badge: 'MB',
        accent: 'yellow',
        accentClasses: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/25', text: 'text-yellow-400', badgeBg: 'bg-yellow-500/20' },
        idTypes: ['mostbet_uzs', 'mostbet_usd', 'mostbet'],
        idSaveType: 'mostbet_uzs',
        cardTypes: ['uzcard', 'humo'],
        cardSaveType: 'uzcard',
        idLabel: 'Mostbet ID',
    },
    {
        key: '1xbet',
        name: '1xbet UZS',
        badge: '1X',
        accent: 'blue',
        accentClasses: { bg: 'bg-blue-500/15', border: 'border-blue-500/25', text: 'text-blue-400', badgeBg: 'bg-blue-500/20' },
        idTypes: ['1xbet'],
        idSaveType: '1xbet',
        cardTypes: ['1xbet_card'],
        cardSaveType: '1xbet_card',
        idLabel: '1xbet ID',
    },
];

const maskCard = (num) => {
    if (!num) return null;
    const clean = num.replace(/\s/g, '');
    if (clean.length < 4) return clean;
    return '**** **** **** ' + clean.slice(-4);
};

const formatCardInput = (val) => {
    const digits = val.replace(/[^\d]/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
};

const WalletModal = ({ platform, existingId, existingCard, onSave, onClose, saving, lang = 'uz' }) => {
    const t = translations[lang];
    const [idVal, setIdVal] = useState(existingId || '');
    const [cardVal, setCardVal] = useState(existingCard ? existingCard.replace(/(\d{4})(?=\d)/g, '$1 ') : '');
    const ac = platform.accentClasses;

    const handleSave = () => {
        if (!idVal.trim()) return toast.error(platform.idLabel + " " + t.enter_valid_number);
        onSave(idVal.trim(), cardVal.replace(/\s/g, ''));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
            <div
                className="relative w-full max-w-lg rounded-t-2xl p-5 space-y-4 animate-in slide-in-from-bottom duration-300"
                style={{
                    background: 'linear-gradient(180deg,#1a1f2e 0%,#0f1420 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 2rem)',
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${ac.badgeBg}`}>
                            <span className={`text-[11px] font-extrabold ${ac.text}`}>{platform.badge}</span>
                        </div>
                        <span className="font-bold text-white">{platform.name}</span>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                        <X size={14} className="text-slate-400"/>
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-slate-400 mb-1.5 block">{platform.idLabel}</label>
                        <input
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/25 transition-colors"
                            value={idVal}
                            onChange={e => setIdVal(e.target.value)}
                            placeholder="123456789"
                            inputMode="numeric"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 mb-1.5 block">{t.card_optional}</label>
                        <input
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/25 transition-colors"
                            value={cardVal}
                            onChange={e => setCardVal(formatCardInput(e.target.value))}
                            placeholder="8600 0000 0000 0000"
                            inputMode="numeric"
                            maxLength={19}
                        />
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 ${ac.bg} ${ac.border} border ${ac.text}`}
                >
                    {saving ? t.saving : t.save}
                </button>
            </div>
        </div>
    );
};

// ── WITHDRAW SELECT PAGE ─────────────────────────────────────────────────────
const WithdrawSelect = ({ user, lang = 'uz' }) => {
    const t = translations[lang];
    const navigate = useNavigate();
    const [step, setStep] = useState('select'); // 'select' | 'form'
    const [method, setMethod] = useState(null); // 'mostbet' | '1xbet' | 'card'
    const [amount, setAmount] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [loading, setLoading] = useState(false);

    const wallets = user?.wallets || [];
    const mostbetWallet = wallets.find(w => ['mostbet_uzs', 'mostbet_usd', 'mostbet'].includes(w.type));
    const xbetWallet    = wallets.find(w => w.type === '1xbet');
    const hasCard       = wallets.some(w => ['uzcard', 'humo'].includes(w.type));

    const METHODS = [
        {
            id: 'mostbet',
            label: 'Mostbet ID',
            badge: 'MB',
            color: 'yellow',
            bg: 'rgba(234,179,8,0.1)',
            border: 'rgba(234,179,8,0.3)',
            text: '#facc15',
            wallet: mostbetWallet,
            missing: !mostbetWallet ? t.mostbet_id_missing : null,
        },
        {
            id: '1xbet',
            label: '1xbet ID',
            badge: '1X',
            color: 'blue',
            bg: 'rgba(59,130,246,0.1)',
            border: 'rgba(59,130,246,0.3)',
            text: '#60a5fa',
            wallet: xbetWallet,
            missing: !xbetWallet ? t.xbet_id_missing : null,
        },
        {
            id: 'card',
            label: 'Uzcard / Humo',
            badge: '💳',
            color: 'slate',
            bg: 'rgba(255,255,255,0.06)',
            border: 'rgba(255,255,255,0.12)',
            text: '#e2e8f0',
            wallet: null,
            missing: null,
        },
    ];

    const selected = METHODS.find(m => m.id === method);

    const handleSelect = (m) => {
        if (m.missing) { toast.error(m.missing); return; }
        setMethod(m.id);
        setStep('form');
    };

    const handleSubmit = async () => {
        if (!amount || Number(amount) <= 0) return toast.error(t.enter_valid_amount);
        if (Number(amount) < 10000) return toast.error(t.min_withdraw_err);
        if (user?.balance_uzs < Number(amount)) return toast.error(t.insufficient_funds);
        if (method === 'card') {
            const digits = cardNumber.replace(/\s/g, '');
            if (digits.length < 16) return toast.error(t.enter_16_digits);
        }
        setLoading(true);
        try {
            const payload = {
                user_id: user.telegram_id,
                type: 'withdraw',
                amount: Number(amount),
                currency: 'UZS',
            };
            if (method === 'mostbet') {
                payload.method = 'Mostbet ID';
                payload.wallet_number = mostbetWallet?.number;
            } else if (method === '1xbet') {
                payload.method = '1xbet ID';
                payload.wallet_number = xbetWallet?.number;
            } else {
                payload.method = 'Uzcard/Humo';
                payload.wallet_number = cardNumber.replace(/\s/g, '');
            }
            await axios.post(`${API_URL}/transactions/create`, payload);
            toast.success(t.withdraw_sent);
            navigate('/profile');
        } catch(e) {
            toast.error(e?.response?.data?.detail || t.error_occurred);
        } finally { setLoading(false); }
    };

    return (
        <div className="page-full animate-in fade-in duration-300">
            <PageHeader title={t.withdraw_select_title} />
            <div className="page-body scrollable space-y-4">

                {/* Balans */}
                <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="text-sm text-slate-400">{t.available_balance}</span>
                    <span className="text-base font-bold text-yellow-400">
                        {(user?.balance_uzs ?? 0).toLocaleString('uz-UZ')} UZS
                    </span>
                </div>

                {step === 'select' && (
                    <div className="space-y-3 animate-in fade-in">
                        <p className="text-sm text-slate-400 font-medium">{t.where_withdraw}</p>
                        {METHODS.map(m => (
                            <button key={m.id} onClick={() => handleSelect(m)}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl text-left active:scale-95 transition-all"
                                style={{ background: m.bg, border: `1px solid ${m.border}` }}>
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-extrabold"
                                    style={{ background: 'rgba(255,255,255,0.06)', color: m.text }}>
                                    {m.badge}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-white text-sm">{m.label}</div>
                                    {m.wallet ? (
                                        <div className="text-xs font-mono mt-0.5" style={{ color: m.text }}>
                                            ID: {m.wallet.number}
                                        </div>
                                    ) : m.id === 'card' ? (
                                        <div className="text-xs text-slate-500 mt-0.5">{t.card_self_enter}</div>
                                    ) : (
                                        <div className="text-xs text-red-400 mt-0.5">{t.not_saved}</div>
                                    )}
                                </div>
                                <ChevronRight size={18} className="text-slate-600 flex-shrink-0" />
                            </button>
                        ))}
                    </div>
                )}

                {step === 'form' && selected && (
                    <div className="space-y-4 animate-in slide-in-from-right duration-300">
                        {/* Tanlangan usul */}
                        <div className="rounded-xl p-4 flex items-center gap-3"
                            style={{ background: selected.bg, border: `1px solid ${selected.border}` }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-base flex-shrink-0"
                                style={{ background: 'rgba(255,255,255,0.08)', color: selected.text }}>
                                {selected.badge}
                            </div>
                            <div>
                                <div className="text-xs text-slate-400">{t.withdraw_method_label}</div>
                                <div className="font-bold text-white text-sm">{selected.label}</div>
                                {selected.wallet && (
                                    <div className="text-xs font-mono mt-0.5" style={{ color: selected.text }}>
                                        {selected.wallet.number}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Karta raqami — faqat card usulida */}
                        {method === 'card' && (
                            <div>
                                <label className="text-xs text-slate-400 mb-2 block">{t.card_16}</label>
                                <input
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base font-mono placeholder-slate-600 focus:outline-none focus:border-white/25 transition-colors tracking-widest"
                                    value={cardNumber}
                                    onChange={e => setCardNumber(formatCardInput(e.target.value))}
                                    placeholder="8600 0000 0000 0000"
                                    inputMode="numeric"
                                    maxLength={19}
                                />
                            </div>
                        )}

                        {/* Summa */}
                        <div>
                            <label className="text-xs text-slate-400 mb-2 block">{t.withdraw_amount_uzs}</label>
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-yellow-500/50 transition-colors">
                                <span className="text-slate-500 text-sm font-bold">UZS</span>
                                <input
                                    type="number"
                                    className="flex-1 bg-transparent text-white text-xl font-bold outline-none text-right placeholder-slate-700"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <p className="text-xs text-slate-600 mt-1 text-right">{t.min_withdraw}</p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => { setStep('select'); setAmount(''); setCardNumber(''); }}
                                className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 border border-white/10 text-slate-400 active:scale-95 transition-all">
                                {t.back}
                            </button>
                            <button onClick={handleSubmit} disabled={loading}
                                className="flex-[2] py-3 rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
                                style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.35)', color: '#facc15' }}>
                                {loading ? t.submitting : t.send_request}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const Wallets = ({ user, lang = 'uz' }) => {
    const t = translations[lang];
    const [wallets, setWallets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deletingKey, setDeletingKey] = useState(null);

    useEffect(() => { if (user?.telegram_id) fetchWallets(); }, [user]);

    const fetchWallets = async () => {
        try {
            const res = await axios.get(`${API_URL}/user/${user.telegram_id}`);
            setWallets(res.data.wallets || []);
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    };

    const getGroup = (platform) => {
        const idWallet  = wallets.find(w => platform.idTypes.includes(w.type));
        const cardWallet = wallets.find(w => platform.cardTypes.includes(w.type));
        return { idWallet, cardWallet, hasData: !!idWallet };
    };

    const handleSave = async (platform, idVal, cardVal) => {
        setSaving(true);
        try {
            const { idWallet, cardWallet } = getGroup(platform);
            if (idWallet) {
                await axios.post(`${API_URL}/wallets/update`, {
                    telegram_id: user.telegram_id, wallet_id: idWallet.id,
                    wallet: { number: idVal, type: platform.idSaveType }
                });
            } else {
                await axios.post(`${API_URL}/wallets/add`, {
                    telegram_id: user.telegram_id,
                    wallet: { type: platform.idSaveType, number: idVal, expiry: '', name: '' }
                });
            }
            if (cardVal) {
                if (cardWallet) {
                    await axios.post(`${API_URL}/wallets/update`, {
                        telegram_id: user.telegram_id, wallet_id: cardWallet.id,
                        wallet: { number: cardVal, type: cardWallet.type }
                    });
                } else {
                    await axios.post(`${API_URL}/wallets/add`, {
                        telegram_id: user.telegram_id,
                        wallet: { type: platform.cardSaveType, number: cardVal, expiry: '', name: '' }
                    });
                }
            }
            toast.success(t.saved_ok);
            setModal(null);
            await fetchWallets();
        } catch(e) { toast.error(t.error_occurred); }
        finally { setSaving(false); }
    };

    const handleDelete = async (platform) => {
        setDeletingKey(platform.key);
        try {
            const { idWallet, cardWallet } = getGroup(platform);
            const deletes = [];
            if (idWallet) deletes.push(axios.post(`${API_URL}/wallets/delete`, { telegram_id: user.telegram_id, wallet_id: idWallet.id }));
            if (cardWallet) deletes.push(axios.post(`${API_URL}/wallets/delete`, { telegram_id: user.telegram_id, wallet_id: cardWallet.id }));
            await Promise.all(deletes);
            toast.success(t.deleted_ok);
            await fetchWallets();
        } catch(e) { toast.error(t.error_occurred); }
        finally { setDeletingKey(null); }
    };

    const groups = WALLET_PLATFORMS.map(p => ({ platform: p, ...getGroup(p) }));
    const savedGroups = groups.filter(g => g.hasData);
    const unsavedPlatforms = groups.filter(g => !g.hasData).map(g => g.platform);

    return (
        <div className="page-full animate-in fade-in duration-300">
            <PageHeader title={t.wallets_title}/>
            <div className="page-body scrollable space-y-3">

                {loading ? (
                    <div className="flex justify-center pt-12">
                        <div className="w-6 h-6 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin"/>
                    </div>
                ) : savedGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-16 pb-8 space-y-3">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                            <CreditCard size={28} className="text-slate-600"/>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">{t.no_wallets_added}</p>
                        <p className="text-slate-600 text-xs">{t.press_below}</p>
                    </div>
                ) : (
                    savedGroups.map(({ platform, idWallet, cardWallet }) => {
                        const ac = platform.accentClasses;
                        const isDeleting = deletingKey === platform.key;
                        return (
                            <div
                                key={platform.key}
                                className={`rounded-2xl p-4 border ${ac.border} ${ac.bg} space-y-3`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${ac.badgeBg}`}>
                                            <span className={`text-[11px] font-extrabold ${ac.text}`}>{platform.badge}</span>
                                        </div>
                                        <span className="font-bold text-white text-sm">{platform.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setModal({ platform, idWallet, cardWallet })}
                                            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/8 border border-white/10 text-slate-300 text-xs font-semibold active:scale-95 transition-all min-h-[44px]"
                                        >
                                            <Edit size={13}/> {t.edit}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(platform)}
                                            disabled={isDeleting}
                                            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold active:scale-95 transition-all disabled:opacity-50 min-h-[44px]"
                                        >
                                            <Trash2 size={13}/> {isDeleting ? '...' : t.delete}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5 pl-0.5">
                                    {idWallet && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 w-16 shrink-0">{platform.idLabel}:</span>
                                            <span className="text-sm font-semibold text-white font-mono">{idWallet.number}</span>
                                        </div>
                                    )}
                                    {cardWallet && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 w-16 shrink-0">{t.card_label}</span>
                                            <span className="text-sm font-semibold text-slate-300 font-mono tracking-wider">{maskCard(cardWallet.number)}</span>
                                        </div>
                                    )}
                                    {!cardWallet && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 w-16 shrink-0">{t.card_label}</span>
                                            <span className="text-xs text-slate-600 italic">{t.not_added_yet}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}

                {!loading && unsavedPlatforms.map(platform => {
                    const ac = platform.accentClasses;
                    return (
                        <button
                            key={platform.key}
                            onClick={() => setModal({ platform, idWallet: null, cardWallet: null })}
                            className="w-full flex items-center gap-3 p-4 rounded-2xl border border-dashed border-white/10 bg-white/3 active:scale-98 transition-all"
                        >
                            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                                <Plus size={16} className="text-slate-500"/>
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-semibold text-slate-400">{platform.name} {t.add_platform}</p>
                                <p className="text-xs text-slate-600">{t.enter_id_card}</p>
                            </div>
                            <ChevronRight size={16} className="text-slate-600 ml-auto"/>
                        </button>
                    );
                })}
            </div>

            {modal && (
                <WalletModal
                    platform={modal.platform}
                    existingId={modal.idWallet?.number || ''}
                    existingCard={modal.cardWallet?.number || ''}
                    saving={saving}
                    lang={lang}
                    onSave={(idVal, cardVal) => handleSave(modal.platform, idVal, cardVal)}
                    onClose={() => !saving && setModal(null)}
                />
            )}
        </div>
    );
};

const ReferralPage = ({ user, lang = 'uz' }) => {
    const t = translations[lang];
    const BOT_USERNAME = 'MR_KASSABOT';
    const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${user?.telegram_id}`;
    return (
        <div className="page-full animate-in fade-in duration-300">
            <PageHeader title={t.referral_title}/>
            <div className="page-body scrollable space-y-4">
                <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-xs text-slate-400 mb-1">{t.your_link}</p>
                    <p className="text-sm font-mono text-yellow-400 break-all">{referralLink}</p>
                </div>
                <button
                    onClick={() => { navigator.clipboard.writeText(referralLink); toast.success(t.copied); }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 font-bold active:scale-95 transition-all duration-200"
                >
                    <Copy size={16}/> {t.copy_link}
                </button>
            </div>
        </div>
    );
};

const PartnershipPage = ({ user, lang = 'uz' }) => {
    const t = translations[lang];
    const [partnerToken, setPartnerToken] = useState('');
    const [partnerName, setPartnerName] = useState('');
    const [partnerResult, setPartnerResult] = useState(null);
    const [partnerLoading, setPartnerLoading] = useState(false);

    const submitPartnership = async () => {
        if (!partnerToken.trim()) return toast.error(t.enter_token);
        setPartnerLoading(true);
        try {
            const res = await axios.post(`${API_URL}/partnership/apply`, { telegram_id: user.telegram_id, bot_token: partnerToken, bot_name: partnerName });
            setPartnerResult(res.data);
            toast.success(t.bot_connected);
            setPartnerToken(''); setPartnerName('');
        } catch(e) {
            const msg = e.response?.data?.detail || t.error_occurred;
            toast.error(msg);
        } finally { setPartnerLoading(false); }
    };

    return (
        <div className="page-full animate-in fade-in duration-300">
            <PageHeader title={t.partnership_title}/>
            <div className="page-body scrollable">
                {partnerResult ? (
                    <div className="space-y-3">
                        <div className="rounded-xl p-4 bg-green-500/10 border border-green-500/30">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 size={18} className="text-green-400"/>
                                <p className="font-bold text-green-400">{t.bot_connected}</p>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                                    <span className="text-slate-400">{t.bot_name_label}</span>
                                    <span className="font-bold text-white">{partnerResult.bot_name}</span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                                    <span className="text-slate-400">Username</span>
                                    <span className="font-bold text-yellow-400">@{partnerResult.bot_username}</span>
                                </div>
                                <div className="pt-1">
                                    <p className="text-slate-400 text-xs mb-1">Web App URL</p>
                                    <p className="text-xs font-mono text-slate-300 break-all bg-slate-800 rounded-lg px-3 py-2">{partnerResult.webapp_url}</p>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setPartnerResult(null)} className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-400 text-sm font-bold active:scale-95 transition-all">
                            {t.connect_new_bot}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">{t.botfather_token}</label>
                            <Input value={partnerToken} onChange={e => setPartnerToken(e.target.value)} placeholder="1234567890:AAAA..." type="password"/>
                            <p className="text-xs text-slate-500 mt-1">{t.botfather_hint}</p>
                        </div>
                        <button onClick={submitPartnership} disabled={partnerLoading}
                            className="w-full py-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            {partnerLoading ? (
                                <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> {t.checking}</>
                            ) : t.connect_bot}
                        </button>
                        <div className="rounded-xl p-3 bg-slate-800/60 border border-slate-700/50">
                            <p className="text-xs text-slate-500 font-semibold mb-1.5">{t.bot_auto_config}</p>
                            {["✓ Token", "✓ Menu button → MR Kassa", "✓ /start", "✓ Web App URL"].map(item => (
                                <p key={item} className="text-xs text-slate-600">{item}</p>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const Profil = ({ user, lang }) => {
    const navigate = useNavigate();
    const t = translations[lang];
    const balanceUZS = user?.balance_uzs ?? 0;
    const botId = user?.bot_id || null;

    const copyBotId = () => {
        if (!botId) return;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(botId).then(() => toast.success(t.bot_id_copied));
        } else {
            const el = document.createElement('textarea');
            el.value = botId;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            toast.success(t.bot_id_copied);
        }
    };

    return (
        <div className="pb-28 animate-in fade-in duration-300" style={{ paddingTop: 'calc(var(--sa-top) + 12px)' }}>
            {/* Profile header */}
            <div className="p-4 pb-3">
                <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-black font-bold text-2xl shadow-lg flex-shrink-0">
                        {user?.first_name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold leading-tight truncate max-w-[200px]">{user?.first_name}</h1>
                        <p className="text-sm text-slate-500 truncate max-w-[200px]">
                            {user?.username ? `@${user.username}` : `ID: ${user?.internal_id || user?.telegram_id}`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Bot ID card */}
            {botId && (
                <div className="mx-4 mb-4 rounded-2xl overflow-hidden"
                    style={{ background: 'linear-gradient(135deg,#1a1f2e 0%,#0f1420 100%)', border: '1px solid rgba(250,204,21,0.15)' }}>
                    <div className="px-4 pt-3.5 pb-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{user?.username ? `@${user.username}` : user?.first_name}</p>
                    </div>
                    <div className="flex items-center justify-between px-4 pb-3.5">
                        <div>
                            <p className="text-[10px] text-slate-500 mb-0.5">Bot ID</p>
                            <p className="text-lg font-bold tracking-widest text-yellow-400 font-mono">{botId}</p>
                        </div>
                        <button
                            onClick={copyBotId}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all active:scale-95"
                            style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.2)' }}
                        >
                            <Copy size={14} className="text-yellow-400" />
                            <span className="text-xs font-semibold text-yellow-400">{t.copy_label}</span>
                        </button>
                    </div>
                </div>
            )}

            <div className="px-4 space-y-3">
                <NavCard icon={<Wallet size={20}/>} title={t.my_wallet_nav} subtitle={`${balanceUZS.toLocaleString('uz-UZ')} UZS`} accentColor="yellow" onClick={() => navigate('/wallet')}/>
                <NavCard icon={<CreditCard size={20}/>} title={t.wallets_nav} subtitle={t.wallets_nav_sub} accentColor="blue" onClick={() => navigate('/wallets')}/>
                <NavCard icon={<Users size={20}/>} title={t.referral_title} subtitle={t.referral_sub} accentColor="purple" onClick={() => navigate('/referral')}/>
                <NavCard icon={<img src={casinoImg} alt="kazino" className="w-full h-full object-cover rounded-xl"/>} title={t.casino} subtitle="" accentColor="green" onClick={() => navigate('/casino')}/>
            </div>
        </div>
    );
};

const Casino = ({ user, lang }) => {
  const navigate = useNavigate();
  const t = translations[lang];
  return (
    <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300" style={{ background: '#080d18', paddingTop: 'calc(var(--sa-top) + 12px)' }}>
      <div className="px-4 pt-4 pb-3 flex-shrink-0">
        <h1 className="text-2xl font-black text-white">{t.casino_title}</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollable px-4 space-y-3 pb-28">
        {/* Aviator card */}
        <button onClick={() => navigate('/aviator')}
          className="w-full rounded-2xl overflow-hidden transition-all active:scale-95 text-left"
          style={{ background: 'linear-gradient(135deg,#140825 0%,#1f0d45 60%,#0d1825 100%)', border: '1px solid rgba(255,105,53,0.35)' }}>
          <div className="p-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
              style={{ background: '#000', border: '1px solid rgba(255,105,53,0.25)' }}>
              <img src="/aviator-logo.png" alt="Aviator" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="font-black text-xl text-white tracking-wide">AVIATOR</div>
            </div>
            <div className="text-slate-600 text-2xl flex-shrink-0">›</div>
          </div>
          {/* Animated neon bar */}
          <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent, #ff6935, transparent)' }} />
        </button>

        {/* Mines */}
        <button onClick={() => navigate('/mines')}
          className="w-full rounded-2xl overflow-hidden transition-all active:scale-95 text-left"
          style={{ background: 'linear-gradient(135deg,#0d1a25 0%,#1a0d3d 60%,#0a1520 100%)', border: '1px solid rgba(139,92,246,0.35)' }}>
          <div className="p-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
              <img src="/mine-icon.png" alt="Mines" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="font-black text-xl text-white tracking-wide">MINES</div>
            </div>
            <div className="text-slate-600 text-2xl flex-shrink-0">›</div>
          </div>
          <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent, #7c3aed, transparent)' }} />
        </button>
      </div>
    </div>
  );
};

const KassaBalance = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        fetch(`${API_URL}/admin/kassa/balance`).then(r => r.json()).then(r => {
            if (r.success) setData(r.data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);
    if (loading) return <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-400">Yuklanmoqda...</div>;
    if (!data) return <div className="bg-slate-800 rounded-lg p-3 text-sm text-red-400">Olinmadi</div>;
    return <div className="bg-slate-800 rounded-lg p-3 font-mono text-sm text-green-400">{data.balance?.toLocaleString()} {data.currency}</div>;
};

const Admin = ({ user }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState(null);
    const [txs, setTxs] = useState([]);
    const [users, setUsers] = useState([]);
    const [adminCards, setAdminCards] = useState([]);
    const [search, setSearch] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [balanceForm, setBalanceForm] = useState({ amount: '', type: 'credit' });
    const [settings, setSettings] = useState({ deposit_channel_id: '', withdraw_channel_id: '', balance_channel_id: '', balance_withdraw_channel_id: '', exchange_rate: 12800 });
    const [editingChannels, setEditingChannels] = useState({});
    const [savingChannels, setSavingChannels] = useState({});
    const [newCard, setNewCard] = useState({ type: 'uzcard', number: '' });
    const [requiredChannels, setRequiredChannels] = useState([]);
    const [newChannel, setNewChannel] = useState({ channel_id: '', channel_name: '', channel_link: '' });
    const [depositReqs, setDepositReqs] = useState([]);
    const [depositFilter, setDepositFilter] = useState('pending');

    useEffect(() => { 
        if(user?.is_admin || isSuperAdmin(user?.telegram_id)) {
            fetchStats();
            fetchPending();
            fetchUsers();
            fetchSettings();
            fetchAdminCards();
        }
    }, [user]);

    useEffect(() => {
        if ((user?.is_admin || isSuperAdmin(user?.telegram_id)) && activeTab === 'balans') fetchDepositReqs();
    }, [activeTab, depositFilter]);

    const fetchStats = async () => { try { const res = await axios.get(`${API_URL}/admin/stats`); setStats(res.data); } catch (e) { console.error(e); } };
    const fetchPending = async () => { try { const res = await axios.get(`${API_URL}/admin/transactions/pending`); setTxs(res.data); } catch (e) { console.error(e); } };
    const fetchUsers = async () => { try { const res = await axios.get(`${API_URL}/admin/users?search=${search}`); setUsers(res.data); } catch (e) { console.error(e); } };
    const fetchSettings = async () => { try { const res = await axios.get(`${API_URL}/admin/settings`); setSettings(res.data); setRequiredChannels(res.data.required_channels || []); } catch (e) { console.error(e); } };
    const fetchAdminCards = async () => { try { const res = await axios.get(`${API_URL}/admin/cards`); setAdminCards(res.data); } catch (e) { console.error(e); } };
    const fetchDepositReqs = async () => { try { const res = await axios.get(`${API_URL}/admin/balance/deposits?status=${depositFilter}`); setDepositReqs(res.data); } catch (e) { console.error(e); } };

    const handleAction = async (id, action) => { try { await axios.post(`${API_URL}/admin/transactions/${id}/${action}`); toast.success(`Transaction ${action}ed`); fetchPending(); fetchStats(); } catch (e) { toast.error("Action failed"); } };
    const handleDepositAction = async (id, action) => { try { await axios.post(`${API_URL}/admin/balance/deposits/${id}/${action}`); toast.success(action === 'approve' ? "Tasdiqlandi ✅" : "Rad etildi ❌"); fetchDepositReqs(); } catch (e) { toast.error("Xatolik"); } };

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setTimeout(() => fetchUsers(), 500);
    };

    const handleBalanceUpdate = async () => {
        if(!balanceForm.amount) return toast.error("Summani kiriting");
        try {
            await axios.post(`${API_URL}/admin/users/${editingUser.telegram_id}/balance`, balanceForm);
            toast.success("Balans yangilandi");
            setEditingUser(null);
            fetchUsers();
            fetchStats();
        } catch(e) { toast.error("Xatolik"); }
    };

    const handleSaveSettings = async () => {
        try {
            await axios.post(`${API_URL}/admin/settings`, { exchange_rate: settings.exchange_rate });
            toast.success("Kurs saqlandi");
        } catch(e) { toast.error("Xatolik"); }
    };

    const handleChannelSave = async (field, value) => {
        if (!value || !value.trim()) return;
        setSavingChannels(p => ({ ...p, [field]: true }));
        try {
            await axios.patch(`${API_URL}/admin/settings/channel`, { field, value: value.trim() });
            setSettings(p => ({ ...p, [field]: value.trim() }));
            setEditingChannels(p => ({ ...p, [field]: false }));
            toast.success("Saqlandi ✅");
        } catch(e) {
            toast.error("Xatolik yuz berdi");
        } finally {
            setSavingChannels(p => ({ ...p, [field]: false }));
        }
    };

    const handleChannelEdit = (field) => {
        setEditingChannels(p => ({ ...p, [field]: true }));
    };

    const handleAddCard = async () => {
        if(!newCard.number) return toast.error("Raqam kiriting");
        try {
            await axios.post(`${API_URL}/admin/cards`, newCard);
            toast.success("Karta qo'shildi");
            setNewCard({ type: 'uzcard', number: '' });
            fetchAdminCards();
        } catch(e) { toast.error("Xatolik"); }
    };

    const handleDeleteCard = async (id) => {
        try {
            await axios.delete(`${API_URL}/admin/cards/${id}`);
            toast.success("Karta o'chirildi");
            fetchAdminCards();
        } catch(e) { toast.error("Xatolik"); }
    };

    const [sidebarOpen, setSidebarOpen] = useState(false);

    const adminTabs = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Statistika' },
        { id: 'pending',   icon: List,            label: `To'lovlar (${stats?.pending_count || 0})` },
        { id: 'cards',     icon: Wallet,          label: 'Kartalar' },
        { id: 'channels',  icon: Megaphone,       label: 'Kanallar' },
        { id: 'users',     icon: Users,           label: 'Userlar' },
        { id: 'settings',  icon: Settings,        label: 'Sozlama' },
        { id: 'balans',    icon: ArrowDownToLine, label: 'Balans' },
    ];

    if (!user?.is_admin && !isSuperAdmin(user?.telegram_id)) return (
        <div className="p-10 text-center flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <Shield size={40} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Ruxsat yo'q</h2>
            <p className="text-slate-500 mb-6">Admin paneliga kirish uchun admin huquqi kerak</p>
            <Link to="/" className="px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors">
                Bosh sahifaga qaytish
            </Link>
        </div>
    );

    return (
        <div className="flex min-h-screen">

            {/* ── SIDEBAR (desktop: always visible | mobile: burger toggle) ── */}
            <aside className={`
                fixed inset-y-0 left-0 z-[9999] flex flex-col w-60
                bg-[#0d1225] border-r border-slate-800
                transition-transform duration-300 ease-in-out
                md:static md:translate-x-0 md:flex
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Logo / title — safe area for fixed sidebar */}
                <div
                    className="flex items-center justify-between px-5 border-b border-slate-800"
                    style={{
                        paddingTop: 'calc(max(var(--tg-content-safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px), env(safe-area-inset-top, 0px)) + 20px)',
                        paddingBottom: '20px',
                    }}
                >
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={20} className="text-gold" />
                        <span className="text-base font-black text-white tracking-wide">Admin Panel</span>
                    </div>
                    <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    {adminTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all text-left
                                ${activeTab === tab.id
                                    ? 'bg-gold text-black shadow-[0_0_12px_rgba(250,204,21,0.25)]'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <tab.icon size={17} />
                            {tab.label}
                        </button>
                    ))}
                </nav>

                {/* Chiqish */}
                <div className="px-3 py-4 border-t border-slate-800">
                    <Link
                        to="/"
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all font-semibold text-sm"
                    >
                        <LogOut size={17} />
                        Chiqish
                    </Link>
                </div>
            </aside>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-[9998] bg-black/60 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Mobile top bar */}
                <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0d1225] sticky top-0 z-[9997]" style={{ paddingTop: 'calc(var(--sa-top) + 12px)' }}>
                    <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg bg-slate-800 text-white">
                        <Menu size={20} />
                    </button>
                    <span className="text-sm font-bold text-white">
                        {adminTabs.find(t => t.id === activeTab)?.label || 'Admin Panel'}
                    </span>
                    <Link to="/" className="text-xs text-slate-500 font-medium">Chiqish</Link>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-auto p-4 md:p-8 pb-28">

            {activeTab === 'dashboard' && stats && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                    <Card>
                        <div className="text-slate-400 text-xs uppercase mb-1">Jami foydalanuvchilar</div>
                        <div className="text-2xl font-bold">{stats.total_users}</div>
                    </Card>
                    <Card>
                        <div className="text-slate-400 text-xs uppercase mb-1">Jami depozit</div>
                        <div className="text-2xl font-bold text-green-500">{stats.total_deposits.toLocaleString()}</div>
                    </Card>
                    <Card className="col-span-2 highlight">
                        <div className="text-slate-400 text-xs uppercase mb-1">Tizimdagi jami balans</div>
                        <div className="text-3xl font-bold text-gold">{stats.total_balance.toLocaleString()} UZS</div>
                    </Card>
                </div>
            )}

            {activeTab === 'pending' && (
                <div className="space-y-4 animate-in fade-in">
                    {txs.length === 0 ? <div className="text-center text-slate-500 py-10">Kutilayotgan to'lovlar yo'q</div> : txs.map(tx => (
                        <div key={tx.id} className="bg-midnight-light border border-slate-800 p-4 rounded-xl">
                            <div className="flex justify-between items-start mb-4"><div><div className={`text-sm font-bold uppercase ${tx.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>{tx.type === 'deposit' ? "Kirim" : "Chiqim"} So'rovi</div><div className="text-2xl font-bold">{tx.amount.toLocaleString()} <span className="text-sm text-slate-500">{tx.currency}</span></div><div className="text-sm text-slate-400 mt-1">User ID: {tx.user_id}<br/>Tizim: {tx.method}<br/>{tx.wallet_number && `Hamyon: ${tx.wallet_number}`}</div></div><div className="text-xs text-slate-600">{new Date(tx.created_at).toLocaleTimeString()}</div></div>
                            <div className="flex gap-2"><button onClick={() => handleAction(tx.id, 'reject')} className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 transition-colors">Rad etish</button><button onClick={() => handleAction(tx.id, 'approve')} className="flex-1 py-2 rounded-lg bg-green-500/10 text-green-500 font-bold hover:bg-green-500/20 transition-colors">Tasdiqlash</button></div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'cards' && (
                <div className="space-y-6 animate-in fade-in">
                    <Card>
                        <h3 className="font-bold mb-4">Yangi karta qo'shish</h3>
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <select 
                                    className="bg-midnight border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                                    value={newCard.type}
                                    onChange={e => setNewCard({...newCard, type: e.target.value})}
                                >
                                    <option value="uzcard">UZCARD</option>
                                    <option value="humo">HUMO</option>
                                    <option value="mostbet_uzs">MOSTBET UZS</option>
                                    <option value="mostbet_usd">MOSTBET USD</option>
                                </select>
                                <Input 
                                    placeholder="Karta raqam / ID" 
                                    value={newCard.number}
                                    onChange={e => setNewCard({...newCard, number: e.target.value})}
                                />
                            </div>
                            <Button onClick={handleAddCard}>
                                <Plus size={18} className="mr-2"/> Qo'shish
                            </Button>
                        </div>
                    </Card>

                    <div className="space-y-3">
                        {adminCards.map(card => (
                            <div key={card.id} className="bg-midnight-light border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                                        <CreditCard size={20} className={card.type === 'humo' ? 'text-orange-500' : 'text-blue-500'} />
                                    </div>
                                    <div>
                                        <div className="font-bold uppercase">{card.type.replace('_', ' ')}</div>
                                        <div className="text-sm font-mono text-slate-400">{card.number}</div>
                                    </div>
                                </div>
                                <button onClick={() => handleDeleteCard(card.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        {adminCards.length === 0 && <div className="text-center text-slate-500">Kartalar yo'q</div>}
                    </div>
                </div>
            )}

            {activeTab === 'channels' && (
                <div className="space-y-4 animate-in fade-in">
                    <Card>
                        <h3 className="font-bold text-lg mb-4">Majburiy obuna kanallar</h3>
                        <div className="space-y-3 mb-4">
                            <Input placeholder="Kanal ID (masalan: -1001234567890)" value={newChannel.channel_id} onChange={e => setNewChannel({...newChannel, channel_id: e.target.value})} />
                            <Input placeholder="Kanal nomi" value={newChannel.channel_name} onChange={e => setNewChannel({...newChannel, channel_name: e.target.value})} />
                            <Input placeholder="Kanal linki (masalan: https://t.me/kanal)" value={newChannel.channel_link} onChange={e => setNewChannel({...newChannel, channel_link: e.target.value})} />
                            <Button className="w-full" onClick={async () => {
                                if (!newChannel.channel_id || !newChannel.channel_name) return toast.error("Kanal ID va nomini kiriting");
                                try {
                                    await axios.post(`${API_URL}/admin/required_channels/add`, newChannel);
                                    toast.success("Kanal qo'shildi");
                                    setNewChannel({ channel_id: '', channel_name: '', channel_link: '' });
                                    fetchSettings();
                                } catch (e) { toast.error("Xatolik"); }
                            }}>+ Kanal qo'shish</Button>
                        </div>
                        {requiredChannels.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-4">Majburiy kanallar yo'q</p>
                        ) : (
                            <div className="space-y-2">
                                {requiredChannels.map((ch, i) => (
                                    <div key={i} className="flex items-center justify-between bg-midnight rounded-xl p-3 border border-slate-800">
                                        <div>
                                            <div className="font-bold text-sm">{ch.channel_name}</div>
                                            <div className="text-xs text-slate-500">{ch.channel_id}</div>
                                            {ch.channel_link && <div className="text-xs text-blue-400">{ch.channel_link}</div>}
                                        </div>
                                        <button onClick={async () => {
                                            try {
                                                await axios.post(`${API_URL}/admin/required_channels/remove`, { channel_id: ch.channel_id });
                                                toast.success("Kanal o'chirildi");
                                                fetchSettings();
                                            } catch (e) { toast.error("Xatolik"); }
                                        }} className="p-2 text-red-400 hover:text-red-300">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="relative">
                        <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
                        <Input 
                            placeholder="ID yoki Ism bo'yicha qidirish..." 
                            className="pl-10"
                            value={search}
                            onChange={handleSearch}
                        />
                    </div>
                    
                    <div className="space-y-2">
                        {users.map(u => (
                            <div key={u.telegram_id} className="bg-midnight-light border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                                <div>
                                    <div className="font-bold">{u.first_name ?? '—'}</div>
                                    <div className="text-xs text-slate-500">ID: {u.internal_id ?? '—'} | TG: {u.telegram_id}</div>
                                    <div className="text-gold font-mono mt-1">{(u.balance_uzs ?? 0).toLocaleString()} UZS {u.balance_usd > 0 ? `· $${(u.balance_usd ?? 0).toLocaleString()}` : ''}</div>
                                </div>
                                <button 
                                    onClick={() => setEditingUser(u)}
                                    className="p-2 bg-slate-800 rounded-lg text-slate-300 hover:text-white"
                                >
                                    <Edit size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'balans' && (
                <div className="animate-in fade-in pb-10 space-y-4">
                    <div className="flex gap-2">
                        {['pending', 'completed', 'rejected'].map(f => (
                            <button key={f} onClick={() => setDepositFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${depositFilter === f ? 'bg-gold text-black' : 'bg-midnight-light border border-slate-800 text-slate-400'}`}>
                                {f === 'pending' ? "Kutilmoqda" : f === 'completed' ? "Tasdiqlangan" : "Rad etilgan"}
                            </button>
                        ))}
                    </div>
                    {depositReqs.length === 0 ? (
                        <Card><p className="text-center text-slate-500 py-6">So'rovlar yo'q</p></Card>
                    ) : depositReqs.map(req => (
                        <Card key={req.id}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="text-xs text-slate-500 font-mono">#{req.short_id}</p>
                                    <p className="text-sm font-bold text-white mt-0.5">{req.user_bot_id}</p>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' : req.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {req.status === 'pending' ? 'Kutilmoqda' : req.status === 'completed' ? 'Tasdiqlangan' : 'Rad etilgan'}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm mb-3">
                                <span className="text-slate-400">Summa:</span>
                                <span className="font-bold text-white">{req.amount?.toLocaleString()} UZS</span>
                            </div>
                            <div className="flex justify-between text-sm mb-3">
                                <span className="text-slate-400">Karta:</span>
                                <span className="font-mono text-xs text-slate-300">{maskCardFull(req.card_number)}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-4">
                                <span className="text-slate-400">Sana:</span>
                                <span className="text-xs text-slate-400">{req.created_at ? new Date(req.created_at).toLocaleString('uz') : '—'}</span>
                            </div>
                            {req.status === 'pending' && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleDepositAction(req.id, 'approve')}
                                        className="flex-1 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold active:scale-95 transition-all">
                                        ✅ Tasdiqlash
                                    </button>
                                    <button onClick={() => handleDepositAction(req.id, 'reject')}
                                        className="flex-1 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold active:scale-95 transition-all">
                                        ❌ Rad etish
                                    </button>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="animate-in fade-in pb-10">
                    <Card>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Megaphone size={20} className="text-gold" />
                            Kanal Sozlamalari
                        </h3>
                        <div className="space-y-4 mb-6">
                            {[
                                { key: 'deposit_channel_id',          label: '📥 Mostbet/1xbet Depozit Kanali ID' },
                                { key: 'withdraw_channel_id',         label: '📤 Pul Yechish Kanali ID' },
                                { key: 'balance_channel_id',          label: '💳 Balans To\'ldirish Kanali ID' },
                                { key: 'balance_withdraw_channel_id', label: '💸 Balansdan Yechish Kanali ID' },
                            ].map(({ key, label }) => {
                                const isEditing = !!editingChannels[key];
                                const isSaving  = !!savingChannels[key];
                                const locked    = !!settings[key] && !isEditing;
                                return (
                                    <div key={key}>
                                        <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                                        <div className="flex gap-2 items-center">
                                            <Input
                                                value={settings[key] || ''}
                                                disabled={locked || isSaving}
                                                onChange={e => setSettings(p => ({ ...p, [key]: e.target.value }))}
                                                onBlur={e => { if (isEditing) handleChannelSave(key, e.target.value); }}
                                                placeholder="-100..."
                                                className={locked ? "opacity-60 cursor-not-allowed flex-1" : "flex-1"}
                                            />
                                            {isSaving ? (
                                                <span className="shrink-0 text-xs text-slate-400 w-8 text-center">⏳</span>
                                            ) : isEditing ? (
                                                <button
                                                    onMouseDown={e => { e.preventDefault(); handleChannelSave(key, settings[key]); }}
                                                    className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-base active:scale-95 transition-all"
                                                    title="Saqlash"
                                                >✓</button>
                                            ) : (
                                                <button
                                                    onClick={() => handleChannelEdit(key)}
                                                    className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-slate-700/60 border border-slate-600/40 text-slate-300 text-sm active:scale-95 transition-all"
                                                    title="O'zgartirish"
                                                >✏️</button>
                                            )}
                                        </div>
                                        {locked && (
                                            <p className="text-xs text-green-500/70 mt-1">✓ Saqlangan — o'zgartirish uchun ✏️ tugmasini bosing</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Coins size={20} className="text-gold" />
                            Valyuta Kursi
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">1 USD = ? UZS</label>
                                <Input 
                                    type="number"
                                    value={settings.exchange_rate || ''} 
                                    onChange={e => setSettings({...settings, exchange_rate: e.target.value})} 
                                />
                            </div>
                            <Button onClick={handleSaveSettings}>Saqlash</Button>
                        </div>
                    </Card>

                    {/* Kassa Info */}
                    <Card className="border-yellow-500/30 bg-yellow-500/5">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Key size={20} className="text-yellow-500" />
                            Mostbet Kassa
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">API Key</label>
                                <div className="bg-slate-800 rounded-lg p-3 font-mono text-sm text-yellow-500 break-all">
                                    {settings?.mostbet_api_key || 'Sozlanmagan'}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Cashpoint ID</label>
                                <div className="bg-slate-800 rounded-lg p-3 font-mono text-sm text-slate-300">
                                    {settings?.mostbet_cashpoint_id || 'Sozlanmagan'}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Kassa Balansi</label>
                                <KassaBalance />
                            </div>
                            <p className="text-xs text-slate-500">
                                Depozit tasdiqlashda kassa orqali avtomatik o'tkaziladi
                            </p>
                        </div>
                    </Card>
                </div>
            )}

            {editingUser && (
                <div className="fixed inset-0 z-[10001] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <Card className="w-full max-w-sm bg-midnight border-slate-700">
                        <h3 className="font-bold text-lg mb-4">Balansni o'zgartirish</h3>
                        <p className="text-sm text-slate-400 mb-4">Foydalanuvchi: {editingUser.first_name}</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Tur</label>
                                <div className="flex bg-slate-800 rounded-lg p-1">
                                    <button 
                                        onClick={() => setBalanceForm({...balanceForm, type: 'credit'})}
                                        className={`flex-1 py-1 rounded text-sm ${balanceForm.type === 'credit' ? 'bg-green-600 text-white' : 'text-slate-400'}`}
                                    >
                                        Qo'shish (+)
                                    </button>
                                    <button 
                                        onClick={() => setBalanceForm({...balanceForm, type: 'debit'})}
                                        className={`flex-1 py-1 rounded text-sm ${balanceForm.type === 'debit' ? 'bg-red-600 text-white' : 'text-slate-400'}`}
                                    >
                                        Ayirish (-)
                                    </button>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Summa</label>
                                <Input 
                                    type="number"
                                    value={balanceForm.amount}
                                    onChange={e => setBalanceForm({...balanceForm, amount: e.target.value})}
                                    placeholder="0"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button variant="secondary" onClick={() => setEditingUser(null)} className="flex-1">Bekor qilish</Button>
                                <Button onClick={handleBalanceUpdate} className="flex-1">Saqlash</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
                </div>
            </div>
        </div>
    );
};

const STATUS_META = {
  approved: { label: 'Muvaffaqiyatli', cls: 'bg-green-500/15 text-green-400 border border-green-500/20' },
  pending:  { label: 'Kutilmoqda',     cls: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20' },
  rejected: { label: 'Bekor qilingan', cls: 'bg-red-500/15 text-red-400 border border-red-500/20' },
};

const getPlatformLabel = (tx) => {
  const m = (tx.method || '').toLowerCase();
  if (m.includes('mostbet') && tx.currency === 'USD') return 'Mostbet USD';
  if (m.includes('mostbet')) return 'Mostbet UZS';
  if (m.includes('1xbet')) return '1xbet UZS';
  if (m.includes('uzcard')) return 'Uzcard';
  if (m.includes('humo'))   return 'Humo';
  return tx.method || 'MR Kassa';
};

const Reports = ({ user, lang }) => {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);
  const t = translations[lang];

  useEffect(() => {
    if (user?.telegram_id) {
      axios.get(`${API_URL}/transactions/${user.telegram_id}`)
        .then(r => {
          const sorted = (r.data || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          setTxs(sorted);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const getPlatformShort = (tx) => {
    const m = (tx.method || '').toLowerCase();
    if (m === 'internal_sent') return lang === 'uz' ? "P2P o'tkazma" : "P2P перевод";
    if (m === 'internal_received') return lang === 'uz' ? "P2P qabul" : "P2P получено";
    if (m === 'balance') return lang === 'uz' ? "Balans to'ldirish" : "Пополнение баланса";
    if (m.includes('1xbet')) return '1xbet';
    if (m.includes('mostbet')) return 'Mostbet';
    return tx.method || 'BuraPay';
  };

  const getPlatformIcon = (tx) => {
    const m = (tx.method || '').toLowerCase();
    if (m === 'internal_sent') return <ArrowRightLeft size={14} className="text-red-400" />;
    if (m === 'internal_received') return <ArrowRightLeft size={14} className="text-green-400" />;
    if (m === 'balance') return <Wallet size={14} className="text-green-400" />;
    if (m.includes('1xbet')) return <span className="text-[11px] font-extrabold text-blue-400">1X</span>;
    return <span className="text-[11px] font-extrabold text-yellow-400">MB</span>;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300" style={{ background: '#0a0e1a', paddingTop: 'calc(var(--sa-top) + 12px)' }}>

      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h1 className="text-xl font-bold text-white tracking-tight">{t.reports_title}</h1>
        <p className="text-xs text-slate-500 mt-0.5">{t.tx_history}</p>
      </div>

      <div className="flex-1 overflow-y-auto scrollable px-4 pt-4 pb-28">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-2 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
          </div>
        ) : txs.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 space-y-4">
            <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <History size={30} className="text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm font-semibold">{t.no_tx_history}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-0 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            {txs.map((tx, idx) => {
              const platform  = getPlatformShort(tx);
              const isLast    = idx === txs.length - 1;
              const { sign, color, amount: displayAmount } = _txGetAmountSign(tx);
              const statusInfo = _txGetStatusLabel(tx.status, lang);

              return (
                <div
                  key={tx._id || tx.id || idx}
                  className="flex items-center gap-3.5 px-4 py-3.5 active:opacity-60 transition-opacity cursor-pointer"
                  style={{
                    background: idx % 2 === 0 ? 'rgba(15,20,32,1)' : 'rgba(18,24,38,1)',
                    borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)'
                  }}
                  onClick={() => setSelectedTx(tx)}
                >
                  {/* Platform icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{ background: _txGetPlatformBg(tx) }}
                  >
                    {getPlatformIcon(tx)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-tight">{platform}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{_txFmtDateShort(tx.created_at)}</p>
                  </div>

                  {/* Amount + status dot */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-base font-bold leading-tight ${color}`}>
                      {sign}{Number(displayAmount || 0).toLocaleString('uz-UZ')} <span className="text-xs font-semibold">{tx.currency || 'UZS'}</span>
                    </p>
                    <div className="flex justify-end mt-0.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ color: statusInfo.color, background: statusInfo.bg }}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bank receipt modal */}
      {selectedTx && <ReceiptModal tx={selectedTx} lang={lang} onClose={() => setSelectedTx(null)} />}
    </div>
  );
};

// Telegram BackButton — bosh sahifada yashirin, ichki sahifalarda ko'rinadi
function TelegramBackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!tg?.BackButton) return;

    const isHome = location.pathname === "/";

    if (isHome) {
      tg.BackButton.hide();
    } else {
      tg.BackButton.show();
    }

    const handleBack = () => {
      navigate(-1);
    };

    tg.BackButton.onClick(handleBack);

    return () => {
      tg.BackButton.offClick(handleBack);
    };
  }, [location.pathname, navigate]);

  return null;
}

function App() {
  const [user, setUser] = useState(null);
  const [lang, setLang] = useState('uz');
  const [subCheck, setSubCheck] = useState({ loading: true, subscribed: true, channels: [] });

  useEffect(() => { setAxiosLang(lang); }, [lang]);

  useEffect(() => {
    let telegramId = 8321879273;
    let firstName = "Admin";
    let username = "superadmin";

    if (tg?.initDataUnsafe?.user) {
        telegramId = tg.initDataUnsafe.user.id;
        firstName = tg.initDataUnsafe.user.first_name;
        username = tg.initDataUnsafe.user.username;
        // Auto-detect language from Telegram on first open
        if (tg.initDataUnsafe.user.language_code === 'ru') {
            setLang('ru');
            setAxiosLang('ru');
        }
    }

    const login = async () => {
        try {
            const res = await axios.post(`${API_URL}/auth/login`, {
                telegram_id: telegramId,
                first_name: firstName,
                username: username
            });
            setUser(res.data);
            if(res.data.language) { setLang(res.data.language); setAxiosLang(res.data.language); }
            
            // Check subscription
            try {
                const subRes = await axios.get(`${API_URL}/check_subscription/${telegramId}`);
                setSubCheck({ loading: false, subscribed: subRes.data.subscribed, channels: subRes.data.channels || [] });
            } catch {
                setSubCheck({ loading: false, subscribed: true, channels: [] });
            }

            if(tg) {
                tg.ready();
                tg.expand();
            }
        } catch(e) { 
            console.error(e);
            setSubCheck({ loading: false, subscribed: true, channels: [] });
        }
    };
    login();

    // Har 10 soniyada balansni yangilash
    const pollBalance = setInterval(async () => {
        try {
            const res = await axios.get(`${API_URL}/user/${telegramId}`);
            setUser(prev => prev ? { ...prev, ...res.data } : res.data);
        } catch(e) {}
    }, 10000);

    return () => clearInterval(pollBalance);
  }, []);

  const recheckSub = async () => {
    const telegramId = user?.telegram_id || 123456789;
    const t = translations[lang];
    try {
        const res = await axios.get(`${API_URL}/check_subscription/${telegramId}`);
        setSubCheck({ loading: false, subscribed: res.data.subscribed, channels: res.data.channels || [] });
        if (res.data.subscribed) toast.success(t.sub_confirmed);
        else toast.error(t.sub_required);
    } catch {
        setSubCheck(prev => ({ ...prev, loading: false }));
    }
  };

  const t = translations[lang];

  if (subCheck.loading) return <div className="min-h-screen bg-midnight flex items-center justify-center"><div className="text-slate-400">{t.app_loading}</div></div>;

  if (!subCheck.subscribed && !user?.is_admin && !isSuperAdmin(user?.telegram_id)) return (
    <div className="min-h-screen bg-midnight text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold">{t.subscribe_title}</h2>
        <p className="text-slate-400 text-sm">{t.subscribe_desc}</p>
        <div className="space-y-3">
          {subCheck.channels.map((ch, i) => (
            <a key={i} href={ch.channel_link || '#'} target="_blank" rel="noreferrer" className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-colors">
              ➡️ {ch.channel_name}
            </a>
          ))}
        </div>
        <button onClick={recheckSub} className="w-full bg-gold text-black font-bold py-3 px-4 rounded-xl">
          ✅ {t.check_sub}
        </button>
      </div>
      <Toaster position="top-center" theme="dark" />
    </div>
  );

  return (
    <div className="App h-full overflow-hidden bg-midnight text-white font-body selection:bg-gold selection:text-black">
      <BrowserRouter>
        <TelegramBackButton />
        <Routes>
          <Route path="/" element={<Home user={user} lang={lang} setLang={setLang} />} />
          <Route path="/deposit" element={<Otkazmalar user={user} lang={lang} />} />
          <Route path="/transfers" element={<Otkazmalar user={user} lang={lang} />} />
          <Route path="/p2p-transfer" element={<P2PTransfer user={user} lang={lang} setUser={setUser} />} />
          <Route path="/crypto-buy" element={<CryptoBuy user={user} lang={lang} />} />
          <Route path="/stars-buy" element={<StarsBuy user={user} lang={lang} />} />
          <Route path="/mostbet-deposit" element={<Deposit user={user} lang={lang} platform="mostbet" />} />
          <Route path="/mostbet-withdraw" element={<Withdraw user={user} lang={lang} platform="mostbet" />} />
          <Route path="/1xbet-deposit" element={<Deposit user={user} lang={lang} platform="1xbet" />} />
          <Route path="/1xbet-withdraw" element={<Withdraw user={user} lang={lang} platform="1xbet" />} />
          <Route path="/withdraw" element={<WithdrawSelect user={user} lang={lang} />} />
          <Route path="/profil" element={<Profil user={user} lang={lang} />} />
          <Route path="/profile" element={<Profil user={user} lang={lang} />} />
          <Route path="/reports" element={<Reports user={user} lang={lang} />} />
          <Route path="/wallet" element={<WalletPage user={user} lang={lang} />} />
          <Route path="/balance-deposit" element={<BalanceDepositPage user={user} lang={lang} />} />
          <Route path="/wallets" element={<Wallets user={user} lang={lang} />} />
          <Route path="/referral" element={<ReferralPage user={user} lang={lang} />} />
          <Route path="/admin" element={<Admin user={user} />} />
          <Route path="/casino" element={<Casino user={user} lang={lang} />} />
          <Route path="/aviator" element={<AviatorGame user={user} setUser={setUser} />} />
          <Route path="/mines" element={<MinesGame user={user} setUser={setUser} />} />
        </Routes>
        <BottomNav isAdmin={user?.is_admin || isSuperAdmin(user?.telegram_id)} lang={lang} />
      </BrowserRouter>
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}

export default App;
