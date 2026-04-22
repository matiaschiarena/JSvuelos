import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plane, 
  ArrowLeftRight, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  AlertCircle,
  Menu,
  ChevronRight,
  ChevronLeft,
  Download,
  Zap
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence, useSpring, useTransform } from 'motion/react';
import html2canvas from 'html2canvas';

// Helper for rolling numbers
const AnimatedNumber = ({ value, prefix = "", suffix = "", decimals = 0 }: { value: number, prefix?: string, suffix?: string, decimals?: number }) => {
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => {
    return `${prefix}${current.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
};

interface Availability {
  date: string;
  dayOfWeek: string;
  count: number;
  tax: number;
  isRecorded: boolean;
}

interface FlightData {
  route: string;
  availability: Availability[];
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const BUE_AIRPORTS = ["AEP", "EZE"];

const AIRPORT_NAMES: Record<string, string> = {
  // Argentina
  "AEP": "Aeroparque",
  "EZE": "Ezeiza",
  "BRC": "Bariloche",
  "COR": "Córdoba",
  "MDZ": "Mendoza",
  "SLA": "Salta",
  "IGR": "Iguazú",
  "TUC": "Tucumán",
  "NQN": "Neuquén",
  "FTE": "El Calafate",
  "USH": "Ushuaia",
  "REL": "Trelew",
  "CRD": "Comodoro Rivadavia",
  "CDR": "Comodoro Rivadavia",
  "JUJ": "Jujuy",
  "PSS": "Posadas",
  "CTC": "Catamarca",
  "SDE": "Santiago del Estero",
  "RES": "Resistencia",
  "VME": "Villa Mercedes",
  "CPC": "San Martín de los Andes",
  "RGL": "Río Gallegos",
  "VDM": "Viedma",
  
  // Internacional / Regional
  "SCL": "Santiago de Chile",
  "LIM": "Lima",
  "GIG": "Río de Janeiro",
  "GRU": "São Paulo",
  "REC": "Recife",
  "ASU": "Asunción",
  "FLN": "Florianópolis",
  "MVD": "Montevideo",
  "VVI": "Santa Cruz",
  "MCZ": "Maceió",
  "FOR": "Fortaleza",
  "CUR": "Curitiba",
  "POA": "Porto Alegre",
  
  // Chile
  "CJC": "Calama",
  "ANF": "Antofagasta",
  "IQQ": "Iquique",
  "CCP": "Concepción",
  "PMC": "Puerto Montt",
  "BBA": "Balmaceda",
  "PUQ": "Punta Arenas",
  "ZCO": "Temuco",
  "LSC": "La Serena",
  "ARI": "Arica",
  "CPO": "Copiapó",
  
  // Colombia / Perú / Otros
  "BOG": "Bogotá",
  "MDE": "Medellín",
  "CTG": "Cartagena",
  "ADZ": "San Andrés",
  "AXM": "Armenia",
  "PEI": "Pereira",
  "CUC": "Cúcuta",
  "BAQ": "Barranquilla",
  "SMR": "Santa Marta",
  "AQP": "Arequipa",
  "CUZ": "Cusco",
  "PIU": "Piura",
  "TYL": "Talara",
  "TPP": "Tarapoto",
  "IQT": "Iquitos",
  "PCL": "Pucallpa",
  "JUL": "Juliaca",
  "TRU": "Trujillo",
  
  // Agrupadores
  "BUE": "Buenos Aires",
  "BUENOS AIRES (BUE)": "Buenos Aires"
};

const QUICK_ROUTES = [
  { o: "AEP", d: "CRD", label: "AEP-CRD", key: "1" },
  { o: "AEP", d: "NQN", label: "AEP-NQN", key: "2" },
  { o: "AEP", d: "ASU", label: "AEP-ASU", key: "3" },
  { o: "AEP", d: "MDZ", label: "AEP-MDZ", key: "4" },
];

type ChartType = 'bar' | 'line' | 'pie' | 'area';

const getAirportLabel = (code: string) => {
  if (code === "BUENOS AIRES (BUE)") return code;
  const name = AIRPORT_NAMES[code];
  return name ? `${code} - ${name}` : code;
};

export default function App() {
  const [data, setData] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selection States
  const [origin, setOrigin] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [groupBUE, setGroupBUE] = useState(false);
  const [chartType, setChartType] = useState<ChartType>('bar');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    fetch('/api/flights')
      .then(res => res.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setData(json);
        
        // Initial Selection
        if (json.length > 0) {
          const firstRoute = json[0].route.split('-');
          setOrigin(firstRoute[0]);
          setDestination(firstRoute[1]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Error cargando los datos. Por favor reintenta luego.");
        setLoading(false);
      });
  }, []);

  const [notification, setNotification] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleQuickRoute = (o: string, d: string) => {
    // Helper to find the actual code in data (e.g. CRD vs CDR)
    const findActualCode = (code: string, isOrigin: boolean) => {
      if (groupBUE && BUE_AIRPORTS.includes(code)) return "BUENOS AIRES (BUE)";
      
      const aliases: Record<string, string[]> = {
        "CRD": ["CRD", "CDR"],
        "CDR": ["CRD", "CDR"]
      };
      
      const potentials = aliases[code] || [code];
      
      for (const flight of data) {
        const [fo, fd] = flight.route.split('-');
        const val = isOrigin ? fo : fd;
        if (potentials.includes(val)) return val;
      }
      return code;
    };

    const targetOrigin = findActualCode(o, true);
    const targetDest = findActualCode(d, false);
    
    const targetOriginInv = findActualCode(d, true);
    const targetDestInv = findActualCode(o, false);

    // If already selected, invert
    if (origin === targetOrigin && destination === targetDest) {
      setOrigin(targetOriginInv);
      setDestination(targetDestInv);
    } else {
      setOrigin(targetOrigin);
      setDestination(targetDest);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const route = QUICK_ROUTES.find(r => r.key === e.key);
      if (route) {
        handleQuickRoute(route.o, route.d);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [origin, destination, groupBUE]);

  // Derived Selection Options
  const uniqueOrigins = useMemo(() => {
    const set = new Set<string>();
    data.forEach(f => {
      const [o] = f.route.split('-');
      if (groupBUE && BUE_AIRPORTS.includes(o)) {
        set.add("BUENOS AIRES (BUE)");
      } else {
        set.add(o);
      }
    });
    return Array.from(set).sort();
  }, [data, groupBUE]);

  const uniqueDestinations = useMemo(() => {
    const set = new Set<string>();
    data.forEach(f => {
      const [o, d] = f.route.split('-');
      const isOriginMatch = groupBUE 
        ? (origin === "BUENOS AIRES (BUE)" ? BUE_AIRPORTS.includes(o) : o === origin)
        : o === origin;
      
      if (isOriginMatch) {
        if (groupBUE && BUE_AIRPORTS.includes(d)) {
          set.add("BUENOS AIRES (BUE)");
        } else {
          set.add(d);
        }
      }
    });
    return Array.from(set).sort();
  }, [data, origin, groupBUE]);

  // Handle auto-correction of destination when origin changes
  useEffect(() => {
    if (origin && uniqueDestinations.length > 0) {
      if (!uniqueDestinations.includes(destination)) {
        setDestination(uniqueDestinations[0]);
      }
    }
  }, [origin, uniqueDestinations, destination]);

  // Aggregated Data Calculation
  const aggregatedData = useMemo(() => {
    if (!origin || !destination) return null;

    const matchingRoutes = data.filter(f => {
      const [o, d] = f.route.split('-');
      const oMatch = groupBUE 
        ? (origin === "BUENOS AIRES (BUE)" ? BUE_AIRPORTS.includes(o) : o === origin)
        : o === origin;
      const dMatch = groupBUE 
        ? (destination === "BUENOS AIRES (BUE)" ? BUE_AIRPORTS.includes(d) : d === destination)
        : d === destination;
      return oMatch && dMatch;
    });

    if (matchingRoutes.length === 0) return null;

    // Merge by date
    const dateMap: Record<string, Availability> = {};
    
    matchingRoutes.forEach(route => {
      route.availability.forEach(a => {
        if (!a.isRecorded) return; // Only merge days that have actual data recorded

        if (!dateMap[a.date]) {
          dateMap[a.date] = { ...a };
        } else {
          const existing = dateMap[a.date];
          existing.count += a.count;
          if (a.count > 0) {
            existing.tax = existing.tax === 0 ? a.tax : Math.min(existing.tax, a.tax);
          }
        }
      });
    });

    const mergedAvailability = Object.values(dateMap).sort((a, b) => b.date.localeCompare(a.date));

    return {
      route: `${origin} - ${destination}`,
      availability: mergedAvailability
    };
  }, [data, origin, destination, groupBUE]);

  const stats = useMemo(() => {
    if (!aggregatedData) return null;
    const recordedDays = aggregatedData.availability.filter(a => a.isRecorded);
    const totalRecorded = recordedDays.length;
    const successfulDays = recordedDays.filter(a => a.count > 0).length;
    const totalFlights = recordedDays.reduce((acc, curr) => acc + curr.count, 0);
    const avgTax = recordedDays.reduce((acc, curr) => acc + (curr.count > 0 ? curr.tax : 0), 0) / (successfulDays || 1);
    
    const dayStats = DAYS_OF_WEEK.map(day => {
      const dayData = recordedDays.filter(a => a.dayOfWeek === day);
      const dayAvailable = dayData.filter(a => a.count > 0).length;
      const dayTotal = dayData.length;
      return {
        name: day,
        percentage: dayTotal > 0 ? (dayAvailable / dayTotal) * 100 : 0,
        successCount: dayAvailable,
        totalCount: dayTotal,
        avgFlights: dayAvailable > 0 ? dayData.reduce((acc, curr) => acc + curr.count, 0) / dayAvailable : 0
      };
    }).filter(d => d.totalCount > 0);

    return {
      availabilityPercent: totalRecorded > 0 ? (successfulDays / totalRecorded) * 100 : 0,
      avgFlights: successfulDays > 0 ? totalFlights / successfulDays : 0,
      avgTax,
      totalRecorded,
      successfulDays,
      dayStats
    };
  }, [aggregatedData]);

  const toggleChartType = () => {
    const types: ChartType[] = ['bar', 'line', 'pie', 'area'];
    const currentIndex = types.indexOf(chartType);
    const nextIndex = (currentIndex + 1) % types.length;
    setChartType(types[nextIndex]);
  };

  const invertRoute = () => {
    const oldOrigin = origin;
    const oldDest = destination;
    
    // Check if inverted exists in data (raw or grouped)
    const exists = data.some(f => {
      const [o, d] = f.route.split('-');
      const oMatch = groupBUE 
        ? (oldDest === "BUENOS AIRES (BUE)" ? BUE_AIRPORTS.includes(o) : o === oldDest)
        : o === oldDest;
      const dMatch = groupBUE 
        ? (oldOrigin === "BUENOS AIRES (BUE)" ? BUE_AIRPORTS.includes(d) : d === oldOrigin)
        : d === oldOrigin;
      return oMatch && dMatch;
    });

    if (exists) {
      setOrigin(oldDest);
      setDestination(oldOrigin);
    } else {
      setNotification(`Trayecto de vuelta (${oldDest}-${oldOrigin}) no encontrado.`);
    }
  };

  const exportToImage = async () => {
    const element = dashboardRef.current;
    if (!element) return;
    
    setIsExporting(true);
    setNotification("Generando reporte visual...");

    try {
      // html2canvas fails with oklch(), so we create a temporary style override
      const style = document.createElement('style');
      style.innerHTML = `
        * { 
          color: inherit !important; 
          background-color: transparent !important;
          border-color: rgba(255,255,255,0.1) !important;
        }
        .text-cyan-400 { color: #22d3ee !important; }
        .bg-cyan-400 { background-color: #22d3ee !important; }
        .text-rose-500 { color: #f43f5e !important; }
        .bg-rose-500 { background-color: #f43f5e !important; }
        .text-slate-500 { color: #64748b !important; }
        .text-slate-200 { color: #e2e8f0 !important; }
        .bg-[#020617] { background-color: #020617 !important; }
        .glass-panel { background-color: rgba(15, 23, 42, 0.9) !important; backdrop-filter: none !important; }
        .stat-card { background-color: rgba(15, 23, 42, 0.9) !important; backdrop-filter: none !important; }
      `;

      const canvas = await html2canvas(element, {
        backgroundColor: '#020617',
        scale: 1.2,
        useCORS: true,
        logging: false,
        ignoreElements: (el) => el.tagName === 'BUTTON' || el.classList.contains('notification-toast'),
        onclone: (clonedDoc) => {
          clonedDoc.head.appendChild(style);
          // Hard fix for any remaining oklch in computed styles that html2canvas might pick up
          const allElements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i] as HTMLElement;
            // Clean up backdrop filters which also cause issues
            if (el.style) {
              el.style.backdropFilter = 'none';
              (el.style as any).webkitBackdropFilter = 'none';
            }
          }
        }
      });

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `radar-${origin}-${destination}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setNotification("¡Reporte generado con éxito!");
    } catch (err) {
      console.error("Screenshot failed:", err);
      setNotification("Error de captura debido a incompatibilidad de navegador. Probá usando Ctrl+P.");
    } finally {
      setIsExporting(false);
    }
  };
  const getBestDayPrediction = () => {
    if (!stats || stats.dayStats.length === 0) return null;
    const sorted = [...stats.dayStats].sort((a, b) => b.percentage - a.percentage);
    const best = sorted[0];
    if (best.percentage === 0) return null;
    
    return {
      day: best.name,
      prob: best.percentage,
      desc: `Históricamente, los ${best.name} tienen mayor probabilidad de canje.`
    };
  };

  const prediction = getBestDayPrediction();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="flex flex-col items-center gap-4">
          <Plane className="w-12 h-12 text-cyan-400 animate-pulse" />
          <p className="text-slate-400 font-medium tracking-tight">Cargando inteligencia de vuelos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] p-6">
        <div className="glass-panel p-8 max-w-md text-center flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-rose-500" />
          <h2 className="text-xl font-bold">Error de conexión</h2>
          <p className="text-slate-400">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans">
      <div className="pulse-glow" />
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-[#0f172a]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cyan-400 rounded-lg flex items-center justify-center">
            <Plane className="w-5 h-5 text-black" strokeWidth={3} />
          </div>
          <span className="font-bold tracking-tight">JETSMART <span className="font-light opacity-60 italic">ANALYZER</span></span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          <Menu className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      <div className="flex h-screen overflow-hidden relative z-10">
        {/* Sidebar */}
      <AnimatePresence>
        {(isSidebarOpen || window.innerWidth >= 768) && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="fixed md:relative z-40 w-72 h-full md:h-screen border-r border-slate-800 bg-[#0f172a] p-6 flex flex-col"
          >
            <div className="hidden md:flex flex-col gap-1 mb-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-cyan-400 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                  <Plane className="w-6 h-6 text-black" strokeWidth={3} />
                </div>
                <h1 className="text-xl font-bold tracking-tight">JetSmart <span className="font-light opacity-60 italic">Analyzer</span></h1>
              </div>
              <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase ml-12">by Matías A. Chiarena</span>
            </div>

            <div className="flex flex-col gap-5 overflow-y-auto custom-scrollbar flex-1 mb-6">
              <div className="space-y-4">
                {/* Grouping Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-800 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">Agrupar BUE (AEP/EZE)</span>
                  <button 
                    onClick={() => setGroupBUE(!groupBUE)}
                    className={`w-8 h-4 rounded-full relative transition-colors ${groupBUE ? 'bg-cyan-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${groupBUE ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Origin Dropdown */}
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-1.5 block">Origen</label>
                  <select 
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-[11px] p-3 rounded-lg focus:outline-none focus:border-cyan-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Seleccionar origen</option>
                    {uniqueOrigins.map(o => (
                      <option key={o} value={o}>{getAirportLabel(o)}</option>
                    ))}
                  </select>
                </div>

                {/* Destination Dropdown */}
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-1.5 block">Destino</label>
                  <select 
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-[11px] p-3 rounded-lg focus:outline-none focus:border-cyan-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Seleccionar destino</option>
                    {uniqueDestinations.map(d => (
                      <option key={d} value={d}>{getAirportLabel(d)}</option>
                    ))}
                  </select>
                </div>

                {/* Quick Search Buttons */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <label className="text-[10px] uppercase font-black text-slate-600 tracking-widest mb-2 block">Búsquedas Rápidas</label>
                  <div className="flex flex-col gap-2">
                    {QUICK_ROUTES.map((route, idx) => (
                      <button
                        key={route.label}
                        onClick={() => handleQuickRoute(route.o, route.d)}
                        className={`group px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-800 hover:border-cyan-400/50 transition-all text-left flex items-center justify-between ${
                          (origin === route.o || (groupBUE && BUE_AIRPORTS.includes(route.o) && origin === "BUENOS AIRES (BUE)")) &&
                          (destination === route.d || (groupBUE && BUE_AIRPORTS.includes(route.d) && destination === "BUENOS AIRES (BUE)"))
                            ? 'bg-cyan-400/5 border-cyan-400/30'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-slate-600 group-hover:text-cyan-400/70">({route.key})</span>
                          <span className="text-[10px] font-bold text-slate-300 uppercase group-hover:text-cyan-400 transition-colors">{route.label}</span>
                        </div>
                        <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-cyan-400/50" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto p-4 bg-cyan-400/5 border border-cyan-400/20 rounded-xl">
              <p className="text-[10px] text-cyan-400 font-bold uppercase mb-1">Estado de Red</p>
              <p className="text-[11px] text-slate-400 font-medium">Sheet sincronizado hace 14 min</p>
              <div className="w-full h-1 bg-slate-800 mt-3 rounded-full overflow-hidden">
                 <div className="w-3/4 h-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        <main 
          className="flex-1 overflow-y-auto h-screen relative custom-scrollbar p-4 md:p-8 scroll-smooth"
        >
          <AnimatePresence>
            {notification && (
              <motion.div
                initial={{ opacity: 0, y: -20, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: -20, x: '-50%' }}
                className="fixed top-4 left-1/2 z-[100] px-6 py-3 bg-cyan-500 text-slate-900 text-xs font-black uppercase rounded-full shadow-[0_0_30px_rgba(34,211,238,0.4)] flex items-center gap-3 border border-white/20"
              >
                <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                {notification}
              </motion.div>
            )}
          </AnimatePresence>

          <div 
            ref={dashboardRef}
            className="w-full max-w-7xl mx-auto"
          >
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-3 mb-2">
                  <h2 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tighter text-white uppercase italic truncate drop-shadow-sm">
                    {origin ? getAirportLabel(origin) : '...'} — {destination ? getAirportLabel(destination) : '...'}
                  </h2>
                  <button 
                    onClick={invertRoute}
                    className="p-2 bg-slate-800/80 hover:bg-slate-700 rounded-xl text-cyan-400 hover:text-white transition-all border border-white/5 shadow-lg active:scale-95"
                    title="Invertir Trayecto"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-slate-500 text-sm font-bold tracking-tight uppercase opacity-80 pl-1">Monitoring Availability v2.0</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={exportToImage}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 h-10 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all disabled:opacity-50 active:scale-95 shadow-xl"
                >
                  <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                  {isExporting ? 'Procesando...' : 'Compartir'}
                </button>
                <div className="h-10 px-4 bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-xl flex items-center gap-3 shadow-inner">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Live Sync</span>
                  </div>
                  <div className="w-px h-4 bg-slate-800" />
                  <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">{new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="stat-card"
            >
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Disponibilidad Histórica</span>
              <div className="text-3xl font-black text-cyan-400 flex items-baseline gap-1">
                <AnimatedNumber value={stats?.availabilityPercent || 0} decimals={1} />
                <span className="text-sm opacity-50">%</span>
              </div>
              <div className="w-full bg-slate-800/50 h-1.5 rounded-full mt-2 overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats?.availabilityPercent || 0}%` }}
                  className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" 
                />
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="stat-card"
            >
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Días con Cupos</span>
              <div className="text-3xl font-black text-white">
                <AnimatedNumber value={stats?.successfulDays || 0} />
                <span className="text-slate-600 text-lg ml-2 font-light">/ {stats?.totalRecorded}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase opacity-60">Registros procesados</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="stat-card"
            >
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tasa Promedio</span>
              <div className="text-3xl font-black text-white flex items-baseline gap-1">
                <span className="text-sm opacity-50 text-cyan-400">$</span>
                <AnimatedNumber value={Math.round(stats?.avgTax || 0)} />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase opacity-60">Estimado Regional</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="stat-card"
            >
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vuelos x Día</span>
              <div className="text-3xl font-black text-white">
                <AnimatedNumber value={stats?.avgFlights || 0} decimals={1} />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase opacity-60">Promedio detectado</p>
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            {prediction && (
              <motion.div 
                key={`${origin}-${destination}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel p-4 mb-8 border-l-4 border-l-cyan-500 bg-gradient-to-r from-cyan-500/10 to-transparent flex items-center gap-4 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 bg-cyan-400 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 w-32 h-32" />
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                  <Zap className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 mb-0.5">Predicción Inteligente AI</p>
                  <p className="text-sm text-slate-100 font-medium">
                    Analizando el histórico: <span className="font-black text-cyan-400 underline decoration-cyan-500/30 underline-offset-4 decoration-2">los {prediction.day}</span> son tu mejor ventana (Prob. <span className="text-cyan-400 font-black">{prediction.prob.toFixed(1)}%</span>).
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Heatmap Section */}
          <div className="glass-panel p-6 mb-8 border-white/5">
            <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">Resumen de Disponibilidad por Fecha</h3>
              </div>
              <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-slate-500">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-[3px] bg-slate-800 transition-transform hover:scale-125" /> N/A</div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-[3px] bg-rose-500/30 border border-rose-500/20" /> Sin Cupo</div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-[3px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]" /> Disponible</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {aggregatedData?.availability.map((day, idx) => (
                <motion.div 
                  key={idx}
                  whileHover={{ scale: 1.15, zIndex: 10 }}
                  title={`${day.date}: ${day.count} vuelos detectados`}
                  className={`
                    w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-black transition-all cursor-crosshair relative group
                    ${day.count > 0 ? 'bg-cyan-400 text-slate-900 shadow-lg shadow-cyan-500/20' : 'bg-rose-500/20 text-rose-300/80 border border-rose-500/10'}
                  `}
                >
                  <span className="relative z-10">{day.date.split('-')[2]}</span>
                  {day.count > 0 && <div className="absolute inset-0 bg-white/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />}
                </motion.div>
              ))}
            </div>
          </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
          <div 
            className="glass-panel p-6 cursor-pointer group active:scale-[0.98] transition-all"
            onClick={toggleChartType}
            title="Siguiente gráfico (Clic para cambiar)"
          >
            <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Probabilidades por día
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-600 uppercase">Tipo: {chartType}</span>
                <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={stats?.dayStats}>
                    <XAxis 
                      dataKey="name" 
                      stroke="#475569" 
                      fontSize={10} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => val.substring(0, 3).toUpperCase()} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#22d3ee' }}
                      cursor={{ fill: '#1e293b' }}
                      formatter={(value, name) => {
                        if (name === "Success %") return [`${(value as number).toFixed(1)}%`, "Probabilidad"];
                        return [value, name];
                      }}
                      labelFormatter={(label, payload) => {
                        const data = payload[0]?.payload;
                        if (!data) return label;
                        return `${label}: ${data.successCount} de ${data.totalCount} días operativos`;
                      }}
                    />
                    <Bar dataKey="percentage" name="Success %" radius={[4, 4, 0, 0]} barSize={24}>
                      {stats?.dayStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.percentage > 50 ? '#22d3ee' : '#334155'} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : chartType === 'line' ? (
                  <LineChart data={stats?.dayStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#475569" 
                      fontSize={10} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => val.substring(0, 3).toUpperCase()} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#22d3ee' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="percentage" 
                      name="Success %" 
                      stroke="#22d3ee" 
                      strokeWidth={3} 
                      dot={{ fill: '#22d3ee', strokeWidth: 2, r: 4 }} 
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                ) : chartType === 'area' ? (
                  <AreaChart data={stats?.dayStats}>
                    <defs>
                      <linearGradient id="colorPerc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#475569" 
                      fontSize={10} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => val.substring(0, 3).toUpperCase()} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="percentage" 
                      stroke="#22d3ee" 
                      fillOpacity={1} 
                      fill="url(#colorPerc)" 
                      strokeWidth={3}
                    />
                  </AreaChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={stats?.dayStats}
                      dataKey="percentage"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      fill="#334155"
                      label={({ name, percentage }) => percentage > 0 ? `${name.substring(0, 3)}` : ''}
                      labelLine={false}
                    >
                      {stats?.dayStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.percentage > 50 ? '#22d3ee' : '#1e293b'} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-800 pb-3">
              Alertas de Normalización
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded bg-slate-800/20 border border-slate-800/50">
                <span className="text-[11px] text-slate-400">Error detectado: ERR-BTN</span>
                <span className="text-[10px] font-bold bg-cyan-400/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-400/20">Set to $7.1k</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-800/20 border border-slate-800/50">
                <span className="text-[11px] text-slate-400">Variación Internacional</span>
                <span className="text-[10px] font-bold bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded border border-amber-400/20">Normalizado</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-800/20 border border-slate-800/50">
                <span className="text-[11px] text-slate-400">Calibración de Tolerancia</span>
                <span className="text-[10px] font-bold bg-slate-800 text-slate-500 px-2 py-0.5 rounded">20% Lim.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel flex-1 overflow-hidden flex flex-col mb-8">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Histórico de Disponibilidad</h3>
            <span className="text-[10px] text-slate-500 font-bold">TODOS LOS REGISTROS</span>
          </div>
          <div className="overflow-y-auto max-h-[500px] custom-scrollbar">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-800 text-slate-500 bg-[#0f172a]">
                  <th className="py-3 px-6 font-bold uppercase tracking-wider text-[10px]">Fecha</th>
                  <th className="py-3 px-6 font-bold uppercase tracking-wider text-[10px]">Estado</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px]">Vuelos</th>
                  <th className="py-3 px-6 font-bold uppercase tracking-wider text-[10px]">Tasa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {aggregatedData?.availability.map((a, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-6">
                      <div className="font-bold text-slate-200">{a.date.split('-').reverse().slice(0, 2).join('/')}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-tighter">{a.dayOfWeek}</div>
                    </td>
                    <td className="py-3 px-6">
                      {a.count > 0 ? (
                        <span className="px-2 py-1 rounded-full bg-cyan-400/10 text-cyan-400 text-[10px] font-bold border border-cyan-400/20 uppercase tracking-wide">Disponible</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/20 uppercase tracking-wide">Sin Vuelo</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 font-bold">
                      {a.count}
                    </td>
                    <td className="py-3 px-6">
                      <span className={a.count > 0 ? 'text-slate-200 font-bold font-mono' : 'text-slate-700'}>
                        {a.count > 0 ? `$${a.tax.toLocaleString()}` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
        
        <footer className="text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest pb-10">
          JetSmart Analyzer Engine • V1.0.4 • Datos Certificados
        </footer>
      </main>
    </div>
    </div>
  );
}
