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
  Coins
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
    deposit: "To'ldirish",
    withdraw: "Yechish",
    wallets: "Hamyonlar",
    admin: "Admin",
    welcome: "Xush kelibsiz",
    total_balance: "Umumiy hisob",
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
    { icon: <ArrowUpRight size={20} />, label: t.deposit, path: "/deposit" },
    { icon: <ArrowDownLeft size={20} />, label: t.withdraw, path: "/withdraw" },
    { icon: <CreditCard size={20} />, label: t.wallets, path: "/wallets" },
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

  if (!user) return <div className="p-8 text-center text-slate-500">...</div>;

  return (
    <div className="pb-40 p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-gold font-bold text-lg">
                {user.first_name?.[0]}
            </div>
            <div>
                <h2 className="text-xs text-slate-400 font-body uppercase tracking-wider">ID: {user.internal_id || "..."}</h2>
                <h1 className="text-xl font-bold leading-none">{user.first_name}</h1>
            </div>
        </div>
        <div className="flex gap-2">
            <button onClick={toggleLang} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                {lang === 'uz' ? '🇺🇿' : '🇷🇺'}
            </button>
            <Link to="/wallets" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                <CreditCard size={20} />
            </Link>
        </div>
      </div>

      {/* Balance Card */}
      <Card highlight className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <h3 className="text-slate-400 text-sm font-medium mb-1">{t.total_balance}</h3>
        <div className="text-4xl font-bold text-white mb-4">
          {user.balance.toLocaleString()} <span className="text-gold text-2xl">UZS</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/deposit" className="w-full">
            <Button className="w-full text-sm py-2">
               <ArrowUpRight size={18} /> {t.deposit}
            </Button>
          </Link>
          <Link to="/withdraw" className="w-full">
             <Button variant="secondary" className="w-full text-sm py-2">
               <ArrowDownLeft size={18} /> {t.withdraw}
             </Button>
          </Link>
        </div>
      </Card>

      {/* Recent Activity */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold">{t.recent_activity}</h3>
          <button className="text-primary text-sm">{t.view_all}</button>
        </div>
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-600 bg-midnight-light rounded-xl border border-slate-800 border-dashed">
                {t.no_tx}
            </div>
          ) : (
            history.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 bg-midnight-light border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === 'deposit' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {tx.type === 'deposit' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                  </div>
                  <div>
                    <div className="font-bold text-white capitalize">{tx.type === 'deposit' ? t.deposit_in : t.withdraw_out}</div>
                    <div className="text-xs text-slate-500">{new Date(tx.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${
                    tx.type === 'deposit' ? 'text-green-500' : 'text-white'
                  }`}>
                    {tx.type === 'deposit' ? '+' : '-'}{tx.amount.toLocaleString()} {tx.currency}
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${
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

const Deposit = ({ user, lang }) => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UZS"); // UZS, USD
  const [selectedAdminCard, setSelectedAdminCard] = useState(null); 
  const [step, setStep] = useState(1); 
  const [adminCards, setAdminCards] = useState([]);
  const [adminSettings, setAdminSettings] = useState({});
  const t = translations[lang];

  useEffect(() => {
      // Check for card presence
      if (user?.wallets) {
          const hasCard = user.wallets.some(w => w.type === 'uzcard' || w.type === 'humo');
          if (!hasCard) {
              toast.error(t.add_card_required);
              navigate('/wallets');
              return;
          }
      }
      fetchAdminData();
  }, [user, navigate, t.add_card_required]);

  const fetchAdminData = async () => {
      try { 
          const [cardsRes, settingsRes] = await Promise.all([
              axios.get(`${API_URL}/admin/cards`),
              axios.get(`${API_URL}/admin/settings`)
          ]);
          setAdminCards(cardsRes.data); 
          setAdminSettings(settingsRes.data);
      } catch(e) {}
  };

  const handleNext = () => {
      if(!amount) return toast.error(t.enter_valid_amount);
      if(currency === 'UZS' && Number(amount) < 20000) return toast.error(t.min_amount);
      if(!selectedAdminCard) return toast.error(t.select_card_to_pay);
      setStep(2);
  };

  const handleDeposit = async () => {
    try {
      await axios.post(`${API_URL}/transactions/create`, {
        user_id: user.telegram_id,
        type: "deposit",
        amount: Number(amount),
        currency: currency,
        method: `${selectedAdminCard.type.toUpperCase().replace('_', ' ')} (Admin)`,
        wallet_number: "External", 
        manual_check: true
      });
      toast.success(t.success_deposit);
      navigate("/");
    } catch (e) { toast.error(t.error); }
  };

  const copyAccount = () => {
      if(selectedAdminCard?.number) {
          navigator.clipboard.writeText(selectedAdminCard.number);
          toast.success(t.copied);
      }
  };

  // Filter cards based on user currency selection
  const filteredCards = adminCards.filter(c => {
      if (currency === 'UZS') return ['uzcard', 'humo', 'mostbet_uzs'].includes(c.type);
      if (currency === 'USD') return ['uzcard', 'humo', 'mostbet_usd'].includes(c.type); // Allow Uzcard/Humo for USD too
      return false; 
  });

  const usdRate = adminSettings.exchange_rate || 12800;
  const calculatedUZS = amount ? (Number(amount) * usdRate).toLocaleString() : 0;

  return (
    <div className="p-4 space-y-6 pb-24">
      <h1 className="text-2xl font-bold">{t.deposit_title}</h1>
      
      {step === 1 ? (
          <div className="space-y-6 animate-in fade-in">
            
            {/* Currency Toggle */}
            <div className="bg-midnight-light p-1 rounded-xl flex">
                <button 
                    onClick={() => { setCurrency('UZS'); setSelectedAdminCard(null); }}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${currency === 'UZS' ? 'bg-primary text-black shadow-lg' : 'text-slate-400'}`}
                >
                    UZS
                </button>
                <button 
                    onClick={() => { setCurrency('USD'); setSelectedAdminCard(null); }}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${currency === 'USD' ? 'bg-primary text-black shadow-lg' : 'text-slate-400'}`}
                >
                    USD
                </button>
            </div>

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

            {/* Admin Cards Selection */}
            <div>
                <label className="text-sm text-slate-400 mb-2 block">{t.admin_cards}</label>
                <div className="space-y-2">
                    {filteredCards.length === 0 ? (
                        <div className="text-center text-slate-500 p-4 border border-dashed border-slate-700 rounded-xl">
                            {currency} uchun hamyonlar yo'q
                        </div>
                    ) : (
                        filteredCards.map(card => (
                            <button 
                                key={card.id}
                                onClick={() => setSelectedAdminCard(card)}
                                className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                                    selectedAdminCard?.id === card.id
                                    ? 'bg-primary/20 border-primary text-white'
                                    : 'bg-midnight-light border-slate-700 text-slate-400'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <CreditCard className={card.type === 'humo' ? 'text-orange-500' : 'text-blue-500'} />
                                    <div className="text-left">
                                        <div className="font-bold uppercase">{card.type.replace('_', ' ')}</div>
                                        <div className="text-xs opacity-70">{card.number}</div>
                                    </div>
                                </div>
                                {selectedAdminCard?.id === card.id && <CheckCircle2 size={20} className="text-primary" />}
                            </button>
                        ))
                    )}
                </div>
            </div>

            <Button onClick={handleNext} className="w-full py-4 text-lg">Davom etish</Button>
          </div>
      ) : (
          <div className="space-y-4 animate-in slide-in-from-right">
              {selectedAdminCard && (
                  <Card highlight className="text-center py-8">
                      <p className="text-slate-400 mb-2">{t.transfer_to}</p>
                      <div className="text-2xl font-mono font-bold tracking-wider mb-4 text-white break-all">
                          {selectedAdminCard.number}
                      </div>
                      <Button variant="secondary" onClick={copyAccount} className="mx-auto text-sm h-9">
                          <Copy size={16} className="mr-2" />
                          {t.copy_num}
                      </Button>
                  </Card>
              )}

              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm text-blue-200">
                <CheckCircle2 className="inline-block mr-2 mb-1" size={16} />
                To'lov qilganingizdan so'ng pastdagi tugmani bosing. Adminlar tekshirib tasdiqlaydi.
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

const Withdraw = ({ user, lang }) => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [code, setCode] = useState("");
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [adminSettings, setAdminSettings] = useState({});
  const t = translations[lang];

  useEffect(() => { 
      if(user?.telegram_id) fetchWallets();
      if (user?.wallets) {
          const hasCard = user.wallets.some(w => w.type === 'uzcard' || w.type === 'humo');
          if (!hasCard) {
              toast.error(t.add_card_required);
              navigate('/wallets');
          }
      }
      fetchSettings();
  }, [user, navigate, t.add_card_required]);

  const fetchWallets = async () => { 
      try { 
          const res = await axios.get(`${API_URL}/user/${user.telegram_id}`); 
          // Filter to show ONLY Mostbet wallets for withdrawal
          const allWallets = res.data.wallets || [];
          const mostbetWallets = allWallets.filter(w => w.type.startsWith('mostbet'));
          setWallets(mostbetWallets); 
      } catch (e) { console.error(e); } 
  };

  const fetchSettings = async () => {
      try { const res = await axios.get(`${API_URL}/admin/settings`); setAdminSettings(res.data); } catch(e) {}
  };

  const handleWithdraw = async () => {
    if (!amount) return toast.error(t.enter_valid_amount);
    if (!selectedWallet) return toast.error(t.select_wallet);
    if (!code || code.length < 8) return toast.error("Kodni kiriting (8 xonali)");

    const currency = selectedWallet.type.includes('usd') ? 'USD' : 'UZS';

    try {
      await axios.post(`${API_URL}/transactions/create`, {
        user_id: user.telegram_id,
        type: "withdraw",
        amount: Number(amount),
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
      <h1 className="text-2xl font-bold">{t.withdraw_title}</h1>
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
                <label className="text-sm text-slate-400 mb-2 block">{t.withdraw_amount}</label>
                <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
                    <span className="text-2xl font-bold text-slate-500">{getCurrencySymbol()}</span>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-transparent text-3xl font-bold w-full outline-none text-right placeholder:text-slate-700" placeholder="0" />
                </div>
                {isUSD && amount && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50">
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
            </div>
            
            <div>
                <label className="text-sm text-slate-400 mb-2 block">{t.secret_code}</label>
                <div className="relative">
                    <Input 
                        value={code} 
                        onChange={e => setCode(e.target.value)} 
                        placeholder={t.code_placeholder}
                        maxLength={8}
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

const Wallets = ({ user, lang }) => {
    const [wallets, setWallets] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newWallet, setNewWallet] = useState({ type: 'uzcard', number: '', expiry: '', name: '' });
    const [deletingId, setDeletingId] = useState(null);
    const t = translations[lang];
    
    useEffect(() => { if(user?.telegram_id) fetchWallets(); }, [user]);
    
    const fetchWallets = async () => { try { const res = await axios.get(`${API_URL}/user/${user.telegram_id}`); setWallets(res.data.wallets || []); } catch (e) { console.error(e); } };
    
    const handleAdd = async () => {
        if(!newWallet.number) return toast.error(t.enter_valid_number);
        if((newWallet.type === 'uzcard' || newWallet.type === 'humo') && !newWallet.expiry) return toast.error("Expiry required");
        
        try { 
            await axios.post(`${API_URL}/wallets/add`, { telegram_id: user.telegram_id, wallet: newWallet }); 
            setIsAdding(false); 
            setNewWallet({ type: 'uzcard', number: '', expiry: '', name: '' }); 
            fetchWallets(); 
            toast.success(t.success_wallet); 
        } catch(e) { toast.error(t.error); }
    };

    const handleDelete = async (walletId) => {
        try {
            await axios.delete(`${API_URL}/wallets/delete`, { 
                data: { telegram_id: user.telegram_id, wallet_id: walletId } 
            });
            toast.success(lang === 'uz' ? "Hamyon o'chirildi" : "Кошелек удален");
            fetchWallets();
        } catch(e) { 
            toast.error(t.error); 
        }
        setDeletingId(null);
    };
    
    const isCard = newWallet.type === 'uzcard' || newWallet.type === 'humo';

    return (
        <div className="p-4 space-y-6 pb-24">
            <h1 className="text-2xl font-bold">{t.my_wallets}</h1>
            {isAdding ? (
                <Card className="animate-in zoom-in-95 duration-200">
                    <h3 className="font-bold mb-4">{t.add_wallet}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">{t.type}</label>
                            <select 
                                className="w-full bg-midnight border border-slate-700 rounded-xl h-12 px-4 text-white outline-none" 
                                value={newWallet.type} 
                                onChange={e => setNewWallet({...newWallet, type: e.target.value})}
                            >
                                <option value="uzcard">Uzcard</option>
                                <option value="humo">Humo</option>
                                <option value="mostbet_uzs">Mostbet UZS</option>
                                <option value="mostbet_usd">Mostbet USD</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">
                                {isCard ? t.card_number : t.mostbet_id}
                            </label>
                            <Input 
                                value={newWallet.number} 
                                onChange={e => setNewWallet({...newWallet, number: e.target.value})} 
                                placeholder={isCard ? "8600 0000 0000 0000" : "123456789"} 
                            />
                        </div>
                        
                        {isCard && (
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">{t.expiry}</label>
                                <div className="relative">
                                    <Input 
                                        value={newWallet.expiry} 
                                        onChange={e => setNewWallet({...newWallet, expiry: e.target.value})} 
                                        placeholder="MM/YY" 
                                        maxLength={5}
                                    />
                                    <Calendar className="absolute right-4 top-3 text-slate-500" size={18} />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <Button variant="secondary" onClick={() => setIsAdding(false)} className="flex-1">{t.cancel}</Button>
                            <Button onClick={handleAdd} className="flex-1">{t.save}</Button>
                        </div>
                    </div>
                </Card>
            ) : (<Button onClick={() => setIsAdding(true)} className="w-full" variant="secondary">+ {t.add_wallet}</Button>)}
            
            <div className="space-y-3">
                {wallets.map((w, i) => (
                    <div key={w.id || i} className="p-4 bg-midnight-light border border-slate-800 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                                  <CreditCard size={20} className="text-slate-300" />
                              </div>
                             <div>
                                <div className="font-bold uppercase text-white">{w.type.replace('_', ' ')}</div>
                                <div className="text-slate-500 text-sm font-mono">{w.number}</div>
                                {w.expiry && <div className="text-[10px] text-slate-600 font-mono mt-0.5">{w.expiry}</div>}
                             </div>
                        </div>
                        {deletingId === w.id ? (
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleDelete(w.id)}
                                    className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors"
                                >
                                    <CheckCircle2 size={18} />
                                </button>
                                <button 
                                    onClick={() => setDeletingId(null)}
                                    className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => setDeletingId(w.id)}
                                className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                data-testid={`delete-wallet-${w.id}`}
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
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
    const fetchSettings = async () => { try { const res = await axios.get(`${API_URL}/admin/settings`); setSettings(res.data); } catch (e) { console.error(e); } };
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

    if (!user?.is_admin) return <div className="p-10 text-center">Ruxsat yo'q</div>;

    return (
        <div className="p-6 pb-24">
            <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-bold">Admin Panel</h1><Link to="/" className="text-sm text-slate-500">Chiqish</Link></div>
            
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                {[
                    { id: 'dashboard', icon: LayoutDashboard, label: 'Statistika' },
                    { id: 'pending', icon: List, label: `To'lovlar (${stats?.pending_count || 0})` },
                    { id: 'cards', icon: Wallet, label: 'Kartalar' },
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
  const [lang, setLang] = useState('uz'); // Default 'uz'

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
            
            if(tg) {
                tg.ready();
                tg.expand();
            }
        } catch(e) { 
            console.error(e);
        }
    };
    login();
  }, []);

  return (
    <div className="App min-h-screen bg-midnight text-white font-body selection:bg-gold selection:text-black">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home user={user} lang={lang} setLang={setLang} />} />
          <Route path="/deposit" element={<Deposit user={user} lang={lang} />} />
          <Route path="/withdraw" element={<Withdraw user={user} lang={lang} />} />
          <Route path="/wallets" element={<Wallets user={user} lang={lang} />} />
          <Route path="/admin" element={<Admin user={user} />} />
        </Routes>
        <BottomNav isAdmin={user?.is_admin} lang={lang} />
      </BrowserRouter>
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}

export default App;
