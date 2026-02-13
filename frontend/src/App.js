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
  X
} from "lucide-react";
import axios from "axios";

// Config
const API_URL = process.env.REACT_APP_BACKEND_URL + "/api";
const MOCK_USER_ID = 123456789; // For MVP

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

const BottomNav = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;
  
  const navItems = [
    { icon: <Wallet size={20} />, label: "Home", path: "/" },
    { icon: <ArrowUpRight size={20} />, label: "Deposit", path: "/deposit" },
    { icon: <ArrowDownLeft size={20} />, label: "Withdraw", path: "/withdraw" },
    { icon: <CreditCard size={20} />, label: "Wallets", path: "/wallets" },
  ];

  if (location.pathname.startsWith('/admin')) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-midnight/90 backdrop-blur-lg border-t border-slate-800 pb-safe pt-2 px-6 flex justify-between items-center z-50 h-20">
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
const Home = () => {
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Mock Login first
      await axios.post(`${API_URL}/auth/login`, {
        telegram_id: MOCK_USER_ID,
        first_name: "Demo User",
        username: "demouser"
      });
      
      const [userRes, histRes] = await Promise.all([
        axios.get(`${API_URL}/user/${MOCK_USER_ID}`),
        axios.get(`${API_URL}/transactions/${MOCK_USER_ID}`)
      ]);
      
      setUser(userRes.data);
      setHistory(histRes.data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load data");
    }
  };

  if (!user) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="pb-40 p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-gold font-bold text-lg">
                {user.first_name[0]}
            </div>
            <div>
                <h2 className="text-sm text-slate-400 font-body uppercase tracking-wider">Welcome back</h2>
                <h1 className="text-xl font-bold leading-none">{user.first_name}</h1>
            </div>
        </div>
        <Link to="/admin" className="text-xs text-slate-600 hover:text-white">Admin</Link>
      </div>

      {/* Balance Card */}
      <Card highlight className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <h3 className="text-slate-400 text-sm font-medium mb-1">Total Balance</h3>
        <div className="text-4xl font-bold text-white mb-4">
          {user.balance.toLocaleString()} <span className="text-gold text-2xl">UZS</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/deposit" className="w-full">
            <Button className="w-full text-sm py-2">
               <ArrowUpRight size={18} /> Deposit
            </Button>
          </Link>
          <Link to="/withdraw" className="w-full">
             <Button variant="secondary" className="w-full text-sm py-2">
               <ArrowDownLeft size={18} /> Withdraw
             </Button>
          </Link>
        </div>
      </Card>

      {/* Recent Activity */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold">Recent Activity</h3>
          <button className="text-primary text-sm">View All</button>
        </div>
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-600 bg-midnight-light rounded-xl border border-slate-800 border-dashed">
                No transactions yet
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
                    <div className="font-bold text-white capitalize">{tx.type}</div>
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
                    {tx.status}
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

const Deposit = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UZS");

  const handleDeposit = async () => {
    if (!amount) return toast.error("Enter amount");
    
    try {
      await axios.post(`${API_URL}/transactions/create`, {
        user_id: MOCK_USER_ID,
        type: "deposit",
        amount: Number(amount),
        currency,
        method: "manual_check" 
      });
      toast.success("Deposit request sent!");
      navigate("/");
    } catch (e) {
      toast.error("Failed to create deposit");
    }
  };

  return (
    <div className="p-4 space-y-6 pb-40">
      <h1 className="text-2xl font-bold">Deposit Funds</h1>
      
      <div className="grid grid-cols-3 gap-3">
        {['UZS', 'USD', 'RUB'].map(c => (
            <button 
                key={c}
                onClick={() => setCurrency(c)}
                className={`p-4 rounded-xl border font-bold transition-all ${
                    currency === c 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-midnight-light border-slate-700 text-slate-400'
                }`}
            >
                MOSTBET <br/> {c}
            </button>
        ))}
      </div>

      <Card>
        <label className="text-sm text-slate-400 mb-2 block">Amount to deposit</label>
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
      </Card>

      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm text-blue-200">
        <ShieldCheck className="inline-block mr-2 mb-1" size={16} />
        Secure transaction. Your funds will be credited after admin approval.
      </div>

      <Button onClick={handleDeposit} className="w-full py-4 text-lg" data-testid="deposit-submit-btn">
        Confirm Deposit
      </Button>
    </div>
  );
};

const Withdraw = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
      try {
          const res = await axios.get(`${API_URL}/user/${MOCK_USER_ID}`);
          setWallets(res.data.wallets || []);
      } catch (e) { console.error(e); }
  };

  const handleWithdraw = async () => {
    if (!amount) return toast.error("Enter amount");
    if (!selectedWallet) return toast.error("Select a wallet");

    try {
      await axios.post(`${API_URL}/transactions/create`, {
        user_id: MOCK_USER_ID,
        type: "withdraw",
        amount: Number(amount),
        currency: "UZS",
        method: selectedWallet.type,
        wallet_number: selectedWallet.number
      });
      toast.success("Withdrawal request sent!");
      navigate("/");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to withdraw");
    }
  };

  return (
    <div className="p-4 space-y-6 pb-40">
      <h1 className="text-2xl font-bold">Withdraw Funds</h1>

      <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-slate-400">Select Wallet</label>
            <Link to="/wallets" className="text-primary text-xs">Manage Wallets</Link>
          </div>
          <div className="space-y-2">
              {wallets.length === 0 ? (
                  <div className="text-center p-4 border border-dashed border-slate-700 rounded-xl text-slate-500 text-sm">
                      No wallets added. Please add one first.
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
                                  <div className="font-bold text-white uppercase">{w.type}</div>
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
        <label className="text-sm text-slate-400 mb-2 block">Amount to withdraw</label>
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
      </Card>

      <Button onClick={handleWithdraw} className="w-full py-4 text-lg" disabled={wallets.length === 0} data-testid="withdraw-submit-btn">
        Request Withdrawal
      </Button>
    </div>
  );
};

const Wallets = () => {
    const [wallets, setWallets] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newWallet, setNewWallet] = useState({ type: 'uzcard', number: '', name: '' });
  
    useEffect(() => {
      fetchWallets();
    }, []);
  
    const fetchWallets = async () => {
        try {
            const res = await axios.get(`${API_URL}/user/${MOCK_USER_ID}`);
            setWallets(res.data.wallets || []);
        } catch (e) { console.error(e); }
    };

    const handleAdd = async () => {
        if(!newWallet.number) return toast.error("Enter number");
        try {
            await axios.post(`${API_URL}/wallets/add`, {
                telegram_id: MOCK_USER_ID,
                wallet: newWallet
            });
            setIsAdding(false);
            setNewWallet({ type: 'uzcard', number: '', name: '' });
            fetchWallets();
            toast.success("Wallet added");
        } catch(e) { toast.error("Failed to add wallet"); }
    };

    return (
        <div className="p-4 space-y-6 pb-40">
            <h1 className="text-2xl font-bold">My Wallets</h1>
            
            {isAdding ? (
                <Card className="animate-in zoom-in-95 duration-200">
                    <h3 className="font-bold mb-4">Add New Wallet</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Type</label>
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
                            <label className="text-xs text-slate-400 mb-1 block">Number / ID</label>
                            <Input 
                                value={newWallet.number}
                                onChange={e => setNewWallet({...newWallet, number: e.target.value})}
                                placeholder="8600 0000 0000 0000"
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button variant="secondary" onClick={() => setIsAdding(false)} className="flex-1">Cancel</Button>
                            <Button onClick={handleAdd} className="flex-1">Save</Button>
                        </div>
                    </div>
                </Card>
            ) : (
                <Button onClick={() => setIsAdding(true)} className="w-full" variant="secondary">
                    + Add New Wallet
                </Button>
            )}

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
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Admin = () => {
    const [txs, setTxs] = useState([]);

    useEffect(() => {
        fetchPending();
    }, []);

    const fetchPending = async () => {
        try {
            const res = await axios.get(`${API_URL}/admin/transactions/pending`);
            setTxs(res.data);
        } catch (e) { console.error(e); }
    };

    const handleAction = async (id, action) => {
        try {
            await axios.post(`${API_URL}/admin/transactions/${id}/${action}`);
            toast.success(`Transaction ${action}ed`);
            fetchPending();
        } catch (e) { toast.error("Action failed"); }
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Admin Panel</h1>
                <Link to="/" className="text-sm text-slate-500">Back to App</Link>
            </div>

            <div className="space-y-4">
                {txs.length === 0 ? (
                    <div className="text-center text-slate-500 py-10">No pending transactions</div>
                ) : (
                    txs.map(tx => (
                        <div key={tx.id} className="bg-midnight-light border border-slate-800 p-4 rounded-xl">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className={`text-sm font-bold uppercase ${tx.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                                        {tx.type} Request
                                    </div>
                                    <div className="text-2xl font-bold">{tx.amount.toLocaleString()} <span className="text-sm text-slate-500">{tx.currency}</span></div>
                                    <div className="text-sm text-slate-400 mt-1">
                                        User ID: {tx.user_id} <br/>
                                        Method: {tx.method} <br/>
                                        {tx.wallet_number && `Wallet: ${tx.wallet_number}`}
                                    </div>
                                </div>
                                <div className="text-xs text-slate-600">{new Date(tx.created_at).toLocaleTimeString()}</div>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleAction(tx.id, 'reject')}
                                    className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 transition-colors"
                                >
                                    Reject
                                </button>
                                <button 
                                    onClick={() => handleAction(tx.id, 'approve')}
                                    className="flex-1 py-2 rounded-lg bg-green-500/10 text-green-500 font-bold hover:bg-green-500/20 transition-colors"
                                >
                                    Approve
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

function App() {
  return (
    <div className="App min-h-screen bg-midnight text-white font-body selection:bg-gold selection:text-black">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/deposit" element={<Deposit />} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/wallets" element={<Wallets />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
        <BottomNav />
      </BrowserRouter>
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}

export default App;
