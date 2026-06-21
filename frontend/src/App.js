import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
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
  Key,
  Trash2,
  Plus,
  Coins,
  Shield,
  ChevronDown
} from "lucide-react";
import axios from "axios";

// Config
const API_URL = process.env.REACT_APP_BACKEND_URL + "/api";

// Telegram Utils
const tg = window.Telegram?.WebApp;

// Translations
const translations = {
  uz: {
    home: "Asosiy",
    otkazmalar: "O'tkazmalar",
    deposit: "To'ldirish",
    withdraw: "Yechish",
    wallets: "Hamyonlar",
    admin: "Admin",
    welcome: "Xush kelibsiz",
    total_balance: "Balansim",
    recent_activity: "Oxirgi amallar",
    view_all: "Barchasi",
    no_tx: "Hozircha amallar yo'q",
    deposit_title: "Hisobni to'ldirish",
    enter_amount: "Kiritiladigan summa",
    confirm_deposit: "To'lovni tasdiqlash",
    secure_tx: "Xavfsiz to'lov. Sizning mablag'ingiz admin tasdiqlaganidan keyin tushadi.",
    withdraw_title: "Mablag'ni yechib olish",
    select_wallet: "Hamyonni tanlang",
    manage_wallets: "Hamyonlarni boshqarish",
    no_wallets: "Yechib olish uchun Mostbet hamyonlari yo'q. Iltimos, qo'shing.",
    withdraw_amount: "Yechiladigan summa",
    request_withdraw: "Pul yechishga so'rov",
    my_wallets: "Mening hamyonlarim",
    add_wallet: "Yangi hamyon qo'shish",
    type: "Tur",
    number_id: "Raqam / ID",
    card_number: "Karta raqami",
    expiry: "Amal qilish muddati",
    cancel: "Bekor qilish",
    save: "Saqlash",
    copied: "Nusxalandi!",
    error: "Xatolik",
    success_deposit: "To'lov so'rovi yuborildi!",
    success_withdraw: "Pul yechish so'rovi yuborildi!",
    success_wallet: "Hamyon qo'shildi",
    enter_valid_amount: "Summani kiriting",
    enter_valid_number: "Raqamni kiriting",
    approved: "Tasdiqlandi",
    rejected: "Bekor qilindi",
    pending: "Kutilmoqda",
    deposit_in: "Kirim",
    withdraw_out: "Chiqim",
    lang_changed: "Til o'zgartirildi",
    min_amount: "Eng kam summa 20,000 UZS",
    transfer_to: "Quyidagi hisobga o'tkazing:",
    copy_num: "Raqamdan nusxa olish",
    i_paid: "To'lov qildim",
    mostbet_id: "Mostbet ID raqami",
    secret_code: "Tasdiqlash kodi",
    code_placeholder: "Mostbet kodi (8 xonali)",
    add_card_required: "Iltimos, avval Uzcard yoki Humo karta qo'shing!",
    select_card_to_pay: "To'lov kartasini tanlang",
    admin_cards: "Qabul qiluvchi hamyonlar",
    choose_currency: "Valyutani tanlang",
    exchange_rate: "Kurs"
  },
  ru: {
    home: "Главная",
    otkazmalar: "Переводы",
    deposit: "Пополнить",
    withdraw: "Вывести",
    wallets: "Кошельки",
    admin: "Админ",
    welcome: "Добро пожаловать",
    total_balance: "Общий баланс",
    recent_activity: "Последние действия",
    view_all: "Все",
    no_tx: "Пока нет операций",
    deposit_title: "Пополнение счета",
    enter_amount: "Сумма пополнения",
    confirm_deposit: "Подтвердить платеж",
    secure_tx: "Безопасный платеж. Средства будут зачислены после подтверждения.",
    withdraw_title: "Вывод средств",
    select_wallet: "Выберите кошелек",
    manage_wallets: "Управление кошельками",
    no_wallets: "Нет Mostbet кошельков для вывода. Пожалуйста, добавьте.",
    withdraw_amount: "Сумма вывода",
    request_withdraw: "Запросить вывод",
    my_wallets: "Мои кошельки",
    add_wallet: "Добавить кошелек",
    type: "Тип",
    number_id: "Номер / ID",
    card_number: "Номер карты",
    expiry: "Срок действия",
    cancel: "Отмена",
    save: "Сохранить",
    copied: "Скопировано!",
    error: "Ошибка",
    success_deposit: "Запрос отправлен!",
    success_withdraw: "Запрос отправлен!",
    success_wallet: "Кошелек добавлен",
    enter_valid_amount: "Введите сумму",
    enter_valid_number: "Введите номер",
    approved: "Одобрено",
    rejected: "Отклонено",
    pending: "Ожидание",
    deposit_in: "Ввод",
    withdraw_out: "Вывод",
    lang_changed: "Язык изменен",
    min_amount: "Минимальная сумма 20,000 UZS",
    transfer_to: "Переведите на этот счет:",
    copy_num: "Копировать номер",
    i_paid: "Я оплатил",
    mostbet_id: "Номер Mostbet ID",
    secret_code: "Код подтверждения",
    code_placeholder: "Код Mostbet (8 знаков)",
    add_card_required: "Пожалуйста, сначала добавьте карту Uzcard или Humo!",
    select_card_to_pay: "Выберите карту для оплаты",
    admin_cards: "Кошельки для приема",
    choose_currency: "Выберите валюту",
    exchange_rate: "Курс"
  }
};

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

const BottomNav = ({ isAdmin, lang }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;
  const t = translations[lang];
  
  const navItems = [
    { icon: <Wallet size={20} />, label: t.home, path: "/" },
    { icon: <ArrowUpRight size={20} />, label: t.otkazmalar, path: "/deposit" },
    { icon: <CreditCard size={20} />, label: "Profil", path: "/profil" },
  ];

  if (isAdmin) {
      navItems.push({ icon: <UserCheck size={20} />, label: t.admin, path: "/admin" });
  }

  if (location.pathname.startsWith('/admin')) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-midnight/90 backdrop-blur-lg border-t border-slate-800 pb-safe pt-2 px-6 flex justify-between items-center z-[10000] h-20">
      {navItems.map((item) => (
        <Link 
          key={item.path} 
          to={item.path}
          className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
            isActive(item.path) ? "text-primary" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
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
      <div className="flex justify-between items-center px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-black font-bold text-lg shadow-lg">
            {user.first_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-xs text-slate-400">{lang === 'uz' ? 'Salom,' : 'Привет,'}</p>
            <h1 className="text-base font-bold leading-tight">{user.first_name}</h1>
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
              <span className="text-4xl font-bold tracking-tight text-white">
                {balanceVisible ? (balanceUZS).toLocaleString('uz-UZ') : '••••••'}
              </span>
              <span className="text-lg font-semibold text-yellow-400 mb-1">UZS</span>
            </div>
            {balanceUZS === 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === 'uz' ? "Hisobingizda mablag' yo'q" : "На счёте нет средств"}
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
              <span className="text-xs text-slate-400">ID: {user.internal_id || user.telegram_id}</span>
            </div>
            <div className="flex gap-1">
              <div className="w-5 h-5 rounded-full bg-yellow-500 opacity-80 -mr-2"></div>
              <div className="w-5 h-5 rounded-full bg-red-500 opacity-80"></div>
            </div>
          </div>
        </div>
      </div>



      {/* Recent Activity */}
      <div className="px-4 mt-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold">{t.recent_activity}</h3>
          <span className="text-xs text-slate-500">{history.length} {lang === 'uz' ? 'ta' : 'шт'}</span>
        </div>
        <div className="space-y-2">
          {history.length === 0 ? (
            <div className="text-center py-10 text-slate-600 bg-midnight-light rounded-2xl border border-slate-800 border-dashed">
              <History size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t.no_tx}</p>
            </div>
          ) : (
            history.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3.5 bg-midnight-light border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    tx.type === 'deposit' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {tx.type === 'deposit' ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-white">
                      {tx.type === 'deposit' ? t.deposit_in : t.withdraw_out}
                    </div>
                    <div className="text-xs text-slate-500">{new Date(tx.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-sm ${tx.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.type === 'deposit' ? '+' : '-'}{tx.amount.toLocaleString()} {tx.currency}
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                    tx.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                    tx.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                    'bg-yellow-500/10 text-yellow-500'
                  }`}>
                    {tx.status === 'approved' ? t.approved : tx.status === 'rejected' ? t.rejected : t.pending}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const Otkazmalar = ({ lang }) => {
  const navigate = useNavigate();
  return (
    <div className="p-4 pb-28 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-2xl font-bold">{translations[lang].otkazmalar}</h1>

      {/* Mostbet */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <span className="text-xs font-extrabold text-yellow-400">MB</span>
          </div>
          <h2 className="text-lg font-bold text-white">Mostbet</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/mostbet-deposit')}
            className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center">
              <ArrowDownToLine size={20} className="text-yellow-400" />
            </div>
            <span className="text-sm font-bold text-yellow-400">To'ldirish</span>
          </button>
          <button
            onClick={() => navigate('/mostbet-withdraw')}
            className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-slate-700/30 border border-slate-700/50 hover:bg-slate-700/50 active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-slate-600/50 flex items-center justify-center">
              <ArrowUpFromLine size={20} className="text-slate-300" />
            </div>
            <span className="text-sm font-bold text-slate-300">Yechish</span>
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
          <button
            onClick={() => navigate('/1xbet-deposit')}
            className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-blue-400/20 flex items-center justify-center">
              <ArrowDownToLine size={20} className="text-blue-400" />
            </div>
            <span className="text-sm font-bold text-blue-400">To'ldirish</span>
          </button>
          <button
            onClick={() => navigate('/1xbet-withdraw')}
            className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-slate-700/30 border border-slate-700/50 hover:bg-slate-700/50 active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-slate-600/50 flex items-center justify-center">
              <ArrowUpFromLine size={20} className="text-slate-300" />
            </div>
            <span className="text-sm font-bold text-slate-300">Yechish</span>
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
      if(!userPlatformId) return toast.error("Avval " + platformLabel + " ID ni hamyonlarimga saqlang");
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
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/deposit')} className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 active:scale-95 transition-all">
          <ArrowDownLeft size={18} className="rotate-45" />
        </button>
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
                <label className="text-sm text-slate-400 mb-3 block">{platformLabel} ID raqamingiz</label>
                {userPlatformId ? (
                    <div className="flex items-center justify-between">
                        <span className="text-xl font-mono font-bold text-white">{userPlatformId}</span>
                        <button onClick={copyId} className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 active:scale-95 transition-all">
                            <Copy size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-sm">ID kiritilmagan</span>
                        <button onClick={() => navigate('/wallets')} className="text-primary text-sm font-bold">Qo'shish</button>
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
                            <span className="text-slate-400">Jami UZS:</span>
                            <span className="text-xl font-bold text-primary">{calculatedUZS} UZS</span>
                        </div>
                    </div>
                )}
            </Card>

            <Button onClick={handleNext} className="w-full py-4 text-lg">Davom etish</Button>
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
                      <span className="text-slate-400 text-sm">Summa</span>
                      <span className="font-bold text-white text-lg">{Number(amount).toLocaleString()} {currency}</span>
                  </div>
                  {(() => {
                      const adminCard = getAdminCard();
                      return adminCard ? (
                          <div className="flex justify-between items-center border-t border-slate-700/50 pt-4">
                              <span className="text-slate-400 text-sm">To'lov karta</span>
                              <div className="flex items-center gap-2">
                                  <span className="font-mono text-slate-300 text-sm">{adminCard.number}</span>
                                  <button onClick={() => { navigator.clipboard.writeText(adminCard.number); toast.success(t.copied); }} className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 active:scale-95 transition-all">
                                      <Copy size={12} />
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className="border-t border-slate-700/50 pt-4 text-center text-slate-500 text-sm">
                              Admin karta kiritilmagan
                          </div>
                      );
                  })()}
              </Card>

              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm text-blue-200">
                <CheckCircle2 className="inline-block mr-2 mb-1" size={16} />
                Yuqoridagi kartaga pul o'tkazing, keyin "To'lov qildim" tugmasini bosing.
              </div>

              <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">Ortga</Button>
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
    if (!code || code.length < 6) return toast.error("Kodni kiriting");

    let verifyData;
    try {
        const res = await axios.post(`${API_URL}/transactions/verify_code`, {
            code: code,
            player_id: selectedWallet.number
        });
        verifyData = res.data;
    } catch (err) {
        return toast.error(err.response?.data?.detail || "Noto'g'ri kod");
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
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/deposit')} className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 active:scale-95 transition-all">
          <ArrowDownLeft size={18} className="rotate-45" />
        </button>
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
                                    toast.success("Kod tasdiqlandi!");
                                }).catch((err) => {
                                    toast.error(err.response?.data?.detail || "Xatolik");
                                });
                            }
                        }}
                        placeholder={platform === "1xbet" ? "1xbet kodi (6 xonali)" : t.code_placeholder}
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

const PageHeader = ({ title, onBack }) => {
    const navigate = useNavigate();
    return (
        <div className="flex items-center gap-3 p-4 border-b border-slate-800 sticky top-0 bg-midnight z-10">
            <button
                onClick={onBack || (() => navigate(-1))}
                className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center active:scale-95 transition-all duration-200"
            >
                <ChevronRight size={18} className="rotate-180 text-white"/>
            </button>
            <h1 className="text-lg font-bold">{title}</h1>
        </div>
    );
};

const WalletPage = ({ user }) => {
    const navigate = useNavigate();
    const balanceUZS = user?.balance_uzs ?? 0;
    const balanceUSD = user?.balance_usd ?? 0;
    return (
        <div className="min-h-screen pb-28 animate-in fade-in duration-300">
            <PageHeader title="Hamyonim"/>
            <div className="p-4 space-y-4">
                <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg,#1a1f2e 0%,#0f1420 50%,#1a2a1a 100%)", border: "1px solid rgba(250,204,21,0.15)" }}>
                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Mening hisobim</p>
                    <div className="flex items-end gap-2 mb-2">
                        <span className="text-3xl font-bold text-white">{balanceUZS.toLocaleString('uz-UZ')}</span>
                        <span className="text-base font-semibold text-yellow-400 mb-0.5">UZS</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1 w-fit">
                        <span className="text-xs text-slate-400">USD</span>
                        <span className="text-sm font-bold text-white">${balanceUSD.toFixed(2)}</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => navigate('/deposit')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 font-bold text-sm active:scale-95 transition-all duration-200">
                        <ArrowDownToLine size={16}/> To'ldirish
                    </button>
                    <button onClick={() => navigate('/withdraw')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 border border-white/10 text-white font-bold text-sm active:scale-95 transition-all duration-200">
                        <ArrowUpFromLine size={16}/> Yechish
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

const WalletModal = ({ platform, existingId, existingCard, onSave, onClose, saving }) => {
    const [idVal, setIdVal] = useState(existingId || '');
    const [cardVal, setCardVal] = useState(existingCard ? existingCard.replace(/(\d{4})(?=\d)/g, '$1 ') : '');
    const ac = platform.accentClasses;

    const handleSave = () => {
        if (!idVal.trim()) return toast.error(platform.idLabel + " kiriting");
        onSave(idVal.trim(), cardVal.replace(/\s/g, ''));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
            <div
                className="relative w-full max-w-lg rounded-t-2xl p-5 pb-8 space-y-4 animate-in slide-in-from-bottom duration-300"
                style={{ background: 'linear-gradient(180deg,#1a1f2e 0%,#0f1420 100%)', border: '1px solid rgba(255,255,255,0.08)' }}
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
                        <label className="text-xs text-slate-400 mb-1.5 block">Karta raqami <span className="text-slate-600">(ixtiyoriy)</span></label>
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
                    {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
            </div>
        </div>
    );
};

const Wallets = ({ user, lang }) => {
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
            toast.success("Saqlandi!");
            setModal(null);
            await fetchWallets();
        } catch(e) { toast.error("Xatolik yuz berdi"); }
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
            toast.success("O'chirildi!");
            await fetchWallets();
        } catch(e) { toast.error("Xatolik yuz berdi"); }
        finally { setDeletingKey(null); }
    };

    const groups = WALLET_PLATFORMS.map(p => ({ platform: p, ...getGroup(p) }));
    const savedGroups = groups.filter(g => g.hasData);
    const unsavedPlatforms = groups.filter(g => !g.hasData).map(g => g.platform);

    return (
        <div className="min-h-screen pb-28 animate-in fade-in duration-300">
            <PageHeader title="Hamyonlarim"/>
            <div className="p-4 space-y-3">

                {loading ? (
                    <div className="flex justify-center pt-12">
                        <div className="w-6 h-6 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin"/>
                    </div>
                ) : savedGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-16 pb-8 space-y-3">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                            <CreditCard size={28} className="text-slate-600"/>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">Hozircha hamyonlar qo'shilmagan</p>
                        <p className="text-slate-600 text-xs">Pastdagi tugmani bosib qo'shing</p>
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
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 border border-white/10 text-slate-300 text-xs font-semibold active:scale-95 transition-all"
                                        >
                                            <Edit size={12}/> Tahrirlash
                                        </button>
                                        <button
                                            onClick={() => handleDelete(platform)}
                                            disabled={isDeleting}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            <Trash2 size={12}/> {isDeleting ? '...' : "O'chirish"}
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
                                            <span className="text-xs text-slate-500 w-16 shrink-0">Karta:</span>
                                            <span className="text-sm font-semibold text-slate-300 font-mono tracking-wider">{maskCard(cardWallet.number)}</span>
                                        </div>
                                    )}
                                    {!cardWallet && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 w-16 shrink-0">Karta:</span>
                                            <span className="text-xs text-slate-600 italic">Qo'shilmagan</span>
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
                                <p className="text-sm font-semibold text-slate-400">{platform.name} qo'shish</p>
                                <p className="text-xs text-slate-600">ID va karta raqamini kiriting</p>
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
                    onSave={(idVal, cardVal) => handleSave(modal.platform, idVal, cardVal)}
                    onClose={() => !saving && setModal(null)}
                />
            )}
        </div>
    );
};

const ReferralPage = ({ user }) => {
    const BOT_USERNAME = 'MR_KASSABOT';
    const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${user?.telegram_id}`;
    return (
        <div className="min-h-screen pb-28 animate-in fade-in duration-300">
            <PageHeader title="Referal"/>
            <div className="p-4 space-y-4">
                <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-xs text-slate-400 mb-1">Sizning havolangiz:</p>
                    <p className="text-sm font-mono text-yellow-400 break-all">{referralLink}</p>
                </div>
                <button
                    onClick={() => { navigator.clipboard.writeText(referralLink); toast.success("Nusxalandi!"); }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 font-bold active:scale-95 transition-all duration-200"
                >
                    <Copy size={16}/> Nusxa olish
                </button>
            </div>
        </div>
    );
};

const PartnershipPage = ({ user }) => {
    const [partnerToken, setPartnerToken] = useState('');
    const [partnerName, setPartnerName] = useState('');
    const [partnerResult, setPartnerResult] = useState(null);
    const [partnerLoading, setPartnerLoading] = useState(false);

    const submitPartnership = async () => {
        if (!partnerToken.trim()) return toast.error("Token kiriting");
        setPartnerLoading(true);
        try {
            const res = await axios.post(`${API_URL}/partnership/apply`, { telegram_id: user.telegram_id, bot_token: partnerToken, bot_name: partnerName });
            setPartnerResult(res.data);
            toast.success("Bot muvaffaqiyatli ulandi!");
            setPartnerToken(''); setPartnerName('');
        } catch(e) {
            const msg = e.response?.data?.detail || "Xatolik yuz berdi";
            toast.error(msg);
        } finally { setPartnerLoading(false); }
    };

    return (
        <div className="min-h-screen pb-28 animate-in fade-in duration-300">
            <PageHeader title="Hamkorlik"/>
            <div className="p-4">
                {partnerResult ? (
                    <div className="space-y-3">
                        <div className="rounded-xl p-4 bg-green-500/10 border border-green-500/30">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 size={18} className="text-green-400"/>
                                <p className="font-bold text-green-400">Bot muvaffaqiyatli ulandi!</p>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                                    <span className="text-slate-400">Bot nomi</span>
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
                            Yangi bot ulash
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">BotFather tokeni</label>
                            <Input value={partnerToken} onChange={e => setPartnerToken(e.target.value)} placeholder="1234567890:AAAA..." type="password"/>
                            <p className="text-xs text-slate-500 mt-1">BotFather → /newbot yoki /mybots → API token</p>
                        </div>
                        <button onClick={submitPartnership} disabled={partnerLoading}
                            className="w-full py-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            {partnerLoading ? (
                                <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Tekshirilmoqda...</>
                            ) : "Botni ulash"}
                        </button>
                        <div className="rounded-xl p-3 bg-slate-800/60 border border-slate-700/50">
                            <p className="text-xs text-slate-500 font-semibold mb-1.5">Avtomatik sozlanadi:</p>
                            {["✓ Token tekshiriladi", "✓ Menu button → BuraPay", "✓ /start komandasi", "✓ Web App URL aniqlanadi"].map(item => (
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
    const balanceUZS = user?.balance_uzs ?? 0;

    return (
        <div className="pb-28 animate-in fade-in duration-300">
            <div className="p-4 pb-3">
                <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-black font-bold text-2xl shadow-lg flex-shrink-0">
                        {user?.first_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{user?.first_name}</h1>
                        <p className="text-sm text-slate-400">ID: {user?.internal_id || user?.telegram_id}</p>
                    </div>
                </div>
            </div>
            <div className="px-4 space-y-3">
                <NavCard icon={<Wallet size={20}/>} title="Hamyonim" subtitle={`${balanceUZS.toLocaleString('uz-UZ')} UZS`} accentColor="yellow" onClick={() => navigate('/wallet')}/>
                <NavCard icon={<CreditCard size={20}/>} title="Hamyonlarim" subtitle="Mostbet va 1xbet ID / Karta" accentColor="blue" onClick={() => navigate('/wallets')}/>
                <NavCard icon={<Users size={20}/>} title="Referal" subtitle="Do'stlaringizni taklif qiling" accentColor="purple" onClick={() => navigate('/referral')}/>
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
    const [settings, setSettings] = useState({ deposit_channel_id: '', withdraw_channel_id: '', exchange_rate: 12800 });
    const [newCard, setNewCard] = useState({ type: 'uzcard', number: '' });
    const [requiredChannels, setRequiredChannels] = useState([]);
    const [newChannel, setNewChannel] = useState({ channel_id: '', channel_name: '', channel_link: '' });

    useEffect(() => { 
        if(user?.is_admin) {
            fetchStats();
            fetchPending();
            fetchUsers();
            fetchSettings();
            fetchAdminCards();
        }
    }, [user]);

    const fetchStats = async () => { try { const res = await axios.get(`${API_URL}/admin/stats`); setStats(res.data); } catch (e) { console.error(e); } };
    const fetchPending = async () => { try { const res = await axios.get(`${API_URL}/admin/transactions/pending`); setTxs(res.data); } catch (e) { console.error(e); } };
    const fetchUsers = async () => { try { const res = await axios.get(`${API_URL}/admin/users?search=${search}`); setUsers(res.data); } catch (e) { console.error(e); } };
    const fetchSettings = async () => { try { const res = await axios.get(`${API_URL}/admin/settings`); setSettings(res.data); setRequiredChannels(res.data.required_channels || []); } catch (e) { console.error(e); } };
    const fetchAdminCards = async () => { try { const res = await axios.get(`${API_URL}/admin/cards`); setAdminCards(res.data); } catch (e) { console.error(e); } };

    const handleAction = async (id, action) => { try { await axios.post(`${API_URL}/admin/transactions/${id}/${action}`); toast.success(`Transaction ${action}ed`); fetchPending(); fetchStats(); } catch (e) { toast.error("Action failed"); } };

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
            await axios.post(`${API_URL}/admin/settings`, settings);
            toast.success("Sozlamalar saqlandi");
        } catch(e) { toast.error("Xatolik"); }
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

    if (!user?.is_admin) return (
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
        <div className="p-6 pb-24">
            <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-bold">Admin Panel</h1><Link to="/" className="text-sm text-slate-500">Chiqish</Link></div>
            
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                {[
                    { id: 'dashboard', icon: LayoutDashboard, label: 'Statistika' },
                    { id: 'pending', icon: List, label: `To'lovlar (${stats?.pending_count || 0})` },
                    { id: 'cards', icon: Wallet, label: 'Kartalar' },
                    { id: 'channels', icon: Users, label: 'Kanallar' },
                    { id: 'users', icon: Users, label: 'Userlar' },
                    { id: 'settings', icon: Settings, label: 'Sozlama' },
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                            activeTab === tab.id 
                            ? 'bg-gold text-black' 
                            : 'bg-midnight-light border border-slate-800 text-slate-400'
                        }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

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
                                    <div className="font-bold">{u.first_name}</div>
                                    <div className="text-xs text-slate-500">ID: {u.internal_id} | TG: {u.telegram_id}</div>
                                    <div className="text-gold font-mono mt-1">{u.balance.toLocaleString()} UZS</div>
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

            {activeTab === 'settings' && (
                <div className="animate-in fade-in pb-10">
                    <Card>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Megaphone size={20} className="text-gold" />
                            Kanal Sozlamalari
                        </h3>
                        <div className="space-y-4 mb-6">
                            <div><label className="text-xs text-slate-400 mb-1 block">Depozit Kanali ID</label><Input value={settings.deposit_channel_id || ''} onChange={e => setSettings({...settings, deposit_channel_id: e.target.value})} placeholder="-100..." /></div>
                            <div><label className="text-xs text-slate-400 mb-1 block">Pul Yechish Kanali ID</label><Input value={settings.withdraw_channel_id || ''} onChange={e => setSettings({...settings, withdraw_channel_id: e.target.value})} placeholder="-100..." /></div>
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
    );
};

function App() {
  const [user, setUser] = useState(null);
  const [lang, setLang] = useState('uz');
  const [subCheck, setSubCheck] = useState({ loading: true, subscribed: true, channels: [] });

  useEffect(() => {
    let telegramId = 123456789;
    let firstName = "Demo User";
    let username = "demouser";

    if (tg?.initDataUnsafe?.user) {
        telegramId = tg.initDataUnsafe.user.id;
        firstName = tg.initDataUnsafe.user.first_name;
        username = tg.initDataUnsafe.user.username;
    }

    const login = async () => {
        try {
            const res = await axios.post(`${API_URL}/auth/login`, {
                telegram_id: telegramId,
                first_name: firstName,
                username: username
            });
            setUser(res.data);
            if(res.data.language) setLang(res.data.language);
            
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
  }, []);

  const recheckSub = async () => {
    const telegramId = user?.telegram_id || 123456789;
    try {
        const res = await axios.get(`${API_URL}/check_subscription/${telegramId}`);
        setSubCheck({ loading: false, subscribed: res.data.subscribed, channels: res.data.channels || [] });
        if (res.data.subscribed) toast.success("Obuna tasdiqlandi!");
        else toast.error("Kanallarga obuna bo'ling!");
    } catch {
        setSubCheck(prev => ({ ...prev, loading: false }));
    }
  };

  if (subCheck.loading) return <div className="min-h-screen bg-midnight flex items-center justify-center"><div className="text-slate-400">Yuklanmoqda...</div></div>;

  if (!subCheck.subscribed && !user?.is_admin) return (
    <div className="min-h-screen bg-midnight text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold">{lang === 'ru' ? 'Подпишитесь на каналы' : 'Kanallarga obuna bo\'ling'}</h2>
        <p className="text-slate-400 text-sm">{lang === 'ru' ? 'Для использования приложения подпишитесь на каналы ниже' : 'Ilovadan foydalanish uchun quyidagi kanallarga obuna bo\'ling'}</p>
        <div className="space-y-3">
          {subCheck.channels.map((ch, i) => (
            <a key={i} href={ch.channel_link || '#'} target="_blank" rel="noreferrer" className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-colors">
              ➡️ {ch.channel_name}
            </a>
          ))}
        </div>
        <button onClick={recheckSub} className="w-full bg-gold text-black font-bold py-3 px-4 rounded-xl">
          ✅ {lang === 'ru' ? 'Проверить' : 'Tekshirish'}
        </button>
      </div>
      <Toaster position="top-center" theme="dark" />
    </div>
  );

  return (
    <div className="App min-h-screen bg-midnight text-white font-body selection:bg-gold selection:text-black">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home user={user} lang={lang} setLang={setLang} />} />
          <Route path="/deposit" element={<Otkazmalar lang={lang} />} />
          <Route path="/mostbet-deposit" element={<Deposit user={user} lang={lang} platform="mostbet" />} />
          <Route path="/mostbet-withdraw" element={<Withdraw user={user} lang={lang} platform="mostbet" />} />
          <Route path="/1xbet-deposit" element={<Deposit user={user} lang={lang} platform="1xbet" />} />
          <Route path="/1xbet-withdraw" element={<Withdraw user={user} lang={lang} platform="1xbet" />} />
          <Route path="/withdraw" element={<Withdraw user={user} lang={lang} platform="mostbet" />} />
          <Route path="/profil" element={<Profil user={user} lang={lang} />} />
          <Route path="/wallet" element={<WalletPage user={user} />} />
          <Route path="/wallets" element={<Wallets user={user} lang={lang} />} />
          <Route path="/referral" element={<ReferralPage user={user} />} />
          <Route path="/admin" element={<Admin user={user} />} />
        </Routes>
        <BottomNav isAdmin={user?.is_admin} lang={lang} />
      </BrowserRouter>
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}

export default App;
