import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plane, 
  ArrowLeftRight, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  DollarSign, 
  AlertCircle,
  Menu,
  ChevronRight,
  ChevronLeft,
  Download,
  Zap,
  Grid,
  Command,
  LayoutDashboard,
  CalendarDays,
  ShieldCheck,
  Settings,
  Eye,
  EyeOff,
  Palette
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
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

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
  { o: "AEP", d: "BRC", label: "AEP-BRC", key: "5" },
  { o: "AEP", d: "USH", label: "AEP-USH", key: "6" },
  { o: "AEP", d: "SCL", label: "AEP-SCL", key: "7" },
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
  const [theme, setTheme] = useState<'default' | 'scanner' | 'amber' | 'nebula'>('default');
  const [showSweeper, setShowSweeper] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-sweeper', showSweeper ? 'on' : 'off');
  }, [showSweeper]);

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
  const [viewMode, setViewMode] = useState<'detailed' | 'multi' | 'calendar'>('detailed');
  const dashboardRef = useRef<HTMLDivElement>(null);

  const themeColor = useMemo(() => {
    switch(theme) {
      case 'scanner': return '#22c55e';
      case 'amber': return '#f59e0b';
      case 'nebula': return '#a855f7';
      default: return '#22d3ee';
    }
  }, [theme]);

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

  const exportToPDF = async () => {
    const element = document.getElementById('dashboard-capture');
    if (!element) {
      setNotification("Error: Área de captura no encontrada.");
      return;
    }
    
    setIsExporting(true);
    setNotification("Analizando estructura de datos...");

    try {
      // 1. Preparation: hide interactive elements
      const notificationEl = document.querySelector('.notification-toast') as HTMLElement;
      if (notificationEl) notificationEl.style.display = 'none';

      // 2. Capture as PNG using html-to-image (scales better)
      const dataUrl = await htmlToImage.toPng(element, {
        backgroundColor: '#020617',
        quality: 1,
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement) {
            if (node.tagName === 'BUTTON' || node.classList.contains('no-export') || node.classList.contains('sonar-sweeper')) return false;
          }
          return true;
        },
        style: {
          borderRadius: '0',
          padding: '24px'
        }
      });

      // 3. Create PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      
      const fileName = `Reporte_${origin}_${destination}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      setNotification("¡PDF generado y descargado correctamente!");
    } catch (err) {
      console.error('PDF Generation Error:', err);
      // Fallback to simpler method or print
      setNotification("La generación falló. Intentando método de respaldo...");
      setTimeout(() => window.print(), 800);
    } finally {
      setIsExporting(false);
      // Ensure notification is restore if needed (though state handles it)
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
          <Plane className="w-12 h-12 text-brand animate-pulse" />
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
    <div className="min-h-screen font-sans bg-[#020617] relative overflow-hidden">
      {/* Cyber Aesthetics */}
      {showSweeper && (
        <>
          <div className="cyber-overlay" />
          <div className="scanline" />
          <div className="pulse-glow" />
        </>
      )}
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-[#0f172a]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
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
                <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(var(--theme-primary),0.3)]">
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
                    className={`w-8 h-4 rounded-full relative transition-colors ${groupBUE ? 'bg-brand' : 'bg-slate-700'}`}
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
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-[11px] p-3 rounded-lg focus:outline-none focus:border-brand transition-all appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Seleccionar origen</option>
                    {uniqueOrigins.map(o => (
                      <option key={o} value={o}>{getAirportLabel(o)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-center -my-3 relative z-20">
                  <button 
                    onClick={invertRoute}
                    className="w-10 h-10 rounded-xl bg-[#1e293b] border border-slate-700 text-brand hover:text-white hover:border-brand transition-all flex items-center justify-center shadow-2xl active:scale-90 group ring-4 ring-[#0f172a]"
                    title="Invertir Origen/Destino"
                  >
                    <ArrowLeftRight className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" strokeWidth={2.5} />
                  </button>
                </div>

                {/* Destination Dropdown */}
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-1.5 block">Destino</label>
                  <select 
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-[11px] p-3 rounded-lg focus:outline-none focus:border-brand transition-all appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Seleccionar destino</option>
                    {uniqueDestinations.map(d => (
                      <option key={d} value={d}>{getAirportLabel(d)}</option>
                    ))}
                  </select>
                </div>

                {/* Settings & Estilo Section */}
                <div className="pt-4 border-t border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Configuración</label>
                    <button 
                      onClick={() => setSettingsOpen(!settingsOpen)}
                      className={`p-1.5 rounded-lg transition-all ${settingsOpen ? 'bg-brand text-slate-900 shadow-lg shadow-brand/20' : 'text-slate-500 hover:text-slate-300 bg-slate-800/40'}`}
                      title={settingsOpen ? "Cerrar Configuración" : "Esquema y Efectos"}
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <AnimatePresence>
                    {settingsOpen && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden space-y-4"
                      >
                        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/50 space-y-4">
                          <div className="space-y-2">
                            <label className="text-[9px] uppercase font-black text-slate-600 flex items-center gap-2">
                              <Palette className="w-3 h-3" /> Esquema de Color
                            </label>
                            <div className="grid grid-cols-2 gap-1.5">
                              {[
                                { id: 'default', label: 'Cyan', color: 'bg-cyan-400' },
                                { id: 'scanner', label: 'Scanner', color: 'bg-green-500' },
                                { id: 'amber', label: 'Amber', color: 'bg-amber-500' },
                                { id: 'nebula', label: 'Nebula', color: 'bg-purple-500' }
                              ].map((t) => (
                                <button 
                                  key={t.id}
                                  onClick={() => setTheme(t.id as any)}
                                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[9px] font-black uppercase transition-all border ${theme === t.id ? 'bg-brand/10 border-brand/50 text-brand' : 'bg-slate-800/20 border-transparent text-slate-500 hover:text-slate-300'}`}
                                >
                                  <div className={`w-2 h-2 rounded-full ${t.color}`} />
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[9px] uppercase font-black text-slate-600 flex items-center gap-2">
                              {showSweeper ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              Efectos Visuales
                            </label>
                            <button 
                              onClick={() => setShowSweeper(!showSweeper)}
                              className={`w-full py-1.5 px-3 rounded-md text-[9px] font-black uppercase flex items-center justify-between border transition-all ${showSweeper ? 'bg-brand/10 border-brand/50 text-brand' : 'bg-slate-800/20 border-transparent text-slate-500 hover:bg-slate-800/40'}`}
                            >
                              <span>Radar Sweeper</span>
                              <span className={showSweeper ? 'text-brand' : 'text-slate-700'}>
                                {showSweeper ? 'ON' : 'OFF'}
                              </span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-slate-600 tracking-widest mb-1 block">Búsquedas Rápidas</label>
                    <div className="flex flex-col gap-2">
                      {QUICK_ROUTES.map((route, idx) => (
                      <button
                        key={route.label}
                        onClick={() => handleQuickRoute(route.o, route.d)}
                        className={`group px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-800 hover:border-brand/50 transition-all text-left flex items-center justify-between ${
                          (origin === route.o || (groupBUE && BUE_AIRPORTS.includes(route.o) && origin === "BUENOS AIRES (BUE)")) &&
                          (destination === route.d || (groupBUE && BUE_AIRPORTS.includes(route.d) && destination === "BUENOS AIRES (BUE)"))
                            ? 'bg-brand/5 border-brand/30'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-slate-600 group-hover:text-brand/70">({route.key})</span>
                          <span className="text-[10px] font-bold text-slate-300 uppercase group-hover:text-brand transition-colors">{route.label}</span>
                        </div>
                        <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-brand/50" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-auto p-4 bg-brand/5 border border-brand/20 rounded-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-1 opacity-20">
                <ShieldCheck className="w-3 h-3 text-brand" />
              </div>
              <div className="text-[10px] text-brand font-black uppercase mb-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
                Sincronización de Datos
              </div>
              <div className="space-y-1 font-mono text-[8px] text-slate-500 uppercase tracking-tighter overflow-hidden h-12">
                 <p className="animate-pulse">{">> "}FETCHING_AIRPORTS... OK</p>
                 <p className="opacity-60">{">> "}AGGREGATING_STATS... OK</p>
                 <p className="opacity-40 animate-pulse">{">> "}ANALYZER_V1.0.4_READY</p>
              </div>
              <div className="w-full h-1 bg-slate-800 mt-3 rounded-full overflow-hidden">
                 <div className="w-3/4 h-full bg-brand shadow-[0_0_8px_rgba(var(--theme-primary),0.5)]" />
              </div>
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
                className="fixed top-4 left-1/2 z-[100] px-6 py-3 bg-brand text-slate-900 text-xs font-black uppercase rounded-full shadow-[0_0_30px_rgba(var(--theme-primary),0.4)] flex items-center gap-3 border border-white/20"
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
            id="dashboard-capture"
            className="w-full max-w-7xl mx-auto p-4 md:p-6"
          >
            <AnimatePresence mode="wait">
            {viewMode === 'detailed' && (
              <motion.div
                key="detailed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-3 mb-2">
                  <h2 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tighter text-white uppercase italic truncate drop-shadow-sm glow-text">
                    {origin ? getAirportLabel(origin) : '...'} — {destination ? getAirportLabel(destination) : '...'}
                  </h2>
                  <button 
                    onClick={invertRoute}
                    className="p-2 bg-slate-800/80 hover:bg-slate-700 rounded-xl text-brand hover:text-white transition-all border border-white/5 shadow-lg active:scale-95"
                    title="Invertir Trayecto"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>

                  <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800 ml-auto gap-1">
                    {[
                      { id: 'detailed', icon: LayoutDashboard, label: 'Detalle' },
                      { id: 'multi', icon: Grid, label: 'Multi' },
                      { id: 'calendar', icon: CalendarDays, label: 'Mensual' }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setViewMode(mode.id as any)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          viewMode === mode.id 
                            ? 'bg-brand text-slate-900 shadow-[0_0_15px_rgba(var(--theme-primary),0.4)]' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <mode.icon className="w-3 h-3" />
                        <span className="hidden sm:inline">{mode.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-slate-500 text-sm font-bold tracking-tight uppercase opacity-80 pl-1">Monitoring Availability v2.0</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={exportToPDF}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 h-10 bg-brand hover:bg-brand/80 border border-white/10 rounded-xl text-[10px] font-black text-slate-900 uppercase tracking-[0.1em] transition-all disabled:opacity-50 active:scale-95 shadow-xl"
                >
                  <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                  {isExporting ? 'Generando...' : 'Exportar PDF'}
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
              <div className="text-3xl font-black text-brand flex items-baseline gap-1">
                <AnimatedNumber value={stats?.availabilityPercent || 0} decimals={1} />
                <span className="text-sm opacity-50">%</span>
              </div>
              <div className="w-full bg-slate-800/50 h-1.5 rounded-full mt-2 overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats?.availabilityPercent || 0}%` }}
                  className="h-full bg-brand shadow-[0_0_10px_rgba(var(--theme-primary),0.5)]" 
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
                <span className="text-sm opacity-50 text-brand">$</span>
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

          {/* Heatmap Section */}
          <div className="glass-panel p-6 mb-8 border-white/5">
            <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4 text-brand" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">Resumen de Disponibilidad por Fecha</h3>
              </div>
              <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] opacity-40">SWEEP {showSweeper ? 'ENABLED' : 'DISABLED'}</span>
                </div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-[3px] bg-slate-800 transition-transform hover:scale-125" /> N/A</div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-[3px] bg-rose-500/30 border border-rose-500/20" /> Sin Cupo</div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-[3px] bg-brand shadow-[0_0_8px_rgba(var(--theme-primary),0.4)]" /> Disponible</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {aggregatedData?.availability.map((day, idx) => (
                <motion.div 
                  key={idx}
                  whileHover={{ scale: 1.15, zIndex: 10 }}
                  title={`${day.date}: ${day.count} vuelos detectados`}
                  className={`
                    w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-black transition-all cursor-crosshair relative group overflow-hidden
                    ${day.count > 0 ? 'bg-brand text-slate-900 shadow-lg shadow-brand/20' : 'bg-rose-500/20 text-rose-300/80 border border-rose-500/10'}
                  `}
                >
                  <span className="relative z-10">{day.date.split('-')[2]}</span>
                  {showSweeper && day.count > 0 && <div className="sonar-sweeper opacity-0 group-hover:opacity-100 transition-opacity" />}
                  {day.count > 0 && <div className="absolute inset-0 bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />}
                </motion.div>
              ))}
            </div>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          <div 
            className="glass-panel p-6 cursor-pointer group active:scale-[0.98] transition-all lg:col-span-2"
            onClick={toggleChartType}
            title="Siguiente gráfico (Clic para cambiar)"
          >
            <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Probabilidades por día
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-600 uppercase">Tipo: {chartType}</span>
                <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-brand group-hover:translate-x-1 transition-all" />
              </div>
            </div>
            <div className="h-56 w-full relative overflow-hidden group">
              {showSweeper && (
                <div className="sonar-sweeper opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
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
                      itemStyle={{ color: themeColor }}
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
                        <Cell key={`cell-${index}`} fill={entry.percentage > 50 ? themeColor : '#334155'} />
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
                      itemStyle={{ color: themeColor }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="percentage" 
                      name="Success %" 
                      stroke={themeColor} 
                      strokeWidth={3} 
                      dot={{ fill: themeColor, strokeWidth: 2, r: 4 }} 
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                ) : chartType === 'area' ? (
                  <AreaChart data={stats?.dayStats}>
                    <defs>
                      <linearGradient id="colorPerc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={themeColor} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={themeColor} stopOpacity={0}/>
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
                      stroke={themeColor} 
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
                      label={({ name, percentage }) => (percentage > 0 && name) ? `${String(name).substring(0, 3)}` : ''}
                      labelLine={false}
                    >
                      {stats?.dayStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.percentage > 50 ? themeColor : '#1e293b'} />
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

          <div className="glass-panel p-6 flex flex-col justify-between overflow-hidden">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-800 pb-3">
                Resumen Ejecutivo
              </h3>
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-800/20 border border-slate-800/50">
                  <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Día Más Probable</p>
                  <p className="text-sm font-black text-brand">
                    {stats?.dayStats && stats.dayStats.length > 0 
                      ? [...stats.dayStats].sort((a,b) => b.percentage - a.percentage)[0]?.name 
                      : '--'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/20 border border-slate-800/50">
                  <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Tendencia de Red</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">Estable</span>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/20 border border-slate-800/50">
                  <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Región de Análisis</p>
                  <p className="text-sm font-black text-white italic">{origin === 'AEP' || origin === 'EZE' ? 'Mercosur / Doméstico' : 'Regional / Cono Sur'}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800">
               <button 
                onClick={exportToPDF}
                className="w-full py-3 bg-brand text-slate-900 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand/20 active:scale-95 transition-all"
               >
                 Generar Reporte PDF
               </button>
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
                        <span className="px-2 py-1 rounded-full bg-brand/10 text-brand text-[10px] font-bold border border-brand/20 uppercase tracking-wide">Disponible</span>
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
      </motion.div>
    )}

    {viewMode === 'multi' && (
      <motion.div 
        key="multi"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="pb-20"
      >
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tighter text-white uppercase italic truncate glow-text mb-2">
              Multi-Radar Dashboard
            </h2>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-brand animate-pulse shadow-[0_0_8px_rgba(var(--theme-primary),0.6)]" />
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Comparativa de Rutas Prioritarias</p>
            </div>
          </div>

          <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800 gap-1">
            {[
              { id: 'detailed', icon: LayoutDashboard, label: 'Detalle' },
              { id: 'multi', icon: Grid, label: 'Multi' },
              { id: 'calendar', icon: CalendarDays, label: 'Mensual' }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  viewMode === mode.id 
                    ? 'bg-brand text-slate-900 shadow-[0_0_15px_rgba(var(--theme-primary),0.4)]' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <mode.icon className="w-3 h-3" />
                <span className="hidden sm:inline">{mode.label}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {QUICK_ROUTES.map((route) => {
            const routeData = data.find(d => 
              (d.route.startsWith(route.o) || (groupBUE && BUE_AIRPORTS.includes(route.o) && d.route.includes("BUENOS AIRES"))) && 
              (d.route.endsWith(route.d) || (groupBUE && BUE_AIRPORTS.includes(route.d) && d.route.includes("BUENOS AIRES")))
            );
            
            const availabilityCount = routeData?.availability.filter(a => a.count > 0).length || 0;
            const availabilityPerc = routeData ? (availabilityCount / routeData.availability.length) * 100 : 0;
            const minTax = routeData ? Math.min(...routeData.availability.filter(a => a.count > 0).map(a => a.tax)) : 0;

            return (
              <div 
                key={route.label} 
                className="glass-panel p-6 hover:border-brand/50 transition-all group cursor-pointer relative"
                onClick={() => {
                  handleQuickRoute(route.o, route.d);
                  setViewMode('detailed');
                }}
              >
                <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Plane className="w-16 h-16 -rotate-12" />
                </div>
                <div className="flex items-center justify-between mb-6 relative">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700 group-hover:bg-brand group-hover:text-slate-900 transition-colors">
                        <Plane className="w-5 h-5 transition-transform group-hover:scale-110" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase italic text-white group-hover:text-brand transition-colors">{route.o} — {route.d}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{getAirportLabel(route.o)} / {getAirportLabel(route.d)}</p>
                      </div>
                   </div>
                   <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                     availabilityPerc > 50 
                       ? 'bg-brand/10 text-brand border-brand/20' 
                       : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                   }`}>
                     {availabilityPerc > 50 ? 'Alta' : 'Baja'}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                   <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Disponibilidad</p>
                      <p className="text-2xl font-black text-white">{availabilityPerc.toFixed(1)}%</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tasa Mínima</p>
                      <p className="text-2xl font-black text-brand glow-text">
                        {minTax !== Infinity && minTax > 0 ? `$${minTax.toLocaleString()}` : 'N/A'}
                      </p>
                   </div>
                </div>

                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${availabilityPerc}%` }}
                     className={`h-full transition-all duration-1000 ${availabilityPerc > 50 ? 'bg-brand shadow-[0_0_10px_rgba(var(--theme-primary),0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]'}`}
                   />
                </div>
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Click para ver detalles</span>
                   <Zap className={`w-3.5 h-3.5 ${availabilityPerc > 70 ? 'text-brand animate-pulse glow-text' : 'text-slate-700'}`} />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    )}

    {viewMode === 'calendar' && (
      <motion.div 
        key="calendar"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="pb-20"
      >
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tighter text-white uppercase italic truncate glow-text">
                Calendario de Canjes
              </h2>
              <button 
                onClick={invertRoute}
                className="p-2 bg-slate-800/80 hover:bg-slate-700 rounded-xl text-brand hover:text-white transition-all border border-white/5 shadow-lg active:scale-95"
                title="Invertir Trayecto"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-brand animate-pulse shadow-[0_0_8px_rgba(var(--theme-primary),0.6)]" />
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Abril 2026 — {getAirportLabel(origin)} a {getAirportLabel(destination)}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={exportToPDF}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-brand text-[10px] font-black uppercase tracking-widest rounded-xl border border-brand/20 transition-all active:scale-95"
            >
              <Download className="w-3 h-3" />
              Exportar PDF
            </button>
            <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800 gap-1">
              {[
                { id: 'detailed', icon: LayoutDashboard, label: 'Detalle' },
                { id: 'multi', icon: Grid, label: 'Multi' },
                { id: 'calendar', icon: CalendarDays, label: 'Mensual' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id as any)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    viewMode === mode.id 
                      ? 'bg-brand text-slate-900 shadow-[0_0_15px_rgba(var(--theme-primary),0.4)]' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <mode.icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="glass-panel p-4 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.03]" 
            style={{ backgroundImage: `linear-gradient(90deg, ${themeColor} 1px, transparent 1px), linear-gradient(${themeColor} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} 
          />
          
          <div className="grid grid-cols-7 gap-px bg-slate-800/50 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative z-10">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
              <div key={day} className="bg-slate-900/90 p-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                {day}
              </div>
            ))}
            
            {(() => {
              const startDate = startOfMonth(new Date(2026, 3, 1));
              const endDate = endOfMonth(new Date(2026, 3, 30));
              const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
              const startDay = startDate.getDay();
              const placeholders = Array.from({ length: startDay });
              
              return (
                <>
                  {placeholders.map((_, i) => (
                    <div key={`empty-${i}`} className="bg-slate-900/30 min-h-[80px] md:min-h-[120px]" />
                  ))}
                  {calendarDays.map(date => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const dayData = aggregatedData?.availability.find(a => a.date === dateStr);
                    const hasFlights = dayData && dayData.count > 0;
                    const isTodayDate = isToday(date) || (date.getDate() === 22 && date.getMonth() === 3);
                    
                    return (
                      <div 
                        key={dateStr} 
                        className={`bg-slate-900/80 p-3 md:p-4 min-h-[80px] md:min-h-[120px] flex flex-col transition-all relative border border-white/[0.02] group overflow-hidden ${hasFlights ? 'hover:bg-brand/5 cursor-pointer' : 'opacity-30'}`}
                      >
                        {showSweeper && hasFlights && (
                          <div className="sonar-sweeper opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                        <span className={`text-[11px] font-black mb-1 relative z-10 ${isTodayDate ? 'text-brand glow-text' : 'text-slate-600'}`}>
                          {format(date, 'd')}
                        </span>
                        
                        {dayData && hasFlights && (
                          <div className="mt-auto relative z-10">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_6px_rgba(var(--theme-primary),0.8)]" />
                              <span className="text-[13px] font-black text-white">{dayData.count}</span>
                            </div>
                            <div className="text-[10px] font-black text-brand leading-none glow-text">
                              ${(dayData.tax / 1000).toFixed(1)}k
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      </motion.div>
    )}
    </AnimatePresence>
        </div>
        
        <footer className="text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest pb-10">
          JetSmart Analyzer Engine • V1.0.4 • Datos Certificados
        </footer>
      </main>
    </div>
    </div>
  );
}
