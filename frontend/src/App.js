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
  CheckCircle2
} from "lucide-react";
import axios from "axios";

// Config
const API_URL = process.env.REACT_APP_BACKEND_URL + "/api";

// Telegram Utils
const tg = window.Telegram?.WebApp;

// Admin Cards
const ADMIN_CARDS = {
    humo: "9860 1601 3375 2081",
    uzcard: "8600 0102 0304 0506"
};

// Translations
const translations = {
  uz: {
    home: "Asosiy",
    deposit: "To'ldirish",
    withdraw: "Yechish",
    wallets: "Hamyonlar",
    referral: "Referal",
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
    no_wallets: "Hamyonlar yo'q. Iltimos, avval qo'shing.",
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
    ref_program: "Referal Dasturi",
    invited_friends: "Taklif qilingan do'stlar",
    your_ref_link: "Sizning referal havolangiz",
    ref_desc: "Do'stlaringizni taklif qiling va bonuslarga ega bo'ling.",
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
    transfer_to: "Quyidagi kartaga o'tkazing:",
    copy_card: "Karta raqamidan nusxa olish",
    i_paid: "To'lov qildim"
  },
  ru: {
    home: "Главная",
    deposit: "Пополнить",
    withdraw: "Вывести",
    wallets: "Кошельки",
    referral: "Реферал",
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
    no_wallets: "Нет кошельков. Пожалуйста, добавьте.",
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
    ref_program: "Реферальная программа",
    invited_friends: "Приглашенные друзья",
    your_ref_link: "Ваша реферальная ссылка",
    ref_desc: "Приглашайте друзей и получайте бонусы.",
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
    transfer_to: "Переведите на эту карту:",
    copy_card: "Копировать номер карты",
    i_paid: "Я оплатил"
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
    { icon: <Users size={20} />, label: t.referral, path: "/referral" },
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
                    {tx.type === 'deposit' ? '+' : '-'}{tx.amount.toLocaleString()} UZS
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

const Referral = ({ user, lang }) => {
    const t = translations[lang];
    const refLink = `https://t.me/BuraPay_bot?start=${user?.internal_id}`;

    const copyLink = () => {
        navigator.clipboard.writeText(refLink);
        toast.success(t.copied);
    };

    if (!user) return null;

    return (
        <div className="p-4 space-y-6 pb-24">
            <h1 className="text-2xl font-bold">{t.ref_program}</h1>
            
            <Card highlight>
                <div className="text-center py-4">
                    <h2 className="text-4xl font-bold text-gold mb-2">{user.referrals_count || 0}</h2>
                    <p className="text-slate-400 uppercase tracking-wider text-sm">{t.invited_friends}</p>
                </div>
            </Card>

            <div className="bg-midnight-light p-4 rounded-xl border border-slate-800">
                <label className="text-sm text-slate-400 mb-2 block">{t.your_ref_link}</label>
                <div className="flex gap-2">
                    <div className="bg-midnight border border-slate-700 rounded-lg px-3 py-3 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-slate-300 text-sm">
                        {refLink}
                    </div>
                    <button onClick={copyLink} className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition-colors">
                        <Copy size={20} />
                    </button>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                    {t.ref_desc}
                </p>
            </div>
        </div>
    );
};

const Deposit = ({ user, lang }) => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("uzcard"); // uzcard or humo
  const [step, setStep] = useState(1); // 1: Amount, 2: Payment
  const t = translations[lang];

  const handleNext = () => {
      if(!amount || Number(amount) < 20000) return toast.error(t.min_amount);
      setStep(2);
  };

  const handleDeposit = async () => {
    try {
      await axios.post(`${API_URL}/transactions/create`, {
        user_id: user.telegram_id,
        type: "deposit",
        amount: Number(amount),
        currency: "UZS",
        method: method,
        manual_check: true
      });
      toast.success(t.success_deposit);
      navigate("/");
    } catch (e) { toast.error(t.error); }
  };

  const copyCard = () => {
      navigator.clipboard.writeText(ADMIN_CARDS[method]);
      toast.success(t.copied);
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <h1 className="text-2xl font-bold">{t.deposit_title}</h1>
      
      {step === 1 ? (
          <>
            <Card>
                <label className="text-sm text-slate-400 mb-2 block">{t.enter_amount}</label>
                <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
                    <span className="text-2xl font-bold text-slate-500">UZS</span>
                    <input 
                        type="number" 
                        value={amount} 
                        onChange={e => setAmount(e.target.value)} 
                        className="bg-transparent text-3xl font-bold w-full outline-none text-right placeholder:text-slate-700" 
                        placeholder="0" 
                    />
                </div>
                <p className="text-xs text-slate-500 mt-2 text-right">Min: 20,000 UZS</p>
            </Card>
            <Button onClick={handleNext} className="w-full py-4 text-lg">Davom etish</Button>
          </>
      ) : (
          <div className="space-y-4 animate-in slide-in-from-right">
              <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setMethod('uzcard')}
                    className={`p-4 rounded-xl border font-bold transition-all flex flex-col items-center gap-2 ${method === 'uzcard' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-midnight-light border-slate-700 text-slate-400'}`}
                  >
                      <CreditCard size={24} />
                      UZCARD
                  </button>
                  <button 
                    onClick={() => setMethod('humo')}
                    className={`p-4 rounded-xl border font-bold transition-all flex flex-col items-center gap-2 ${method === 'humo' ? 'bg-orange-600/20 border-orange-500 text-orange-400' : 'bg-midnight-light border-slate-700 text-slate-400'}`}
                  >
                      <CreditCard size={24} />
                      HUMO
                  </button>
              </div>

              <Card highlight className="text-center py-8">
                  <p className="text-slate-400 mb-2">{t.transfer_to}</p>
                  <div className="text-3xl font-mono font-bold tracking-wider mb-4 text-white">
                      {ADMIN_CARDS[method]}
                  </div>
                  <Button variant="secondary" onClick={copyCard} className="mx-auto text-sm h-9">
                      <Copy size={16} className="mr-2" />
                      {t.copy_card}
                  </Button>
              </Card>

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
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const t = translations[lang];

  useEffect(() => { if(user?.telegram_id) fetchWallets(); }, [user]);
  const fetchWallets = async () => { try { const res = await axios.get(`${API_URL}/user/${user.telegram_id}`); setWallets(res.data.wallets || []); } catch (e) { console.error(e); } };

  const handleWithdraw = async () => {
    if (!amount) return toast.error(t.enter_valid_amount);
    if (!selectedWallet) return toast.error(t.select_wallet);
    try {
      await axios.post(`${API_URL}/transactions/create`, {
        user_id: user.telegram_id,
        type: "withdraw",
        amount: Number(amount),
        currency: "UZS",
        method: selectedWallet.type,
        wallet_number: selectedWallet.number
      });
      toast.success(t.success_withdraw);
      navigate("/");
    } catch (e) { toast.error(e.response?.data?.detail || t.error); }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <h1 className="text-2xl font-bold">{t.withdraw_title}</h1>
      <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-slate-400">{t.select_wallet}</label>
            <Link to="/wallets" className="text-primary text-xs">{t.manage_wallets}</Link>
          </div>
          <div className="space-y-2">
              {wallets.length === 0 ? <div className="text-center p-4 border border-dashed border-slate-700 rounded-xl text-slate-500 text-sm">{t.no_wallets}</div> : wallets.map(w => (
                  <div key={w.id} onClick={() => setSelectedWallet(w)} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${selectedWallet?.id === w.id ? 'bg-primary/10 border-primary' : 'bg-midnight-light border-slate-800'}`}>
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                              <CreditCard size={20} className="text-slate-300" />
                          </div>
                          <div>
                              <div className="font-bold text-white uppercase">{w.type}</div>
                              <div className="text-xs text-slate-500">{w.number}</div>
                              {w.expiry && <div className="text-[10px] text-slate-600">{w.expiry}</div>}
                          </div>
                      </div>
                      {selectedWallet?.id === w.id && <div className="w-4 h-4 rounded-full bg-primary" />}
                  </div>
              ))}
          </div>
      </div>
      <Card><label className="text-sm text-slate-400 mb-2 block">{t.withdraw_amount}</label><div className="flex items-center gap-2 border-b border-slate-700 pb-2"><span className="text-2xl font-bold text-slate-500">UZS</span><input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-transparent text-3xl font-bold w-full outline-none text-right placeholder:text-slate-700" placeholder="0" /></div></Card>
      <Button onClick={handleWithdraw} className="w-full py-4 text-lg" disabled={wallets.length === 0}>{t.request_withdraw}</Button>
    </div>
  );
};

const Wallets = ({ user, lang }) => {
    const [wallets, setWallets] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newWallet, setNewWallet] = useState({ type: 'uzcard', number: '', expiry: '', name: '' });
    const t = translations[lang];
    
    useEffect(() => { if(user?.telegram_id) fetchWallets(); }, [user]);
    
    const fetchWallets = async () => { try { const res = await axios.get(`${API_URL}/user/${user.telegram_id}`); setWallets(res.data.wallets || []); } catch (e) { console.error(e); } };
    
    const handleAdd = async () => {
        if(!newWallet.number) return toast.error(t.enter_valid_number);
        if(newWallet.type !== 'mostbet' && !newWallet.expiry) return toast.error("Expiry required");
        
        try { 
            await axios.post(`${API_URL}/wallets/add`, { telegram_id: user.telegram_id, wallet: newWallet }); 
            setIsAdding(false); 
            setNewWallet({ type: 'uzcard', number: '', expiry: '', name: '' }); 
            fetchWallets(); 
            toast.success(t.success_wallet); 
        } catch(e) { toast.error(t.error); }
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
                                <option value="mostbet">Mostbet ID</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">
                                {isCard ? t.card_number : t.number_id}
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
                    <div key={i} className="p-4 bg-midnight-light border border-slate-800 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                                  <CreditCard size={20} className="text-slate-300" />
                              </div>
                             <div>
                                <div className="font-bold uppercase text-white">{w.type}</div>
                                <div className="text-slate-500 text-sm font-mono">{w.number}</div>
                                {w.expiry && <div className="text-[10px] text-slate-600 font-mono mt-0.5">{w.expiry}</div>}
                             </div>
                        </div>
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
    const [search, setSearch] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [balanceForm, setBalanceForm] = useState({ amount: '', type: 'credit' });

    useEffect(() => { 
        if(user?.is_admin) {
            fetchStats();
            fetchPending();
            fetchUsers();
        }
    }, [user]);

    const fetchStats = async () => { try { const res = await axios.get(`${API_URL}/admin/stats`); setStats(res.data); } catch (e) { console.error(e); } };
    const fetchPending = async () => { try { const res = await axios.get(`${API_URL}/admin/transactions/pending`); setTxs(res.data); } catch (e) { console.error(e); } };
    const fetchUsers = async () => { try { const res = await axios.get(`${API_URL}/admin/users?search=${search}`); setUsers(res.data); } catch (e) { console.error(e); } };

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

    if (!user?.is_admin) return <div className="p-10 text-center">Ruxsat yo'q</div>;

    return (
        <div className="p-6 pb-24">
            <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-bold">Admin Panel</h1><Link to="/" className="text-sm text-slate-500">Chiqish</Link></div>
            
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {[
                    { id: 'dashboard', icon: LayoutDashboard, label: 'Statistika' },
                    { id: 'pending', icon: List, label: `To'lovlar (${stats?.pending_count || 0})` },
                    { id: 'users', icon: Users, label: 'Foydalanuvchilar' },
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
          <Route path="/referral" element={<Referral user={user} lang={lang} />} />
        </Routes>
        <BottomNav isAdmin={user?.is_admin} lang={lang} />
      </BrowserRouter>
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}

export default App;
