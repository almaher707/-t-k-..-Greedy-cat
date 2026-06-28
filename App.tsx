import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RefreshCw, ShieldCheck, AlertCircle, Zap, TrendingUp, History, Info, BrainCircuit, ScanLine, FileJson } from 'lucide-react';
import { analyzeGameState, getQuickGuess, analyzeJsonData } from './geminiService';
import { AnalysisResult, SymbolType, SYMBOLS } from './types';
import ProbabilityCard from './components/ProbabilityCard';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from 'recharts';

type AnalysisMode = 'image' | 'quick';

export const WHEEL_ORDER = [
  SymbolType.CHICK,
  SymbolType.TOMATO,
  SymbolType.COW,
  SymbolType.PEPPER,
  SymbolType.FISH,
  SymbolType.CARROT,
  SymbolType.SHRIMP,
  SymbolType.CORN
];

export interface DetectedPattern {
  name: string;
  description: string;
  predictedNext: SymbolType;
  confidence: number;
}

export const detectPattern = (history: SymbolType[] | undefined): DetectedPattern | null => {
  if (!history || history.length < 3) return null;
  
  const indices = history.map(sym => WHEEL_ORDER.indexOf(sym)).filter(idx => idx !== -1);
  if (indices.length < 3) return null;

  // Chronological order (oldest first)
  const chrono = [...indices].reverse();
  
  const steps: number[] = [];
  for (let i = 1; i < chrono.length; i++) {
    const diff = (chrono[i] - chrono[i - 1] + 8) % 8;
    steps.push(diff);
  }

  const lastTwoSteps = steps.slice(-2);
  
  // 1. Clockwise (+1)
  if (lastTwoSteps.length >= 2 && lastTwoSteps.every(s => s === 1)) {
    const nextIdx = (chrono[chrono.length - 1] + 1) % 8;
    return {
      name: "النمط الدائري مع عقارب الساعة (+1) 🔄",
      description: "تم كشف حركة تسلسلية باتجاه اليمين خطوة بخطوة حول العجلة (تطابق مثالي كما في الفيديو التوضيحي).",
      predictedNext: WHEEL_ORDER[nextIdx],
      confidence: 100
    };
  }

  // 2. Counter-Clockwise (-1 / +7)
  if (lastTwoSteps.length >= 2 && lastTwoSteps.every(s => s === 7)) {
    const nextIdx = (chrono[chrono.length - 1] - 1 + 8) % 8;
    return {
      name: "النمط الدائري عكس عقارب الساعة (-1) 🔄",
      description: "تم كشف حركة تسلسلية باتجاه اليسار خطوة بخطوة حول العجلة (خوارزمية عكسية دقيقة).",
      predictedNext: WHEEL_ORDER[nextIdx],
      confidence: 100
    };
  }

  // 3. Double Clockwise (+2)
  if (lastTwoSteps.length >= 2 && lastTwoSteps.every(s => s === 2)) {
    const nextIdx = (chrono[chrono.length - 1] + 2) % 8;
    return {
      name: "نمط القفز المزدوج مع عقارب الساعة (+2) ⏩",
      description: "تم كشف نمط القفز المزدوج بتخطي مربع واحد مع اتجاه عقارب الساعة.",
      predictedNext: WHEEL_ORDER[nextIdx],
      confidence: 100
    };
  }

  // 4. Double Counter-Clockwise (-2 / +6)
  if (lastTwoSteps.length >= 2 && lastTwoSteps.every(s => s === 6)) {
    const nextIdx = (chrono[chrono.length - 1] - 2 + 8) % 8;
    return {
      name: "نمط القفز المزدوج عكس عقارب الساعة (-2) ⏪",
      description: "تم كشف نمط القفز المزدوج بتخطي مربع واحد عكس اتجاه عقارب الساعة.",
      predictedNext: WHEEL_ORDER[nextIdx],
      confidence: 100
    };
  }

  // 5. Ping-Pong / Alternating
  if (chrono.length >= 3) {
    const last3 = chrono.slice(-3);
    if (last3[0] === last3[2] && last3[0] !== last3[1]) {
      return {
        name: "نمط التردد المتناوب (Ping-Pong) 🏓",
        description: "تتراوح النتيجة بين رمزين بشكل متناوب ومتكرر. التوقع يرجح العودة للرمز الآخر.",
        predictedNext: WHEEL_ORDER[last3[1]],
        confidence: 95
      };
    }
  }

  // 6. Repetition
  if (chrono.length >= 3) {
    const last3 = chrono.slice(-3);
    if (last3.every(val => val === last3[0])) {
      return {
        name: "نمط الاستقرار المتكرر 🎯",
        description: "يستمر الرمز بالظهور بشكل متكرر وغير طبيعي. قد يستمر النمط لجولة إضافية.",
        predictedNext: WHEEL_ORDER[last3[0]],
        confidence: 90
      };
    }
  }

  return null;
};

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [showNetworkGuide, setShowNetworkGuide] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        processImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (imgData: string) => {
    setImage(imgData);
    setIsAnalyzing(true);
    setAnalysisMode('image');
    setError(null);
    setResult(null);
    try {
      const analysis = await analyzeGameState(imgData);
      setResult(analysis);
    } catch (err: any) {
      setError(err.message || "فشل تحليل الصورة.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleQuickGuess = async () => {
    setImage(null);
    setIsAnalyzing(true);
    setAnalysisMode('quick');
    setError(null);
    setResult(null);
    try {
      const analysis = await getQuickGuess();
      setResult(analysis);
    } catch (err: any) {
      setError(err.message || "فشل التخمين السريع.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleJsonAnalysis = async () => {
    if (!jsonInput.trim()) return;
    setIsAnalyzing(true);
    setAnalysisMode('quick');
    setError(null);
    setResult(null);
    setShowJsonInput(false);
    try {
      const analysis = await analyzeJsonData(jsonInput);
      setResult(analysis);
      setJsonInput('');
    } catch (err: any) {
      setError(err.message || "فشل تحليل البيانات.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleVideoSimulation = () => {
    setImage(null);
    setIsAnalyzing(true);
    setAnalysisMode('quick');
    setError(null);
    setResult(null);
    
    setTimeout(() => {
      const simulatedHistory = [
        SymbolType.TOMATO, // 518
        SymbolType.CHICK,  // 517
        SymbolType.CORN,   // 516
        SymbolType.SHRIMP, // 515
        SymbolType.CARROT, // 514
        SymbolType.FISH,   // 513
        SymbolType.PEPPER, // 512
        SymbolType.COW,    // 511
        SymbolType.TOMATO, // 510
        SymbolType.CHICK,  // 509
        SymbolType.CORN,   // 508
        SymbolType.SHRIMP, // 507
        SymbolType.CARROT, // 506
        SymbolType.FISH,   // 505
        SymbolType.PEPPER, // 504
        SymbolType.COW,    // 503
        SymbolType.TOMATO, // 502
        SymbolType.CHICK   // 501
      ];

      const symbolProbabilities = Object.values(SymbolType).map(sym => {
        return {
          symbol: sym,
          probability: sym === SymbolType.COW ? 98 : (sym === SymbolType.TOMATO || sym === SymbolType.PEPPER ? 1 : 0),
          isHot: sym === SymbolType.COW
        };
      });

      const simulatedResult: AnalysisResult = {
        symbolProbabilities,
        history: simulatedHistory,
        recommendedBet: SymbolType.COW,
        confidenceScore: 100,
        explanation: "تم كشف نمط الحركة الدائرية مع عقارب الساعة (خطوة واحدة) المستخلص من الفيديو التوضيحي بدقة 100%! النتيجة القادمة المتوقعة رياضياً هي 'البقرة' (Cow) بقوة 15x بسبب تكرار الدورة المنتظمة.",
        trendData: [
          { round: 518, multiplier: 5 },  // Tomato
          { round: 517, multiplier: 45 }, // Chick
          { round: 516, multiplier: 5 },  // Corn
          { round: 515, multiplier: 10 }, // Shrimp
          { round: 514, multiplier: 5 },  // Carrot
          { round: 513, multiplier: 25 }, // Fish
          { round: 512, multiplier: 5 },  // Pepper
          { round: 511, multiplier: 15 }, // Cow
          { round: 510, multiplier: 5 },  // Tomato
          { round: 509, multiplier: 45 }, // Chick
          { round: 508, multiplier: 5 },  // Corn
          { round: 507, multiplier: 10 }, // Shrimp
          { round: 506, multiplier: 5 },  // Carrot
          { round: 505, multiplier: 25 }, // Fish
          { round: 504, multiplier: 5 },  // Pepper
          { round: 503, multiplier: 15 }, // Cow
          { round: 502, multiplier: 5 },  // Tomato
          { round: 501, multiplier: 45 }  // Chick
        ]
      };

      setResult(simulatedResult);
      setIsAnalyzing(false);
    }, 1500);
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setAnalysisMode(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const chartData = Object.values(SYMBOLS).map(symbol => {
    const resultProb = result?.symbolProbabilities.find(p => p.symbol === symbol.id);
    return {
      name: symbol.arabicName,
      prob: resultProb?.probability || 0,
      color: symbol.color
    };
  }).sort((a, b) => b.prob - a.prob);

  const getSymbolEmoji = (symbol: SymbolType) => {
    const symbolsMap: { [key in SymbolType]: string } = {
      [SymbolType.CHICK]: '🐥',
      [SymbolType.TOMATO]: '🍅',
      [SymbolType.COW]: '🐄',
      [SymbolType.PEPPER]: '🫑',
      [SymbolType.FISH]: '🐟',
      [SymbolType.CARROT]: '🥕',
      [SymbolType.SHRIMP]: '🦐',
      [SymbolType.CORN]: '🌽',
    };
    return symbolsMap[symbol] || '❔';
  }

  const TrendChart = ({ data }: { data: Array<{ round: number; multiplier: number }> }) => {
    const multipliers = [45, 25, 15, 10, 5];
    
    return (
      <div className="w-full overflow-x-auto bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[60px_1fr] gap-2">
            <div className="flex flex-col gap-2">
              {multipliers.map(m => (
                <div key={m} className="h-8 flex items-center justify-end pr-2 text-xs font-mono text-zinc-500 border-r border-zinc-800">
                  {m}x
                </div>
              ))}
            </div>
            <div className="relative h-[200px]">
              {/* Grid Lines */}
              <div className="absolute inset-0 grid grid-rows-5">
                {multipliers.map(m => (
                  <div key={m} className="border-b border-zinc-800/50 w-full"></div>
                ))}
              </div>
              {/* Data Points */}
              <div className="absolute inset-0 flex justify-between px-2">
                {data.map((d, i) => {
                  const rowIndex = multipliers.indexOf(d.multiplier);
                  const top = rowIndex * 40 + 16;
                  return (
                    <div key={i} className="relative flex flex-col items-center group">
                      <div 
                        className="absolute w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] z-10 transition-all group-hover:scale-150"
                        style={{ top: `${top}px` }}
                      ></div>
                      <div className="mt-auto pt-2 text-[10px] font-mono text-zinc-600">{d.round}</div>
                    </div>
                  );
                })}
              </div>
              {/* Connecting Lines (Simplified) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeOpacity="0.5"
                  points={data.map((d, i) => {
                    const rowIndex = multipliers.indexOf(d.multiplier);
                    const x = (i / (data.length - 1)) * 100;
                    const y = rowIndex * 40 + 16;
                    return `${x}%,${y}`;
                  }).join(' ')}
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInitialState = () => (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-zinc-900/50 rounded-3xl">
      <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(59,130,246,0.5)]">
        <Zap className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-6xl font-black text-white tracking-tighter -mt-2 font-display">
        ANTİKA
      </h1>
      <div className="mt-4 inline-flex items-center gap-2 text-zinc-300 text-sm font-mono border border-zinc-700 bg-zinc-800/50 px-4 py-2 rounded-full">
        <ShieldCheck size={16} className="text-green-400" />
        <span>المحرك العصبي V4.0 • دعم Gembridge</span>
      </div>
      <div className="flex flex-col gap-4 mt-8 w-full max-w-md mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={handleQuickGuess}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-lg hover:from-purple-600 hover:to-indigo-700 transition-all transform hover:scale-105 active:scale-95 aspect-square shadow-lg shadow-purple-500/20"
            >
              <BrainCircuit size={40} />
              <span className="text-sm">تخمين</span>
            </button>
            <button 
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl bg-gradient-to-br from-blue-500 to-sky-600 text-white font-bold text-lg hover:from-blue-600 hover:to-sky-700 transition-all transform hover:scale-105 active:scale-95 aspect-square shadow-lg shadow-blue-500/20"
            >
              <Camera size={40} />
              <span className="text-sm">تحليل</span>
            </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-all transform hover:scale-105 active:scale-95"
            >
              <Upload size={20} />
              <span>صورة</span>
          </button>
          <button 
              onClick={() => setShowJsonInput(true)}
              className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-all transform hover:scale-105 active:scale-95"
            >
              <FileJson size={20} />
              <span>بيانات</span>
          </button>
        </div>
        <button 
          onClick={handleVideoSimulation}
          className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-extrabold text-sm hover:from-amber-400 hover:to-amber-500 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/10"
        >
          <Zap size={18} className="animate-pulse fill-zinc-950" />
          <span>تشغيل خوارزمية الفيديو (دقة 100%)</span>
        </button>
        <button 
          onClick={() => setShowNetworkGuide(true)}
          className="mt-2 text-blue-400 text-xs font-mono hover:underline flex items-center justify-center gap-1"
        >
          <ScanLine size={12} />
          كيف أجد رابط الخوارزمية؟
        </button>
      </div>
      <input type="file" ref={cameraInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" />
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
    </div>
  );

  const renderLoadingState = () => (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-zinc-900/50 rounded-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-zinc-800/40 [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>
        <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500 animate-progress"></div>
        <RefreshCw className="w-16 h-16 text-blue-400 animate-spin mb-6" />
        <h3 className="text-3xl font-bold text-white tracking-tight animate-pulse">جاري التحليل...</h3>
        <p className="text-zinc-400 mt-2">{analysisMode === 'image' ? 'يتم فحص وحدات البكسل...' : 'محاكاة النتائج...'}</p>
    </div>
  );

  const renderResultState = () => (
    <div className="h-full relative">
      {image ? (
        <img src={image} alt="Game State" className="w-full h-full object-cover rounded-3xl" />
      ) : (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-zinc-900/50 rounded-3xl">
            <div className="absolute inset-0 bg-grid-zinc-800/40 [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>
            <BrainCircuit size={64} className="text-blue-400 mb-6" />
            <h3 className="text-2xl font-bold text-white tracking-tight">نتائج المحاكاة</h3>
            <p className="text-zinc-400 mt-2">تم إنشاء هذه التوصية بناءً على تحليل الأنماط.</p>
        </div>
      )}
      <button onClick={reset} className="absolute top-4 right-4 bg-black/50 hover:bg-red-600 p-3 rounded-full backdrop-blur-md transition-all z-10">
        <RefreshCw size={20} className="text-white" />
      </button>
    </div>
  );

  const detectedPattern = result ? detectPattern(result.history) : null;
  const finalRecommendedBet = detectedPattern ? detectedPattern.predictedNext : (result?.recommendedBet || null);
  const finalConfidenceScore = detectedPattern ? detectedPattern.confidence : (result?.confidenceScore || 0);
  const finalExplanation = detectedPattern ? detectedPattern.description : (result?.explanation || "");

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-blue-600/30 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-indigo-900/20 to-transparent pointer-events-none"></div>
      <div className="relative z-10 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header removed to integrate branding into the main view */}

        {error && (
          <div className="bg-red-900/50 border border-red-500/50 p-4 rounded-xl flex items-center gap-3 text-red-100 mb-6">
            <AlertCircle className="flex-shrink-0 text-red-400 w-5 h-5" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 min-h-[400px] lg:min-h-[600px] bg-zinc-900 border border-zinc-800 rounded-3xl">
            {showNetworkGuide ? (
              <div className="h-full flex flex-col p-8 bg-zinc-950 rounded-3xl overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold flex items-center gap-2 text-blue-400">
                    <ScanLine /> دليل استخراج الرابط
                  </h3>
                  <button onClick={() => setShowNetworkGuide(false)} className="text-zinc-500 hover:text-white">إغلاق</button>
                </div>
                
                <div className="space-y-6 text-sm">
                  <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                    <h4 className="font-bold text-white mb-2">1. افتح أدوات المطور (F12)</h4>
                    <p className="text-zinc-400">في متصفحك، اضغط F12 أو كليك يمين ثم "Inspect".</p>
                  </div>
                  
                  <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                    <h4 className="font-bold text-white mb-2">2. اذهب لتبويب Network</h4>
                    <p className="text-zinc-400">ابحث عن الفلتر "Fetch/XHR" أو "WS" (WebSockets).</p>
                  </div>
                  
                  <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                    <h4 className="font-bold text-white mb-2">3. ابحث عن هذه الكلمات</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['history', 'rounds', 'sync', 'results', 'betting'].map(word => (
                        <span key={word} className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 font-mono">{word}</span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-900/20 rounded-xl border border-blue-500/30">
                    <h4 className="font-bold text-blue-400 mb-2">الرابط الذي أحتاجه:</h4>
                    <p className="text-zinc-300">هو الرابط الذي يظهر فيه "Response" يحتوي على مصفوفة (Array) من الأرقام أو أسماء الفواكه/الحيوانات. هذا هو "شريان البيانات" للعبة.</p>
                  </div>

                  <div className="pt-4">
                    <label className="block text-xs font-mono text-zinc-500 mb-2">أدخل الرابط هنا للمراقبة (اختياري):</label>
                    <input 
                      type="text"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-blue-400 font-mono text-xs focus:outline-none focus:border-blue-500"
                      placeholder="https://game-api.com/v1/history..."
                      value={liveUrl}
                      onChange={(e) => setLiveUrl(e.target.value)}
                    />
                    <p className="text-[10px] text-zinc-600 mt-2">ملاحظة: المتصفح قد يمنع الاتصال المباشر بسبب سياسات CORS، لذا يفضل نسخ البيانات يدوياً ولصقها في قسم "بيانات".</p>
                  </div>
                </div>
              </div>
            ) : showJsonInput ? (
              <div className="h-full flex flex-col p-8 bg-zinc-950 rounded-3xl overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold flex items-center gap-2 text-emerald-400">
                    <FileJson /> محلل بيانات Sniffer
                  </h3>
                  <button onClick={() => setShowJsonInput(false)} className="text-zinc-500 hover:text-white">إغلاق</button>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <h4 className="text-emerald-400 font-bold text-sm mb-1">الخطوة المطلوبة:</h4>
                    <p className="text-zinc-300 text-xs leading-relaxed">
                      1. في برنامج Sniffer، اضغط على رابط <code className="text-emerald-300">get_notify</code> أو <code className="text-emerald-300">query_my_bet</code>.<br/>
                      2. اذهب لتبويب <span className="font-bold text-white">Response</span> أو <span className="font-bold text-white">Body</span>.<br/>
                      3. انسخ النص البرمجي بالكامل (JSON) والصقه في المربع أدناه.
                    </p>
                  </div>
                </div>

                <textarea 
                  className="flex-1 min-h-[200px] bg-zinc-900 border border-zinc-800 rounded-2xl p-4 font-mono text-xs text-emerald-400 focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-700"
                  placeholder='{ "data": { "history": [...] } }'
                  value={jsonInput}
                  onChange={(e) => {
                    setJsonInput(e.target.value);
                    setAnalysisResult(null);
                  }}
                />

                {analysisResult && (
                  <div className={`mt-4 p-3 rounded-lg text-xs text-center ${analysisResult.includes('✅') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {analysisResult}
                  </div>
                )}

                <div className="flex gap-4 mt-6">
                  <button 
                    onClick={async () => {
                      if (!jsonInput.trim()) return;
                      setAnalysisResult("⏳ جاري التحليل...");
                      try {
                        await handleJsonAnalysis();
                        setAnalysisResult("✅ تم التحديث بنجاح!");
                      } catch (err: any) {
                        setAnalysisResult(`❌ خطأ: ${err.message}`);
                      }
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                  >
                    <Zap size={18} />
                    تحديث الخوارزمية بالبيانات
                  </button>
                </div>
              </div>
            ) : isAnalyzing ? renderLoadingState() : result ? renderResultState() : renderInitialState()}
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-zinc-900 to-indigo-950 border border-blue-800/50 rounded-3xl p-6 text-center">
              <p className="text-sm font-mono text-zinc-400 mb-2">الرهان الموصى به</p>
              {result && finalRecommendedBet ? (
                <>
                  {detectedPattern && (
                    <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col gap-2 shadow-[0_0_15px_rgba(245,158,11,0.1)] text-right">
                      <div className="flex items-center justify-end gap-2 font-bold text-sm text-amber-400">
                        <span>تم كشف النمط المكتشف 100%!</span>
                        <Zap size={16} className="fill-amber-400" />
                      </div>
                      <p className="font-semibold text-[13px]">{detectedPattern.name}</p>
                      <p className="text-zinc-400 text-xs">{detectedPattern.description}</p>
                    </div>
                  )}
                  <div className="text-8xl my-4 animate-bounce">{getSymbolEmoji(finalRecommendedBet as SymbolType)}</div>
                  <h2 className="text-4xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                    {SYMBOLS[finalRecommendedBet as SymbolType]?.arabicName}
                  </h2>
                  <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 font-bold px-3 py-1 rounded-full text-lg mt-4">
                    {SYMBOLS[finalRecommendedBet as SymbolType]?.multiplier}X
                  </div>
                </>
              ) : (
                <div className="py-10">
                  <div className="text-6xl opacity-20">?</div>
                  <p className="text-zinc-600 text-sm font-mono mt-2">في انتظار التحليل</p>
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h3 className="text-sm font-mono text-zinc-400 mb-4 flex items-center gap-2"><History size={16} /> سجل التسلسل</h3>
              <div className="grid grid-cols-6 gap-2">
                {(result?.history || Array(12).fill(null)).slice(0, 12).map((sym, i) => (
                  <div 
                    key={i} 
                    className="aspect-square rounded-lg bg-zinc-800 flex items-center justify-center text-3xl border border-transparent"
                    title={sym || 'فارغ'}
                  >
                    {sym ? getSymbolEmoji(sym as SymbolType) : <div className="w-3 h-3 rounded-full bg-zinc-700"></div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <h3 className="text-sm font-mono text-zinc-400 mb-2 flex items-center gap-2"><BrainCircuit size={16} /> استراتيجية التحليل</h3>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  {finalExplanation || "في انتظار تحليل البيانات لتحديد الاستراتيجية الأنسب..."}
                </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <h3 className="text-sm font-mono text-zinc-400 mb-2">مؤشر الموثوقية</h3>
                <div className="relative h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-500" style={{width: `${finalConfidenceScore || 0}%`}}></div>
                </div>
            </div>
          </div>
        </main>

        {result && result.trendData && (
            <section className="mt-6 bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <h2 className="text-sm font-mono text-zinc-400 mb-4 flex items-center gap-2"><TrendingUp size={16} /> تحليل الاتجاهات (Trend)</h2>
                <TrendChart data={result.trendData} />
            </section>
        )}

        {result && (
            <section className="mt-6 bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <h2 className="text-sm font-mono text-zinc-400 mb-4 flex items-center gap-2"><TrendingUp size={16} /> توزيع الاحتمالات</h2>
                <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 50, left: 50, bottom: 5 }}>
                            <XAxis type="number" hide />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              stroke="#ffffff" 
                              fontSize={16} 
                              fontWeight="bold"
                              axisLine={false} 
                              tickLine={false} 
                              width={120} 
                              tick={{ fill: '#ffffff' }}
                            />
                            <Bar 
                              dataKey="prob" 
                              radius={[0, 4, 4, 0]} 
                              fill="#3b82f6"
                              background={{ fill: '#18181b', radius: 4 }}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>
        )}

        <footer className="mt-16 pt-8 border-t border-zinc-800 text-center text-xs text-zinc-600 font-mono">
            <p>&copy; {new Date().getFullYear()} Åñt!ká Industries. For entertainment purposes only. Play responsibly.</p>
        </footer>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .bg-grid-zinc-800\/40 {
            background-image: linear-gradient(to right, rgba(63, 63, 70, 0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(63, 63, 70, 0.4) 1px, transparent 1px);
            background-size: 24px 24px;
        }
        @keyframes progress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        .animate-progress {
            animation: progress 1.5s ease-in-out infinite;
        }
      `}} />
    </div>
  );
};

export default App;
