import React, { useEffect, useState, useRef } from "react";
import { 
  Activity, 
  TrendingUp, 
  Users, 
  Trophy, 
  RefreshCw, 
  AlertCircle,
  ChevronRight,
  LayoutDashboard,
  History,
  Clock,
  Wallet,
  Coins,
  Map
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FRUIT_MAP, WinNotification, GreedyLionResponse, BetDataResponse } from "./types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const App: React.FC = () => {
  const [notifications, setNotifications] = useState<WinNotification[]>([]);
  const [betData, setBetData] = useState<BetDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [latency, setLatency] = useState(0);
  const [stats, setStats] = useState({
    totalWins: 0,
    totalCoins: 0,
    topWinner: { name: "-", amount: 0 },
  });

  const fetchInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchData = async () => {
    const startTime = Date.now();
    try {
      // Fetch Notifications
      const notifyRes = await fetch("/api/greedy-lion/notify");
      if (notifyRes.ok) {
        const data: GreedyLionResponse = await notifyRes.json();
        if (data.running_msg) {
          setNotifications(prev => {
            const newMsgs = data.running_msg.filter(
              newMsg => !prev.some(oldMsg => oldMsg.msg_seq === newMsg.msg_seq)
            );
            const combined = [...newMsgs, ...prev].slice(0, 50);
            
            const totalCoins = combined.reduce((sum, n) => sum + n.win_coin, 0);
            const winnerMap: Record<string, number> = {};
            combined.forEach(n => {
              winnerMap[n.nick_name] = (winnerMap[n.nick_name] || 0) + n.win_coin;
            });
            
            let topName = "-";
            let topAmount = 0;
            Object.entries(winnerMap).forEach(([name, amount]) => {
              if (amount > topAmount) {
                topAmount = amount;
                topName = name;
              }
            });

            setStats(prevStats => ({
              ...prevStats,
              totalWins: combined.length,
              totalCoins,
              topWinner: { name: topName, amount: topAmount }
            }));

            return combined;
          });
        }
      }

      // Fetch Bet Data
      const betRes = await fetch("/api/greedy-lion/query-bet");
      if (betRes.ok) {
        const data: BetDataResponse = await betRes.json();
        setBetData(data);
      }

      setLatency(Date.now() - startTime);
      setLastUpdate(new Date());
      setError(null);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError("Connection lost. Retrying...");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchInterval.current = setInterval(fetchData, 2000); // Poll faster for timer
    return () => {
      if (fetchInterval.current) clearInterval(fetchInterval.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E4E3E0] p-4 md:p-8 font-sans selection:bg-accent/30">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent font-bold">Live System Active</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-accent" />
            GREEDY LION <span className="text-accent italic">TRACKER</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4 bg-white/5 p-2 rounded-xl border border-white/10 backdrop-blur-sm">
          <div className="text-right px-2">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Last Sync</p>
            <p className="text-xs font-mono">{lastUpdate.toLocaleTimeString()}</p>
          </div>
          <button 
            onClick={() => { setLoading(true); fetchData(); }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors group"
          >
            <RefreshCw className={cn("w-5 h-5 text-accent", loading && "animate-spin")} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Top Status Bar */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#141417] p-4 rounded-2xl border border-white/5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-accent/10 text-accent">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Stage / Timer</p>
              <h4 className="text-xl font-bold tracking-tight">
                {betData?.slot_machine.stage || "IDLE"} / <span className="text-accent">{betData?.slot_machine.remain_seconds || 0}s</span>
              </h4>
            </div>
          </div>

          <div className="bg-[#141417] p-4 rounded-2xl border border-white/5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">My Balance</p>
              <h4 className="text-xl font-bold tracking-tight">
                {betData?.user_balance.toLocaleString() || 0} <span className="text-[10px] text-white/30">Coins</span>
              </h4>
            </div>
          </div>

          <div className="bg-[#141417] p-4 rounded-2xl border border-white/5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Today's Win</p>
              <h4 className="text-xl font-bold tracking-tight text-amber-500">
                +{betData?.total_winning_today.toLocaleString() || 0}
              </h4>
            </div>
          </div>

          <div className="bg-[#141417] p-4 rounded-2xl border border-white/5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Current Round</p>
              <h4 className="text-xl font-bold tracking-tight">
                #{betData?.slot_machine.round || "---"}
              </h4>
            </div>
          </div>
        </div>

        {/* Road Map (History) */}
        <div className="lg:col-span-12 bg-[#141417] rounded-2xl border border-white/5 p-4 overflow-hidden relative">
          <div className="absolute inset-0 scanline pointer-events-none opacity-10" />
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-xs font-mono uppercase tracking-widest text-white/50 flex items-center gap-2">
              <Map className="w-4 h-4" />
              Winning Road Map (History)
            </h3>
            <span className="text-[10px] font-mono text-white/20">Last 20 Rounds</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {betData?.new_win_fruits.map((item, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center relative group transition-all",
                  item.craze_fruit !== -1 && "border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                )}
              >
                <span className="text-xl">{FRUIT_MAP[item.win_fruit]?.emoji || "❓"}</span>
                {item.craze_fruit !== -1 && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-[8px] font-bold text-black border border-[#141417]">
                    🔥
                  </div>
                )}
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full border-2 border-[#141417] scale-0 group-hover:scale-100 transition-transform flex items-center justify-center text-[8px] font-bold">
                  {idx + 1}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Feed */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-mono uppercase tracking-widest text-white/50 flex items-center gap-2">
              <History className="w-4 h-4" />
              Real-time Notification Stream
            </h2>
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs font-mono animate-pulse">
                <AlertCircle className="w-3 h-3" />
                {error}
              </div>
            )}
          </div>

          <div className="bg-[#141417] rounded-2xl border border-white/5 overflow-hidden relative min-h-[600px]">
            <div className="absolute inset-0 scanline pointer-events-none opacity-20" />
            
            <div className="p-4 space-y-2">
              <AnimatePresence initial={false}>
                {notifications.length === 0 && !loading ? (
                  <div className="h-[500px] flex flex-col items-center justify-center text-white/20">
                    <Users className="w-12 h-12 mb-4 opacity-10" />
                    <p className="font-mono text-sm">Waiting for game events...</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <motion.div
                      key={notif.msg_seq}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-accent/30 transition-all cursor-default"
                    >
                      <div className="relative">
                        <img 
                          src={notif.avatar ? (notif.avatar.startsWith('http') ? notif.avatar : `https://img.hoho.media/${notif.avatar}`) : `https://api.dicebear.com/7.x/avataaars/svg?seed=${notif.nick_name}`} 
                          alt="" 
                          className="w-10 h-10 rounded-full border border-white/10 object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute -bottom-1 -right-1 bg-accent text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#141417]">
                          {FRUIT_MAP[notif.fruit]?.emoji || "❓"}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{notif.nick_name}</span>
                          <span className="text-[10px] font-mono text-white/30 px-1.5 py-0.5 rounded bg-white/5">
                            ID: {notif.msg_seq.slice(-6)}
                          </span>
                        </div>
                        <p className="text-xs text-white/50 flex items-center gap-1">
                          Won with <span className="text-accent font-medium">{FRUIT_MAP[notif.fruit]?.name || "Unknown"}</span>
                          <span className="opacity-30">({FRUIT_MAP[notif.fruit]?.multiplier}x)</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-accent font-mono font-bold">
                          +{notif.win_coin.toLocaleString()}
                        </p>
                        <p className="text-[9px] uppercase tracking-tighter text-white/20 font-mono">Coins</p>
                      </div>
                      
                      <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-accent/50 transition-colors" />
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Sidebar / Leaderboard */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#141417] rounded-2xl border border-white/5 p-6">
            <h3 className="text-sm font-mono uppercase tracking-widest text-white/50 mb-6 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Active Symbols
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(FRUIT_MAP).map(([id, data]) => {
                const isHot = betData?.slot_machine.hot_betted_fruit === Number(id);
                return (
                  <div 
                    key={id} 
                    className={cn(
                      "p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col items-center text-center relative transition-all",
                      isHot && "border-accent/50 bg-accent/5 shadow-[0_0_15px_rgba(242,125,38,0.1)]"
                    )}
                  >
                    {isHot && (
                      <div className="absolute -top-1 -right-1 bg-accent text-[8px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                        HOT
                      </div>
                    )}
                    <span className="text-2xl mb-1">{data.emoji}</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider">{data.name}</span>
                    <span className="text-[9px] font-mono text-accent">{data.multiplier}x</span>
                  </div>
                );
              })}
            </div>
          </div>

          {betData && betData.win_fruits.length > 0 && (
            <FrequencyAnalysis history={betData.win_fruits} />
          )}

          <div className="bg-accent/5 rounded-2xl border border-accent/20 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <TrendingUp className="w-24 h-24" />
            </div>
            <h3 className="text-sm font-bold text-accent uppercase tracking-widest mb-4">System Status</h3>
            <ul className="space-y-3 text-xs font-mono">
              <li className="flex justify-between border-b border-accent/10 pb-2">
                <span className="text-white/40">API Status</span>
                <span className={cn(error ? "text-red-400" : "text-emerald-400")}>
                  {error ? "DEGRADED" : "OPERATIONAL"}
                </span>
              </li>
              <li className="flex justify-between border-b border-accent/10 pb-2">
                <span className="text-white/40">Latency</span>
                <span className="text-accent">{latency}ms</span>
              </li>
              <li className="flex justify-between border-b border-accent/10 pb-2">
                <span className="text-white/40">Region</span>
                <span>XM (Global)</span>
              </li>
              <li className="flex justify-between">
                <span className="text-white/40">Auth Token</span>
                <span className="truncate max-w-[100px] opacity-50">83e53e7b...</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/5 text-center">
        <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">
          Greedy Lion Data Analytics Engine v1.0.5
        </p>
      </footer>
    </div>
  );
};

const FrequencyAnalysis = ({ history }: { history: number[] }) => {
  const counts = history.reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  return (
    <div className="bg-[#141417] rounded-2xl border border-white/5 p-6">
      <h3 className="text-sm font-mono uppercase tracking-widest text-white/50 mb-6 flex items-center gap-2">
        <Activity className="w-4 h-4" />
        Frequency Analysis (20R)
      </h3>
      <div className="space-y-3">
        {Object.entries(FRUIT_MAP)
          .sort((a, b) => (counts[Number(b[0])] || 0) - (counts[Number(a[0])] || 0))
          .map(([id, data]) => {
            const count = counts[Number(id)] || 0;
            const percentage = history.length > 0 ? (count / history.length) * 100 : 0;
            return (
              <div key={id} className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="flex items-center gap-2">
                    <span>{data.emoji}</span>
                    <span className="text-white/40">{data.name}</span>
                  </span>
                  <span className="text-accent">{count} hits ({percentage.toFixed(0)}%)</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    className="h-full bg-accent/50"
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  trend?: string;
  isCurrency?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subValue, icon, trend, isCurrency }) => (
  <div className="bg-[#141417] p-6 rounded-2xl border border-white/5 relative group hover:border-accent/20 transition-all">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 rounded-lg bg-white/5 text-accent group-hover:bg-accent group-hover:text-white transition-all">
        {icon}
      </div>
      {trend && (
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
          {trend}
        </span>
      )}
    </div>
    <div>
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono mb-1">{label}</p>
      <h4 className="text-2xl font-bold tracking-tight">
        {isCurrency && <span className="text-accent mr-1">$</span>}
        {value}
      </h4>
      {subValue && <p className="text-xs text-white/30 mt-1 font-mono">{subValue}</p>}
    </div>
  </div>
);

export default App;
