import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';

// ─── Typen ───────────────────────────────────────────────────────────────────

interface EnergyData {
  created: string;
  Datum: string;
  Wochentag: string;
  Kosten_Euro: string;
  Netzbezug_kWh: string;
  Netz_Einspeisung_kWh: string;
  PV_Ertrag_kWh: string;
  Akku_Geladen_kWh: string;
  Akku_Entladen_kWh: string;
  Auto_km_Tag: string;
  E_Auto_Ladung_kWh: string;
  Heizung_kWh: string;
  Heizung_Laufzeit_h: string;
  Entfeuchter_Laufzeit_h: string;
  Temp_Aussen: string;
  Bewoelkung_Proz: string;
  SOC_Akku1_Proz: string;
  SOC_Akku2_Proz: string;
  Auto_Kilometerstand: string;
  Auto_Reichweite_km: string;
  Roboter_Flaeche_m2: string;
  Luftfeuchte_Schlafzimmer_Proz: string;
  Temp_Wasserbett_Mama: string;
  Temp_Wasserbett_Papa: string;
  PV_Prognose_Heute_kWh: string;
  Speicher_Inhalt_SOC_kWh: string;
  Hausverbrauch_Berechnet_kWh: string;
  Buero_Kueche_kWh: string;
  Gaming_buero_kWh: string;
  Gefrierschrank_kWh: string;
  Geschirrspueler_kWh: string;
  Kuehlschrank_kWh: string;
  TV_WZ_kWh: string;
  Waschmaschine_kWh: string;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const num = (v: string | undefined) => {
  if (v === undefined || v === null || v === '') return 0;
  const cleaned = String(v).replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const fmt = (v: number, decimals = 1) => v.toFixed(decimals);
const eur = (v: number) => v.toFixed(2) + ' €';

const MONTHS_DE = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember'
];

// Nur letzten Eintrag pro Tag verwenden (Tagesendwert)
function getDailyFinal(rows: EnergyData[]): EnergyData[] {
  const map = new Map<string, EnergyData>();
  for (const row of rows) {
    map.set(row.Datum, row); // letzter Wert gewinnt
  }
  return Array.from(map.values());
}

// ─── Kleine Komponenten ───────────────────────────────────────────────────────

function StatCard({
  label, value, unit, icon, color, sub
}: {
  label: string; value: string; unit?: string;
  icon: string; color: string; sub?: string;
}) {
  return (
    <div className={`rounded-2xl p-5 border flex flex-col gap-2 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest opacity-60">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="flex items-end gap-1 mt-1">
        <span className="text-2xl font-black leading-none">{value}</span>
        {unit && <span className="text-sm font-bold opacity-60 mb-0.5">{unit}</span>}
      </div>
      {sub && <span className="text-xs opacity-50 font-medium">{sub}</span>}
    </div>
  );
}

function HighlightCard({
  icon, title, children, accent = false
}: {
  icon: string; title: string; children: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-5 border ${accent
      ? 'bg-emerald-950/40 border-emerald-700/30 text-emerald-100'
      : 'bg-slate-800/60 border-slate-700/50 text-slate-100'}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <span className="text-[11px] font-black uppercase tracking-widest opacity-60">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs font-black ${color}`}>{value}</span>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '12px',
  color: '#e2e8f0',
  fontSize: '11px',
  fontWeight: 700,
};

// ─── Haupt-Dashboard ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const [allData, setAllData] = useState<EnergyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/data');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result: EnergyData[] = await res.json();
        setAllData(result);
        setLastUpdated(new Date().toLocaleTimeString('de-AT'));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const { monthDays, latest, monthName, stats, chartData, applianceData } = useMemo(() => {
    if (!allData.length) return {
      monthDays: [], latest: null, monthName: '', stats: null,
      chartData: [], applianceData: []
    };

    const latest = allData[allData.length - 1];
    const [, month, year] = latest.Datum.split('.');
    const monthName = `${MONTHS_DE[parseInt(month) - 1]} ${year}`;

    const monthRows = allData.filter(r => {
      const [, m, y] = r.Datum.split('.');
      return m === month && y === year;
    });

    const days = getDailyFinal(monthRows);

    const totalPV        = days.reduce((s, r) => s + num(r.PV_Ertrag_kWh), 0);
    const totalGrid      = days.reduce((s, r) => s + num(r.Netzbezug_kWh), 0);
    const totalFeed      = days.reduce((s, r) => s + num(r.Netz_Einspeisung_kWh), 0);
    const totalCharge    = days.reduce((s, r) => s + num(r.Akku_Geladen_kWh), 0);
    const totalDischarge = days.reduce((s, r) => s + num(r.Akku_Entladen_kWh), 0);
    const totalHeat      = days.reduce((s, r) => s + num(r.Heizung_kWh), 0);
    const totalCar       = days.reduce((s, r) => s + num(r.E_Auto_Ladung_kWh), 0);
    const totalKm        = days.reduce((s, r) => s + num(r.Auto_km_Tag), 0);
    const totalKosten    = days.reduce((s, r) => s + num(r.Kosten_Euro), 0);

    const totalSelf = totalPV + totalDischarge;
    const totalAll  = totalSelf + totalGrid;
    const autarky   = totalAll > 0 ? (totalSelf / totalAll) * 100 : 0;

    const feedRevenue = totalFeed * 0.08;
    const pvSavings   = (totalPV - totalFeed) * 0.28;
    const netBalance  = pvSavings + feedRevenue - totalKosten;

    const stats = {
      totalPV, totalGrid, totalFeed, totalCharge, totalDischarge,
      totalHeat, totalCar, totalKm, totalKosten,
      autarky, feedRevenue, pvSavings, netBalance,
      daysCount: days.length,
    };

    const chartData = days.map(r => ({
      tag: r.Datum.substring(0, 5),
      PV: num(r.PV_Ertrag_kWh),
      Netz: num(r.Netzbezug_kWh),
      Kosten: num(r.Kosten_Euro),
      Akku: num(r.Speicher_Inhalt_SOC_kWh),
    }));

    const appSum = (key: keyof EnergyData) =>
      days.reduce((s, r) => s + num(r[key] as string), 0);

    const applianceData = [
      { name: 'Heizung',        value: appSum('Heizung_kWh'),         color: '#f97316' },
      { name: 'E-Auto',         value: appSum('E_Auto_Ladung_kWh'),   color: '#3b82f6' },
      { name: 'Büro/Küche',     value: appSum('Buero_Kueche_kWh'),    color: '#8b5cf6' },
      { name: 'Gaming-PC',      value: appSum('Gaming_buero_kWh'),    color: '#ec4899' },
      { name: 'Kühlschrank',    value: appSum('Kuehlschrank_kWh'),    color: '#06b6d4' },
      { name: 'Gefrierschrank', value: appSum('Gefrierschrank_kWh'),  color: '#14b8a6' },
      { name: 'Geschirrspüler', value: appSum('Geschirrspueler_kWh'), color: '#a3e635' },
      { name: 'Waschmaschine',  value: appSum('Waschmaschine_kWh'),   color: '#fbbf24' },
      { name: 'TV / Wohnzimmer',value: appSum('TV_WZ_kWh'),           color: '#f43f5e' },
    ].filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    return { monthDays: days, latest, monthName, stats, chartData, applianceData };
  }, [allData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-emerald-400 font-mono text-xs uppercase tracking-widest">Lade Energiedaten…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-red-400 text-center">
          <div className="text-4xl mb-4">⚡</div>
          <p className="font-bold">Fehler beim Laden der Daten</p>
          <p className="text-sm opacity-60 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats || !latest) return null;

  const accu1 = num(latest.SOC_Akku1_Proz);
  const accu2 = num(latest.SOC_Akku2_Proz);
  const accuContent = num(latest.Speicher_Inhalt_SOC_kWh);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-lg shadow-lg shadow-emerald-500/20">
              ⚡
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-tight leading-none">Energie Dashboard</h1>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-0.5">Smart Home · Tirol</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-lg">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Live · {lastUpdated}</span>
            </div>
            <div className="px-3 py-1.5 bg-emerald-900/40 border border-emerald-700/30 rounded-lg">
              <span className="text-[11px] font-black text-emerald-400">{monthName}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-8 space-y-8">

        {/* KPI Kacheln */}
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
            Monatsübersicht · {stats.daysCount} Tage erfasst
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Stromkosten"
              value={fmt(stats.totalKosten, 2)}
              unit="€"
              icon="🧾"
              color="bg-rose-950/50 border-rose-800/30 text-rose-100"
              sub={`∅ ${fmt(stats.totalKosten / stats.daysCount, 2)} €/Tag`}
            />
            <StatCard
              label="PV Ertrag"
              value={fmt(stats.totalPV)}
              unit="kWh"
              icon="☀️"
              color="bg-amber-950/50 border-amber-800/30 text-amber-100"
              sub={`∅ ${fmt(stats.totalPV / stats.daysCount)} kWh/Tag`}
            />
            <StatCard
              label="Autarkiegrad"
              value={fmt(stats.autarky, 0)}
              unit="%"
              icon="🏡"
              color={stats.autarky >= 50
                ? 'bg-emerald-950/50 border-emerald-800/30 text-emerald-100'
                : 'bg-slate-800/60 border-slate-700/50 text-slate-100'}
              sub={`Netzbezug ${fmt(stats.totalGrid)} kWh`}
            />
            <StatCard
              label="PV-Ersparnis"
              value={fmt(stats.pvSavings, 2)}
              unit="€"
              icon="💰"
              color="bg-green-950/50 border-green-800/30 text-green-100"
              sub={`+ ${fmt(stats.feedRevenue, 2)} € Einspeisung`}
            />
          </div>
        </section>

        {/* Highlights */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <HighlightCard icon="⚡" title="Energie-Bilanz" accent={stats.netBalance >= 0}>
            <div className="divide-y divide-white/5">
              <Pill label="PV Ertrag" value={`${fmt(stats.totalPV)} kWh`} color="text-amber-400" />
              <Pill label="Netzbezug" value={`${fmt(stats.totalGrid)} kWh`} color="text-rose-400" />
              <Pill label="Einspeisung" value={`${fmt(stats.totalFeed)} kWh`} color="text-sky-400" />
              <Pill label="Akku geladen" value={`${fmt(stats.totalCharge)} kWh`} color="text-violet-400" />
              <Pill label="Akku entladen" value={`${fmt(stats.totalDischarge)} kWh`} color="text-violet-300" />
            </div>
            <div className={`mt-4 p-3 rounded-xl text-center ${stats.netBalance >= 0
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-rose-500/10 text-rose-400'}`}>
              <div className="text-[10px] uppercase font-black tracking-widest opacity-60">Netto-Bilanz</div>
              <div className="text-xl font-black mt-0.5">
                {stats.netBalance >= 0 ? '+' : ''}{eur(stats.netBalance)}
              </div>
            </div>
          </HighlightCard>

          <HighlightCard icon="📡" title="Aktueller Stand">
            <div className="space-y-3 mb-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Akku 1</span>
                  <span className="font-black text-violet-400">{accu1}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full" style={{ width: `${accu1}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Akku 2</span>
                  <span className="font-black text-violet-400">{accu2}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-400 rounded-full" style={{ width: `${accu2}%` }} />
                </div>
              </div>
              <div className="text-center pt-1">
                <div className="text-[10px] uppercase text-slate-500 font-bold">Speicher-Inhalt</div>
                <div className="text-2xl font-black text-violet-300">{fmt(accuContent)} <span className="text-sm">kWh</span></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-700/40 rounded-xl p-3 text-center">
                <div className="text-[9px] uppercase font-black text-slate-500">Außen</div>
                <div className="text-lg font-black text-sky-400">{fmt(num(latest.Temp_Aussen))}°</div>
                <div className="text-[9px] text-slate-500">☁️ {latest.Bewoelkung_Proz}%</div>
              </div>
              <div className="bg-slate-700/40 rounded-xl p-3 text-center">
                <div className="text-[9px] uppercase font-black text-slate-500">PV Prognose</div>
                <div className="text-lg font-black text-amber-400">{fmt(num(latest.PV_Prognose_Heute_kWh))} <span className="text-xs">kWh</span></div>
                <div className="text-[9px] text-slate-500">heute</div>
              </div>
            </div>
          </HighlightCard>

          <HighlightCard icon="🚗" title="Renault 4 E-Tech">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Reichweite</span>
                <span className="text-2xl font-black text-blue-400">{latest.Auto_Reichweite_km} <span className="text-sm">km</span></span>
              </div>
              <div className="divide-y divide-white/5">
                <Pill label="Geladene Energie (Monat)" value={`${fmt(stats.totalCar)} kWh`} color="text-blue-400" />
                <Pill label="Gefahrene km (Monat)" value={`${fmt(stats.totalKm, 0)} km`} color="text-blue-300" />
                <Pill label="Kilometerstand" value={`${parseInt(latest.Auto_Kilometerstand).toLocaleString('de-AT')} km`} color="text-slate-300" />
              </div>
            </div>
          </HighlightCard>
        </section>

        {/* Charts */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">PV Ertrag vs. Netzbezug</h3>
              <div className="flex gap-3">
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> PV
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Netz
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit=" kWh" width={50} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="PV" name="PV Ertrag" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="Netz" name="Netzbezug" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-5">Speicher-Inhalt (kWh)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="akkuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit=" kWh" width={50} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: '#8b5cf6', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="Akku" name="Speicher-Inhalt" stroke="#8b5cf6" strokeWidth={2} fill="url(#akkuGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Geräte + Highlights */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-5">Verbrauch nach Gerät</h3>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={applianceData} innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                      {applianceData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${fmt(v)} kWh`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {applianceData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-slate-400">{d.name}</span>
                    </div>
                    <span className="text-xs font-black" style={{ color: d.color }}>{fmt(d.value)} kWh</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <HighlightCard icon="🌡️" title="Heizung & Wärme">
              <div className="divide-y divide-white/5">
                <Pill label="Heizungsverbrauch (Monat)" value={`${fmt(stats.totalHeat)} kWh`} color="text-orange-400" />
                <Pill label="Laufzeit letzte Aufzeichnung" value={`${fmt(num(latest.Heizung_Laufzeit_h))} h`} color="text-orange-300" />
                <Pill label="Entfeuchter Laufzeit" value={`${fmt(num(latest.Entfeuchter_Laufzeit_h))} h`} color="text-sky-400" />
                <Pill label="Luftfeuchte Schlafzimmer" value={`${latest.Luftfeuchte_Schlafzimmer_Proz} %`} color="text-sky-300" />
              </div>
            </HighlightCard>

            <HighlightCard icon="🛏️" title="Komfort & Roboter">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-700/40 rounded-xl p-3 text-center">
                  <div className="text-[9px] text-slate-500 font-bold uppercase">Wasserbett Papa</div>
                  <div className="text-xl font-black text-pink-400 mt-1">{fmt(num(latest.Temp_Wasserbett_Papa))}°</div>
                </div>
                <div className="bg-slate-700/40 rounded-xl p-3 text-center">
                  <div className="text-[9px] text-slate-500 font-bold uppercase">Wasserbett Mama</div>
                  <div className="text-xl font-black text-pink-300 mt-1">{fmt(num(latest.Temp_Wasserbett_Mama))}°</div>
                </div>
              </div>
              <div className="mt-3">
                <Pill label="Roboter Fläche (heute)" value={`${fmt(num(latest.Roboter_Flaeche_m2), 0)} m²`} color="text-teal-400" />
              </div>
            </HighlightCard>
          </div>
        </section>

        {/* Tageskosten */}
        <section>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tageskosten (€)</h3>
              <div className="text-sm font-black text-rose-400">Gesamt: {eur(stats.totalKosten)}</div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="kostenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit=" €" width={40} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: '#f43f5e', strokeWidth: 1 }} formatter={(v: number) => [`${fmt(v, 2)} €`, 'Kosten']} />
                <Area type="monotone" dataKey="Kosten" name="Kosten" stroke="#f43f5e" strokeWidth={2} fill="url(#kostenGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

      </main>

      <footer className="max-w-7xl mx-auto px-5 py-6 text-center">
        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
          Haus Tirol · Smart Home Energy Dashboard · Daten via HomeAssistant
        </p>
      </footer>
    </div>
  );
}
