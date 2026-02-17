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
      
      // CRITICAL FIX: Require card selection for ALL currencies
      if(!selectedAdminCard) return toast.error(t.select_card_to_pay);
      
      setStep(2);
  };

  const handleDeposit = async () => {
    if (!selectedAdminCard) return; // Extra safety

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
      if (currency === 'USD') return ['uzcard', 'humo', 'mostbet_usd'].includes(c.type);
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
