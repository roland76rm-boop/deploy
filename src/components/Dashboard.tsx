import React, { useEffect, useState, useMemo, useCallback, createContext, useContext } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

// ─── Theme System ─────────────────────────────────────────────────────────────

interface ThemeCtxType {
  dark: boolean;
  toggle: () => void;
  /** Pick dark vs. light class string */
  t: (d: string, l: string) => string;
  /** Recharts tooltip style */
  ts: React.CSSProperties;
  /** Chart grid color */
  gc: string;
  /** Chart axis tick color */
  ac: string;
  /** Colored stat card classes by variant */
  cc: (v: 'rose'|'amber'|'emerald'|'green'|'blue'|'sky'|'indigo'|'teal'|'slate'|'violet'|'purple') => string;
}

const ThemeCtx = createContext<ThemeCtxType>({
  dark: false, toggle: () => {},
  t: (_, l) => l,
  ts: {}, gc: '#e2e8f0', ac: '#94a3b8',
  cc: () => '',
});

const useTheme = () => useContext(ThemeCtx);

function buildTheme(dark: boolean, toggle: () => void): ThemeCtxType {
  const t = (d: string, l: string) => dark ? d : l;

  const ts: React.CSSProperties = {
    backgroundColor: dark ? '#1e293b' : '#ffffff',
    border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
    borderRadius: '12px',
    color: dark ? '#e2e8f0' : '#0f172a',
    fontSize: '11px', fontWeight: 700,
  };

  const darkCards: Record<string, string> = {
    rose:   'bg-rose-950/50 border-rose-800/30 text-rose-100',
    amber:  'bg-amber-950/50 border-amber-800/30 text-amber-100',
    emerald:'bg-emerald-950/50 border-emerald-800/30 text-emerald-100',
    green:  'bg-green-950/50 border-green-800/30 text-green-100',
    blue:   'bg-blue-950/50 border-blue-800/30 text-blue-100',
    sky:    'bg-sky-950/50 border-sky-800/30 text-sky-100',
    indigo: 'bg-indigo-950/50 border-indigo-800/30 text-indigo-100',
    teal:   'bg-teal-950/50 border-teal-800/30 text-teal-100',
    slate:  'bg-slate-800/60 border-slate-700/50 text-slate-100',
    violet: 'bg-violet-950/50 border-violet-800/30 text-violet-100',
    purple: 'bg-purple-950/50 border-purple-800/30 text-purple-100',
  };
  const lightCards: Record<string, string> = {
    rose:   'bg-rose-50 border-rose-200 text-rose-800',
    amber:  'bg-amber-50 border-amber-200 text-amber-800',
    emerald:'bg-emerald-50 border-emerald-200 text-emerald-800',
    green:  'bg-green-50 border-green-200 text-green-800',
    blue:   'bg-blue-50 border-blue-200 text-blue-800',
    sky:    'bg-sky-50 border-sky-200 text-sky-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    teal:   'bg-teal-50 border-teal-200 text-teal-800',
    slate:  'bg-gray-100 border-gray-200 text-gray-700',
    violet: 'bg-violet-50 border-violet-200 text-violet-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
  };

  return {
    dark, toggle, t, ts,
    gc: dark ? '#1e293b' : '#e2e8f0',
    ac: dark ? '#64748b' : '#94a3b8',
    cc: (v) => (dark ? darkCards[v] : lightCards[v]) ?? '',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnergyData {
  created: string; Datum: string; Wochentag: string;
  Kosten_Euro: string; Netzbezug_kWh: string; Netz_Einspeisung_kWh: string;
  PV_Ertrag_kWh: string; Akku_Geladen_kWh: string; Akku_Entladen_kWh: string;
  Auto_km_Tag: string; E_Auto_Ladung_kWh: string; Heizung_kWh: string;
  Heizung_Laufzeit_h: string; Entfeuchter_Laufzeit_h: string; Temp_Aussen: string;
  Bewoelkung_Proz: string; SOC_Akku1_Proz: string; SOC_Akku2_Proz: string;
  Auto_Kilometerstand: string; Auto_Reichweite_km: string; Roboter_Flaeche_m2: string;
  Luftfeuchte_Schlafzimmer_Proz: string; Temp_Wasserbett_Mama: string;
  Temp_Wasserbett_Papa: string; PV_Prognose_Heute_kWh: string;
  Speicher_Inhalt_SOC_kWh: string; Hausverbrauch_Berechnet_kWh: string;
  Buero_Kueche_kWh: string; Gaming_buero_kWh: string; Gefrierschrank_kWh: string;
  Geschirrspueler_kWh: string; Kuehlschrank_kWh: string; TV_WZ_kWh: string;
  Waschmaschine_kWh: string;
  E_Auto_PV_kWh: string; E_Auto_Netz_kWh: string; E_Auto_Akku_kWh: string;
}

type TabId = 'uebersicht' | 'energie' | 'auto' | 'temperaturen' | 'tagesansicht' | 'monatsvergleich';

interface LightboxData { title: string; day: EnergyData; monthAvg: Record<string, number>; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const num = (v: string | undefined): number => {
  if (v == null || v === '') return 0;
  const p = parseFloat(String(v).replace(',', '.'));
  return isNaN(p) ? 0 : p;
};
const fmt  = (v: number, d = 1) => v.toFixed(d);
const eur  = (v: number) => v.toFixed(2) + ' €';
const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

function getDailyFinal(rows: EnergyData[]): EnergyData[] {
  const map = new Map<string, EnergyData>();
  for (const row of rows) map.set(row.Datum, row);
  return Array.from(map.values()).sort((a, b) => {
    const ms = (r: EnergyData) => { const [d,m,y] = r.Datum.split('.').map(Number); return new Date(y,m-1,d).getTime(); };
    return ms(a) - ms(b);
  });
}

/** Max-Speicher-SOC pro Tag aus allen Stundenwerten (nicht nur Tagesendwert) */
function getDailyMaxSOC(rows: EnergyData[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const soc = num(row.Speicher_Inhalt_SOC_kWh);
    map.set(row.Datum, Math.max(map.get(row.Datum) ?? 0, soc));
  }
  return map;
}
/** Hilfsfunktion: Ist eine Uhrzeit (HH:MM) tagsüber? Tag = 07:00–22:00 */
function isTagzeit(created: string): boolean {
  const time = String(created ?? '').substring(11, 16);
  if (!time || time.length < 5) return true;
  const [h, min] = time.split(':').map(Number);
  const minutes = h * 60 + (min || 0);
  return minutes >= 7 * 60 && minutes < 22 * 60;
}
/** Max-Außentemperatur pro Tag (Tageszeit 07–22 Uhr) aus allen Stundenwerten */
function getDailyMaxTempTag(rows: EnergyData[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!isTagzeit(row.created)) continue;
    const t = num(row.Temp_Aussen);
    if (t === 0 && row.Temp_Aussen === '') continue;
    const cur = map.get(row.Datum);
    if (cur === undefined || t > cur) map.set(row.Datum, t);
  }
  return map;
}
/** Min-Außentemperatur pro Tag (Tageszeit 07–22 Uhr) */
function getDailyMinTempTag(rows: EnergyData[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!isTagzeit(row.created)) continue;
    const t = num(row.Temp_Aussen);
    if (t === 0 && row.Temp_Aussen === '') continue;
    const cur = map.get(row.Datum);
    if (cur === undefined || t < cur) map.set(row.Datum, t);
  }
  return map;
}
/** Max-Außentemperatur pro Tag (Nacht: 22–07 Uhr) */
function getDailyMaxTempNacht(rows: EnergyData[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (isTagzeit(row.created)) continue;
    const t = num(row.Temp_Aussen);
    if (t === 0 && row.Temp_Aussen === '') continue;
    const cur = map.get(row.Datum);
    if (cur === undefined || t > cur) map.set(row.Datum, t);
  }
  return map;
}
/** Min-Außentemperatur pro Tag (Nacht: 22–07 Uhr) */
function getDailyMinTempNacht(rows: EnergyData[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (isTagzeit(row.created)) continue;
    const t = num(row.Temp_Aussen);
    if (t === 0 && row.Temp_Aussen === '') continue;
    const cur = map.get(row.Datum);
    if (cur === undefined || t < cur) map.set(row.Datum, t);
  }
  return map;
}
/** Max-Außentemperatur pro Tag (alle Stunden) */
function getDailyMaxTemp(rows: EnergyData[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const t = num(row.Temp_Aussen);
    if (t === 0 && row.Temp_Aussen === '') continue;
    const cur = map.get(row.Datum);
    if (cur === undefined || t > cur) map.set(row.Datum, t);
  }
  return map;
}
/** Min-Außentemperatur pro Tag (alle Stunden) */
function getDailyMinTemp(rows: EnergyData[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const t = num(row.Temp_Aussen);
    if (t === 0 && row.Temp_Aussen === '') continue;
    const cur = map.get(row.Datum);
    if (cur === undefined || t < cur) map.set(row.Datum, t);
  }
  return map;
}

function getMonthStats(days: EnergyData[]) {
  const n = Math.max(days.length, 1);
  const sum = (k: keyof EnergyData) => days.reduce((s, r) => s + num(r[k] as string), 0);
  const totalPV = sum('PV_Ertrag_kWh'), totalGrid = sum('Netzbezug_kWh'), totalFeed = sum('Netz_Einspeisung_kWh');
  const totalCharge = sum('Akku_Geladen_kWh'), totalDischarge = sum('Akku_Entladen_kWh');
  const totalHeat = sum('Heizung_kWh'), totalCar = sum('E_Auto_Ladung_kWh'), totalKosten = sum('Kosten_Euro');
  const totalCarPV = sum('E_Auto_PV_kWh'), totalCarNetz = sum('E_Auto_Netz_kWh'), totalCarAkku = sum('E_Auto_Akku_kWh');
  const firstKm = num(days[0]?.Auto_Kilometerstand), lastKm = num(days[days.length-1]?.Auto_Kilometerstand);
  const totalKm = Math.max(0, lastKm - firstKm);
  const totalSelf = totalPV + totalDischarge, totalAll = totalSelf + totalGrid;
  const autarky = totalAll > 0 ? (totalSelf / totalAll) * 100 : 0;
  const feedRevenue = totalFeed * 0.08, pvSavings = (totalPV - totalFeed) * 0.28;
  return { totalPV, totalGrid, totalFeed, totalCharge, totalDischarge, totalHeat, totalCar, totalCarPV, totalCarNetz, totalCarAkku, totalKm, totalKosten,
    autarky, feedRevenue, pvSavings, netBalance: pvSavings + feedRevenue - totalKosten, daysCount: n };
}

function generateInsights(stats: ReturnType<typeof getMonthStats>, days: EnergyData[]): string[] {
  if (!days.length) return ['Noch keine Daten für diesen Monat vorhanden.'];
  const n = days.length; const insights: string[] = [];
  if (stats.autarky >= 70) insights.push(`☀️ Ausgezeichnete Autarkie von ${fmt(stats.autarky,0)}% – das Haus versorgt sich fast selbst.`);
  else if (stats.autarky >= 50) insights.push(`✅ Gute Autarkie von ${fmt(stats.autarky,0)}% – mehr als die Hälfte aus eigener Energie.`);
  else insights.push(`⚠️ Autarkie bei ${fmt(stats.autarky,0)}% – der Netzbezug dominiert noch.`);
  const bestPV = days.reduce((b,r) => num(r.PV_Ertrag_kWh) > num(b.PV_Ertrag_kWh) ? r : b, days[0]);
  insights.push(`🏆 Bester PV-Tag: ${bestPV.Datum} mit ${fmt(num(bestPV.PV_Ertrag_kWh))} kWh – ${bestPV.Wochentag}.`);
  if (stats.netBalance >= 0) insights.push(`💰 Netto-Bilanz positiv: +${eur(stats.netBalance)} – PV-Einnahmen übersteigen Netzkosten.`);
  else insights.push(`📉 Netto-Bilanz: ${eur(stats.netBalance)} – Netzkosten (${eur(stats.totalKosten)}) übersteigen PV-Einnahmen.`);
  const avgHeat = stats.totalHeat / n;
  if (avgHeat > 12) insights.push(`🔥 Hoher Heizungsverbrauch: ∅ ${fmt(avgHeat)} kWh/Tag – kalte Jahreszeit.`);
  else if (avgHeat < 2 && avgHeat > 0) insights.push(`🌿 Niedriger Heizungsverbrauch: ∅ ${fmt(avgHeat)} kWh/Tag.`);
  if (stats.totalKm > 0) insights.push(`🚗 E-Auto: ${fmt(stats.totalKm,0)} km gefahren, ${fmt(stats.totalCar)} kWh geladen${stats.totalKm>0 ? `, ∅ ${fmt(stats.totalCar/stats.totalKm*100,1)} kWh/100km` : ''}.`);
  const avgCost = stats.totalKosten / n;
  const highDay = days.find(r => num(r.Kosten_Euro) > avgCost * 2.5);
  if (highDay) insights.push(`❗ Kostenspitze am ${highDay.Datum}: ${eur(num(highDay.Kosten_Euro))} (∅ ${eur(avgCost)}/Tag).`);
  return insights.slice(0, 5);
}

// ─── Small UI Components ──────────────────────────────────────────────────────

function StatCard({ label, value, unit, icon, color, sub }: {
  label: string; value: string; unit?: string; icon: string; color: string; sub?: string;
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

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  const { t } = useTheme();
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className={`text-xs ${t('text-slate-400','text-gray-500')}`}>{label}</span>
      <span className={`text-xs font-black ${color}`}>{value}</span>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { t } = useTheme();
  return (
    <div className={`${t('bg-slate-900/60 border-slate-800','bg-white border-gray-200')} border rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  return <h3 className={`text-[11px] font-black uppercase tracking-widest mb-4 ${t('text-slate-400','text-gray-400')}`}>{children}</h3>;
}

function HighlightStrip({ items }: {
  items: { icon: string; label: string; value: string; sub?: string }[];
}) {
  const { t } = useTheme();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((h, i) => (
        <div key={i} className={`${t('bg-slate-800/50 border-slate-700/40','bg-gray-100 border-gray-200')} border rounded-xl p-3`}>
          <div className="text-base mb-1">{h.icon}</div>
          <div className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${t('text-slate-500','text-gray-400')}`}>{h.label}</div>
          <div className={`text-sm font-black leading-tight ${t('text-white','text-gray-900')}`}>{h.value}</div>
          {h.sub && <div className={`text-[9px] mt-0.5 ${t('text-slate-500','text-gray-400')}`}>{h.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function TabButton({ id, label, icon, active, onClick }: {
  id: TabId; label: string; icon: string; active: boolean; onClick: (id: TabId) => void;
}) {
  const { t } = useTheme();
  return (
    <button onClick={() => onClick(id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all whitespace-nowrap ${
      active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
             : t('text-slate-400 hover:text-white hover:bg-slate-800','text-gray-500 hover:text-gray-900 hover:bg-gray-100')
    }`}>
      <span>{icon}</span><span>{label}</span>
    </button>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

const LIGHTBOX_ROWS: { label: string; key: keyof EnergyData; unit: string; color: string }[] = [
  { label: 'PV Ertrag',      key: 'PV_Ertrag_kWh',            unit: 'kWh', color: 'text-amber-500' },
  { label: 'Netzbezug',      key: 'Netzbezug_kWh',            unit: 'kWh', color: 'text-rose-500' },
  { label: 'Einspeisung',    key: 'Netz_Einspeisung_kWh',     unit: 'kWh', color: 'text-sky-500' },
  { label: 'Akku geladen',   key: 'Akku_Geladen_kWh',         unit: 'kWh', color: 'text-violet-500' },
  { label: 'Akku entladen',  key: 'Akku_Entladen_kWh',        unit: 'kWh', color: 'text-violet-400' },
  { label: 'Stromkosten',    key: 'Kosten_Euro',              unit: '€',   color: 'text-red-500' },
  { label: 'Hausverbrauch',  key: 'Hausverbrauch_Berechnet_kWh', unit: 'kWh', color: 'text-gray-500' },
  { label: 'Heizung',        key: 'Heizung_kWh',              unit: 'kWh', color: 'text-orange-500' },
  { label: 'E-Auto Ladung',  key: 'E_Auto_Ladung_kWh',        unit: 'kWh', color: 'text-blue-500' },
  { label: 'Außentemperatur',key: 'Temp_Aussen',              unit: '°C',  color: 'text-cyan-500' },
  { label: 'Bewölkung',      key: 'Bewoelkung_Proz',          unit: '%',   color: 'text-slate-400' },
  { label: 'PV Prognose',    key: 'PV_Prognose_Heute_kWh',    unit: 'kWh', color: 'text-amber-400' },
  { label: 'Speicher SOC',   key: 'Speicher_Inhalt_SOC_kWh',  unit: 'kWh', color: 'text-purple-500' },
  { label: 'Büro / Küche',   key: 'Buero_Kueche_kWh',         unit: 'kWh', color: 'text-purple-400' },
  { label: 'Gaming-PC',      key: 'Gaming_buero_kWh',         unit: 'kWh', color: 'text-pink-500' },
  { label: 'Waschmaschine',  key: 'Waschmaschine_kWh',        unit: 'kWh', color: 'text-yellow-500' },
];

function Lightbox({ data, onClose }: { data: LightboxData; onClose: () => void }) {
  const { t } = useTheme();
  const { day, monthAvg } = data;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`${t('bg-slate-900 border-slate-700','bg-white border-gray-200')} border rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className={`text-lg font-black ${t('text-white','text-gray-900')}`}>{data.title}</h2>
            <p className={`text-[10px] uppercase font-bold tracking-widest ${t('text-slate-400','text-gray-400')}`}>{day.Wochentag}</p>
          </div>
          <button onClick={onClose} className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${t('bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700','bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800')}`}>✕</button>
        </div>
        <div className="space-y-0.5">
          {LIGHTBOX_ROWS.map(({ label, key, unit, color }) => {
            const val = num(day[key] as string);
            const avg = monthAvg[key] ?? 0;
            const diff = avg > 0.01 ? ((val - avg) / avg) * 100 : 0;
            return (
              <div key={key} className={`flex items-center justify-between py-2 border-b ${t('border-slate-800/60','border-gray-100')}`}>
                <span className={`text-xs ${t('text-slate-400','text-gray-500')}`}>{label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black ${color}`}>{fmt(val, unit === '€' ? 2 : 1)} {unit}</span>
                  {Math.abs(diff) > 15 && avg > 0.01 && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${diff > 0
                      ? t('bg-rose-900/50 text-rose-400','bg-rose-100 text-rose-600')
                      : t('bg-emerald-900/50 text-emerald-400','bg-emerald-100 text-emerald-600')}`}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className={`text-[9px] mt-4 text-center ${t('text-slate-600','text-gray-300')}`}>% = Abweichung vom Monatsdurchschnitt · ESC oder Klick außen schließt</p>
      </div>
    </div>
  );
}

// ─── Energie Tab ──────────────────────────────────────────────────────────────

function EnergieTab({ stats, days, monthRows, onDayClick }: {
  stats: ReturnType<typeof getMonthStats>; days: EnergyData[]; monthRows: EnergyData[]; onDayClick: (d: EnergyData) => void;
  prevDayKm?: number;
}) {
  const { t, ts, gc, ac, cc } = useTheme();
  if (!days.length) return <Card><p className={`text-center py-8 ${t('text-slate-500','text-gray-400')}`}>Keine Daten.</p></Card>;

  const dailyMaxSOC = useMemo(() => getDailyMaxSOC(monthRows), [monthRows]);

  const bestPV   = days.reduce((b,r) => num(r.PV_Ertrag_kWh) > num(b.PV_Ertrag_kWh) ? r : b, days[0]);
  const mostGrid = days.reduce((b,r) => num(r.Netzbezug_kWh) > num(b.Netzbezug_kWh) ? r : b, days[0]);
  const lowestCost = days.reduce((b,r) => num(r.Kosten_Euro) < num(b.Kosten_Euro) ? r : b, days[0]);
  const highFeed = days.reduce((b,r) => num(r.Netz_Einspeisung_kWh) > num(b.Netz_Einspeisung_kWh) ? r : b, days[0]);

  const chartData = days.map(r => ({ tag: r.Datum.substring(0,5), PV: num(r.PV_Ertrag_kWh), Netz: num(r.Netzbezug_kWh),
    Einspeisung: num(r.Netz_Einspeisung_kWh), Kosten: num(r.Kosten_Euro),
    Akku: dailyMaxSOC.get(r.Datum) ?? num(r.Speicher_Inhalt_SOC_kWh), _row: r }));

  const appData = [
    { name: 'Heizung',        value: days.reduce((s,r)=>s+num(r.Heizung_kWh),0),         color: '#f97316' },
    { name: 'E-Auto',         value: days.reduce((s,r)=>s+num(r.E_Auto_Ladung_kWh),0),   color: '#3b82f6' },
    { name: 'Büro/Küche',     value: days.reduce((s,r)=>s+num(r.Buero_Kueche_kWh),0),    color: '#8b5cf6' },
    { name: 'Gaming-PC',      value: days.reduce((s,r)=>s+num(r.Gaming_buero_kWh),0),    color: '#ec4899' },
    { name: 'Kühlschrank',    value: days.reduce((s,r)=>s+num(r.Kuehlschrank_kWh),0),    color: '#06b6d4' },
    { name: 'Gefrierschrank', value: days.reduce((s,r)=>s+num(r.Gefrierschrank_kWh),0),  color: '#14b8a6' },
    { name: 'Geschirrspüler', value: days.reduce((s,r)=>s+num(r.Geschirrspueler_kWh),0), color: '#a3e635' },
    { name: 'Waschmaschine',  value: days.reduce((s,r)=>s+num(r.Waschmaschine_kWh),0),   color: '#fbbf24' },
    { name: 'TV / WZ',        value: days.reduce((s,r)=>s+num(r.TV_WZ_kWh),0),           color: '#f43f5e' },
  ].filter(d => d.value > 0).sort((a,b) => b.value - a.value);

  const click = (d: any) => { const r = d?.activePayload?.[0]?.payload?._row; if(r) onDayClick(r); };
  const axTick = { fontSize: 9, fill: ac, fontWeight: 700 };

  return (
    <div className="space-y-6">
      <HighlightStrip items={[
        { icon:'☀️', label:'Bester PV-Tag',    value:`${fmt(num(bestPV.PV_Ertrag_kWh))} kWh`,        sub: bestPV.Datum },
        { icon:'🔌', label:'Meist Netzbezug',  value:`${fmt(num(mostGrid.Netzbezug_kWh))} kWh`,      sub: mostGrid.Datum },
        { icon:'💸', label:'Günstigster Tag',  value: eur(num(lowestCost.Kosten_Euro)),               sub: lowestCost.Datum },
        { icon:'⬆️', label:'Meist Eingespeist',value:`${fmt(num(highFeed.Netz_Einspeisung_kWh))} kWh`,sub: highFeed.Datum },
      ]} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="PV Ertrag"    value={fmt(stats.totalPV)}       unit="kWh" icon="☀️" color={cc('amber')}   sub={`∅ ${fmt(stats.totalPV/stats.daysCount)} kWh/Tag`} />
        <StatCard label="Netzbezug"    value={fmt(stats.totalGrid)}     unit="kWh" icon="🔌" color={cc('rose')}    sub={`∅ ${fmt(stats.totalGrid/stats.daysCount)} kWh/Tag`} />
        <StatCard label="Einspeisung"  value={fmt(stats.totalFeed)}     unit="kWh" icon="⬆️" color={cc('sky')}     sub={`${eur(stats.feedRevenue)} Erlös`} />
        <StatCard label="Autarkiegrad" value={fmt(stats.autarky,0)}     unit="%"   icon="🏡" color={cc(stats.autarky>=50?'emerald':'slate')} sub={`Netto ${stats.netBalance>=0?'+':''}${eur(stats.netBalance)}`} />
      </div>
      <Card>
        <SectionHeader>PV · Netzbezug · Einspeisung — Balken anklicken für Tagesdetails</SectionHeader>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={2} onClick={click} style={{cursor:'pointer'}}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
            <XAxis dataKey="tag" tick={axTick} axisLine={false} tickLine={false} />
            <YAxis tick={axTick} axisLine={false} tickLine={false} unit=" kWh" width={50} />
            <Tooltip contentStyle={ts} cursor={{fill:'#00000008'}} />
            <Bar dataKey="PV"         name="PV Ertrag"   fill="#f59e0b" radius={[4,4,0,0]} maxBarSize={16} />
            <Bar dataKey="Netz"       name="Netzbezug"   fill="#f43f5e" radius={[4,4,0,0]} maxBarSize={16} />
            <Bar dataKey="Einspeisung"name="Einspeisung" fill="#38bdf8" radius={[4,4,0,0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeader>Speicher-Inhalt (kWh)</SectionHeader>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} onClick={click} style={{cursor:'pointer'}}>
              <defs><linearGradient id="akkuGradE" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
              <XAxis dataKey="tag" tick={axTick} axisLine={false} tickLine={false} />
              <YAxis tick={axTick} axisLine={false} tickLine={false} unit=" kWh" width={50} />
              <Tooltip contentStyle={ts} />
              <Area type="monotone" dataKey="Akku" name="Speicher" stroke="#8b5cf6" strokeWidth={2} fill="url(#akkuGradE)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHeader>Tageskosten (€)</SectionHeader>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} onClick={click} style={{cursor:'pointer'}}>
              <defs><linearGradient id="kostenGradE" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
              </linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
              <XAxis dataKey="tag" tick={axTick} axisLine={false} tickLine={false} />
              <YAxis tick={axTick} axisLine={false} tickLine={false} unit=" €" width={40} />
              <Tooltip contentStyle={ts} formatter={(v:number) => [`${fmt(v,2)} €`,'Kosten']} />
              <Area type="monotone" dataKey="Kosten" name="Kosten" stroke="#f43f5e" strokeWidth={2} fill="url(#kostenGradE)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card>
        <SectionHeader>Verbrauch nach Gerät</SectionHeader>
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0">
            <ResponsiveContainer width={160} height={160}>
              <PieChart><Pie data={appData} innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {appData.map((e,i) => <Cell key={i} fill={e.color} />)}
              </Pie><Tooltip contentStyle={ts} formatter={(v:number) => [`${fmt(v)} kWh`,'']} /></PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5">
            {appData.map((d,i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:d.color}} />
                  <span className={`text-xs ${t('text-slate-400','text-gray-500')}`}>{d.name}</span>
                </div>
                <span className="text-xs font-black" style={{color:d.color}}>{fmt(d.value)} kWh</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Auto Tab ─────────────────────────────────────────────────────────────────

function AutoTab({ stats, days, onDayClick, prevDayKm = 0 }: {
  stats: ReturnType<typeof getMonthStats>; days: EnergyData[]; onDayClick: (d: EnergyData) => void; prevDayKm?: number;
}) {
  const { t, ts, gc, ac, cc } = useTheme();
  if (!days.length) return <Card><p className={`text-center py-8 ${t('text-slate-500','text-gray-400')}`}>Keine Daten.</p></Card>;

  const kmByDay = days.map((r,i) => ({
    tag: r.Datum.substring(0,5),
    km: i===0 ? Math.max(0, num(r.Auto_Kilometerstand) - prevDayKm) : Math.max(0, num(r.Auto_Kilometerstand) - num(days[i-1].Auto_Kilometerstand)),
    laden: num(r.E_Auto_Ladung_kWh),
    ladePV:   num(r.E_Auto_PV_kWh),
    ladeNetz: num(r.E_Auto_Netz_kWh),
    ladeAkku: num(r.E_Auto_Akku_kWh),
    reichweite: num(r.Auto_Reichweite_km), _row: r,
  }));
  const mostKmE  = kmByDay.reduce((b,r) => r.km > b.km ? r : b, kmByDay[0]);
  const mostCharge = days.reduce((b,r) => num(r.E_Auto_Ladung_kWh) > num(b.E_Auto_Ladung_kWh) ? r : b, days[0]);
  const latest   = days[days.length-1];
  const click    = (d: any) => { const r=d?.activePayload?.[0]?.payload?._row; if(r) onDayClick(r); };
  const axTick   = { fontSize:9, fill:ac, fontWeight:700 };

  // Ladequellen-Summen für Prozent-Anzeige
  const srcTotal = stats.totalCarPV + stats.totalCarNetz + stats.totalCarAkku;
  const srcPct = (v: number) => srcTotal > 0 ? Math.round((v / srcTotal) * 100) : 0;
  const hasSrcData = srcTotal > 0;

  return (
    <div className="space-y-6">
      <HighlightStrip items={[
        { icon:'🏎️', label:'Meiste km an einem Tag', value:`${fmt(mostKmE.km,0)} km`,                 sub:mostKmE.tag },
        { icon:'⚡',  label:'Meiste Ladung',          value:`${fmt(num(mostCharge.E_Auto_Ladung_kWh))} kWh`, sub:mostCharge.Datum },
        { icon:'🔋', label:'Aktuelle Reichweite',     value:`${latest.Auto_Reichweite_km} km`,         sub:'Jetzt' },
        { icon:'📍', label:'Kilometerstand',           value:`${parseInt(latest.Auto_Kilometerstand||'0').toLocaleString('de-AT')} km`, sub:'Odometer' },
      ]} />

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Gefahrene km"  value={fmt(stats.totalKm,0)}   unit="km"       icon="🚗" color={cc('blue')}   sub={`∅ ${fmt(stats.totalKm/stats.daysCount,1)} km/Tag`} />
        <StatCard label="E-Auto Ladung" value={fmt(stats.totalCar)}    unit="kWh"      icon="⚡" color={cc('indigo')} sub={`∅ ${fmt(stats.totalCar/stats.daysCount)} kWh/Tag`} />
        <StatCard label="Ø Verbrauch"   value={stats.totalKm>0?fmt(stats.totalCar/stats.totalKm*100,1):'–'} unit="kWh/100km" icon="📊" color={cc('slate')} sub="Effizienz" />
        <StatCard label="Reichweite"    value={latest.Auto_Reichweite_km||'–'} unit="km" icon="🔋" color={cc('teal')}  sub="Aktuell" />
      </div>

      {/* Ladequellen-Kacheln */}
      {hasSrcData && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="PV Direkt"    value={fmt(stats.totalCarPV)}   unit="kWh" icon="☀️" color={cc('amber')}  sub={`${srcPct(stats.totalCarPV)}% der Ladung`} />
          <StatCard label="Tiwag (Netz)" value={fmt(stats.totalCarNetz)} unit="kWh" icon="🔌" color={cc('rose')}   sub={`${srcPct(stats.totalCarNetz)}% der Ladung`} />
          <StatCard label="Akku"         value={fmt(stats.totalCarAkku)} unit="kWh" icon="🪫" color={cc('violet')} sub={`${srcPct(stats.totalCarAkku)}% der Ladung`} />
        </div>
      )}

      {/* Tages-km & Gesamtladung */}
      <Card>
        <SectionHeader>Tages-km & Ladung — klicken für Details</SectionHeader>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={kmByDay} barGap={4} onClick={click} style={{cursor:'pointer'}}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
            <XAxis dataKey="tag" tick={axTick} axisLine={false} tickLine={false} />
            <YAxis yAxisId="km"  tick={axTick} axisLine={false} tickLine={false} unit=" km"  width={45} />
            <YAxis yAxisId="kwh" orientation="right" tick={axTick} axisLine={false} tickLine={false} unit=" kWh" width={45} />
            <Tooltip contentStyle={ts} cursor={{fill:'#00000008'}} />
            <Bar yAxisId="km"  dataKey="km"    name="Gefahrene km" fill="#3b82f6" radius={[4,4,0,0]} maxBarSize={18} />
            <Bar yAxisId="kwh" dataKey="laden" name="Geladen kWh"  fill="#22d3ee" radius={[4,4,0,0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Ladequelle pro Tag (gestapelt) */}
      {hasSrcData && (
        <Card>
          <SectionHeader>Ladequelle pro Tag — ☀️ PV · 🔌 Tiwag · 🪫 Akku</SectionHeader>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={kmByDay} barGap={2} onClick={click} style={{cursor:'pointer'}}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
              <XAxis dataKey="tag" tick={axTick} axisLine={false} tickLine={false} />
              <YAxis tick={axTick} axisLine={false} tickLine={false} unit=" kWh" width={45} />
              <Tooltip contentStyle={ts} cursor={{fill:'#00000008'}} />
              <Bar dataKey="ladePV"   name="☀️ PV Direkt"   fill="#f59e0b" radius={[0,0,0,0]} maxBarSize={20} stackId="src" />
              <Bar dataKey="ladeAkku" name="🪫 Akku"         fill="#8b5cf6" radius={[0,0,0,0]} maxBarSize={20} stackId="src" />
              <Bar dataKey="ladeNetz" name="🔌 Tiwag (Netz)" fill="#f43f5e" radius={[4,4,0,0]} maxBarSize={20} stackId="src" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Reichweite */}
      <Card>
        <SectionHeader>Reichweite (km)</SectionHeader>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={kmByDay} onClick={click} style={{cursor:'pointer'}}>
            <defs><linearGradient id="rwGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
            <XAxis dataKey="tag" tick={axTick} axisLine={false} tickLine={false} />
            <YAxis tick={axTick} axisLine={false} tickLine={false} unit=" km" width={50} />
            <Tooltip contentStyle={ts} />
            <Area type="monotone" dataKey="reichweite" name="Reichweite" stroke="#3b82f6" strokeWidth={2} fill="url(#rwGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ─── Temperaturen Tab ─────────────────────────────────────────────────────────

function TemperaturenTab({ days, monthRows, onDayClick }: {
  days: EnergyData[];
  monthRows: EnergyData[];
  onDayClick: (d: EnergyData) => void;
}) {
  const { t, ts, gc, ac } = useTheme();
  if (!days.length) return <Card><p className={`text-center py-8 ${t('text-slate-500','text-gray-400')}`}>Keine Daten.</p></Card>;

  // Tageszeit-Maps aus allen Stundenwerten (monthRows)
  const dailyMaxTemp    = useMemo(() => getDailyMaxTemp(monthRows),     [monthRows]);
  const dailyMinTemp    = useMemo(() => getDailyMinTemp(monthRows),     [monthRows]);
  const dailyMaxTempTag = useMemo(() => getDailyMaxTempTag(monthRows),  [monthRows]);
  const dailyMinTempTag = useMemo(() => getDailyMinTempTag(monthRows),  [monthRows]);
  const dailyMaxTempNacht = useMemo(() => getDailyMaxTempNacht(monthRows), [monthRows]);
  const dailyMinTempNacht = useMemo(() => getDailyMinTempNacht(monthRows), [monthRows]);

  const latest = days[days.length-1];

  // Wärmster / kältester Tag basierend auf dem Tages-Maximum/-Minimum aller Stundenwerte
  const hottest = days.reduce((b, r) => {
    const maxB = dailyMaxTemp.get(b.Datum) ?? num(b.Temp_Aussen);
    const maxR = dailyMaxTemp.get(r.Datum) ?? num(r.Temp_Aussen);
    return maxR > maxB ? r : b;
  }, days[0]);
  const coldest = days.reduce((b, r) => {
    const minB = dailyMinTemp.get(b.Datum) ?? num(b.Temp_Aussen);
    const minR = dailyMinTemp.get(r.Datum) ?? num(r.Temp_Aussen);
    return minR < minB ? r : b;
  }, days[0]);

  // Wärmster Tag (nur Tagzeit)
  const hottestTag = days.reduce((b, r) => {
    const maxB = dailyMaxTempTag.get(b.Datum) ?? -999;
    const maxR = dailyMaxTempTag.get(r.Datum) ?? -999;
    return maxR > maxB ? r : b;
  }, days[0]);
  // Kälteste Nacht
  const coldestNacht = days.reduce((b, r) => {
    const minB = dailyMinTempNacht.get(b.Datum) ?? 999;
    const minR = dailyMinTempNacht.get(r.Datum) ?? 999;
    return minR < minB ? r : b;
  }, days[0]);

  const mostHeat= days.reduce((b,r) => num(r.Heizung_kWh)>num(b.Heizung_kWh)?r:b, days[0]);
  const avgHumid= days.reduce((s,r) => s+num(r.Luftfeuchte_Schlafzimmer_Proz),0)/days.length;

  const hottestVal   = dailyMaxTemp.get(hottest.Datum)     ?? num(hottest.Temp_Aussen);
  const coldestVal   = dailyMinTemp.get(coldest.Datum)     ?? num(coldest.Temp_Aussen);
  const hottestTagVal  = dailyMaxTempTag.get(hottestTag.Datum)   ?? num(hottestTag.Temp_Aussen);
  const coldestNachtVal= dailyMinTempNacht.get(coldestNacht.Datum) ?? num(coldestNacht.Temp_Aussen);

  const chartData = days.map(r => ({
    tag: r.Datum.substring(0,5),
    aussen: num(r.Temp_Aussen),
    maxTag:   dailyMaxTempTag.get(r.Datum)   ?? null,
    minTag:   dailyMinTempTag.get(r.Datum)   ?? null,
    maxNacht: dailyMaxTempNacht.get(r.Datum) ?? null,
    minNacht: dailyMinTempNacht.get(r.Datum) ?? null,
    bewoelkung:num(r.Bewoelkung_Proz),
    heizung:num(r.Heizung_kWh),
    feucht:num(r.Luftfeuchte_Schlafzimmer_Proz),
    _row:r
  }));
  const click = (d:any) => { const r=d?.activePayload?.[0]?.payload?._row; if(r) onDayClick(r); };
  const axTick = { fontSize:9, fill:ac, fontWeight:700 };

  return (
    <div className="space-y-6">
      <HighlightStrip items={[
        { icon:'🌡️', label:'Wärmster Tag (Tagmax)',  value:`${fmt(hottestVal)}°C`,   sub:hottest.Datum },
        { icon:'🥶', label:'Kältester Tag (Tagmin)',  value:`${fmt(coldestVal)}°C`,   sub:coldest.Datum },
        { icon:'☀️', label:'Wärmste Tagzeit (07–22)', value:`${fmt(hottestTagVal)}°C`, sub:hottestTag.Datum },
        { icon:'🌙', label:'Kälteste Nacht (22–07)',  value:`${fmt(coldestNachtVal)}°C`, sub:coldestNacht.Datum },
      ]} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:'Außen aktuell',  val:`${fmt(num(latest.Temp_Aussen))}°`,          sub:`☁️ ${latest.Bewoelkung_Proz}%`,   color:'text-sky-600' },
          { label:'Wasserbett Papa',val:`${fmt(num(latest.Temp_Wasserbett_Papa))}°`,  sub:'Temperatur',                         color:'text-pink-600' },
          { label:'Wasserbett Mama',val:`${fmt(num(latest.Temp_Wasserbett_Mama))}°`,  sub:'Temperatur',                         color:'text-pink-500' },
          { label:'Luftfeuchte SZ', val:`${latest.Luftfeuchte_Schlafzimmer_Proz}%`, sub:'Schlafzimmer',                        color:'text-teal-600' },
        ].map((b,i) => (
          <div key={i} className={`${t('bg-slate-800/60 border-slate-700/50','bg-white border-gray-200')} border rounded-2xl p-5 text-center`}>
            <div className={`text-[9px] uppercase font-black mb-1 ${t('text-slate-500','text-gray-400')}`}>{b.label}</div>
            <div className={`text-3xl font-black ${b.color}`}>{b.val}</div>
            <div className={`text-[10px] mt-1 ${t('text-slate-500','text-gray-400')}`}>{b.sub}</div>
          </div>
        ))}
      </div>
      <Card>
        <SectionHeader>Außentemperatur: Tag- und Nacht-Maximum/Minimum</SectionHeader>
        <div className={`text-[9px] mb-2 ${t('text-slate-500','text-gray-400')}`}>☀️ Tag 07–22 Uhr · 🌙 Nacht 22–07 Uhr</div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} onClick={click} style={{cursor:'pointer'}}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
            <XAxis dataKey="tag" tick={axTick} axisLine={false} tickLine={false} />
            <YAxis tick={axTick} axisLine={false} tickLine={false} unit="°" width={35} />
            <Tooltip contentStyle={ts} formatter={(v: any) => v !== null ? [`${fmt(Number(v))}°C`] : ['–']} />
            <Line type="monotone" dataKey="maxTag"   name="Max Tag ☀️"   stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="minTag"   name="Min Tag ☀️"   stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4 2" dot={false} connectNulls />
            <Line type="monotone" dataKey="maxNacht" name="Max Nacht 🌙" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="minNacht" name="Min Nacht 🌙" stroke="#818cf8" strokeWidth={1.5} strokeDasharray="4 2" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <SectionHeader>Außentemperatur & Bewölkung — klicken für Details</SectionHeader>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} onClick={click} style={{cursor:'pointer'}}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
            <XAxis dataKey="tag" tick={axTick} axisLine={false} tickLine={false} />
            <YAxis yAxisId="temp" tick={axTick} axisLine={false} tickLine={false} unit="°" width={35} />
            <YAxis yAxisId="cloud" orientation="right" tick={axTick} axisLine={false} tickLine={false} unit="%" width={35} />
            <Tooltip contentStyle={ts} />
            <Line yAxisId="temp"  type="monotone" dataKey="aussen"     name="Außentemp"  stroke="#38bdf8" strokeWidth={2} dot={false} />
            <Line yAxisId="cloud" type="monotone" dataKey="bewoelkung" name="Bewölkung"  stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 2" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeader>Heizungsverbrauch (kWh)</SectionHeader>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} onClick={click} style={{cursor:'pointer'}}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
              <XAxis dataKey="tag" tick={axTick} axisLine={false} tickLine={false} />
              <YAxis tick={axTick} axisLine={false} tickLine={false} unit=" kWh" width={45} />
              <Tooltip contentStyle={ts} />
              <Bar dataKey="heizung" name="Heizung" fill="#f97316" radius={[4,4,0,0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHeader>Luftfeuchte Schlafzimmer (%)</SectionHeader>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} onClick={click} style={{cursor:'pointer'}}>
              <defs><linearGradient id="feuchtGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/><stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
              </linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
              <XAxis dataKey="tag" tick={axTick} axisLine={false} tickLine={false} />
              <YAxis tick={axTick} axisLine={false} tickLine={false} unit="%" width={35} />
              <Tooltip contentStyle={ts} />
              <Area type="monotone" dataKey="feucht" name="Luftfeuchte" stroke="#14b8a6" strokeWidth={2} fill="url(#feuchtGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
// ─── Tagesansicht Tab ───────────────────────────────────────────────────
// Spalten für die Tagesabschluss-Tabelle
const TAGES_COLS: { label: string; key: keyof EnergyData; unit: string; color: string }[] = [
  { label:'Datum',      key:'Datum',                       unit:'',    color:'' },
  { label:'Uhrzeit',    key:'created',                     unit:'',    color:'' },
  { label:'PV',         key:'PV_Ertrag_kWh',               unit:'kWh', color:'text-amber-600' },
  { label:'Netz',       key:'Netzbezug_kWh',               unit:'kWh', color:'text-rose-600' },
  { label:'Einspeis.',  key:'Netz_Einspeisung_kWh',        unit:'kWh', color:'text-sky-600' },
  { label:'Kosten',     key:'Kosten_Euro',                 unit:'€',   color:'text-red-600' },
  { label:'SOC kWh',    key:'Speicher_Inhalt_SOC_kWh',    unit:'kWh', color:'text-violet-600' },
  { label:'Hausverbr.', key:'Hausverbrauch_Berechnet_kWh', unit:'kWh', color:'text-gray-600' },
  { label:'Heizung',    key:'Heizung_kWh',                 unit:'kWh', color:'text-orange-600' },
  { label:'E-Auto',     key:'E_Auto_Ladung_kWh',           unit:'kWh', color:'text-blue-600' },
  { label:'Außen °C',   key:'Temp_Aussen',                 unit:'°',   color:'text-cyan-600' },
  { label:'Prognose',   key:'PV_Prognose_Heute_kWh',       unit:'kWh', color:'text-amber-500' },
  { label:'Roboter m²', key:'Roboter_Flaeche_m2',          unit:'m²',  color:'text-teal-600' },
];

/** Letzten Wert pro Tag vor der Zurücksetzung (= höchster created-Timestamp des Tages) */
function getDailyLastEntry(rows: EnergyData[]): EnergyData[] {
  const map = new Map<string, EnergyData>();
  for (const row of rows) {
    const existing = map.get(row.Datum);
    if (!existing || row.created > existing.created) {
      map.set(row.Datum, row);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const ms = (r: EnergyData) => {
      const [d, m, y] = r.Datum.split('.').map(Number);
      return new Date(y, m - 1, d).getTime();
    };
    return ms(a) - ms(b);
  });
}
function TagesansichtTab({ monthRows, days, onDayClick, heuteFilter = false }: {
  monthRows: EnergyData[];
  days: EnergyData[];
  onDayClick: (d: EnergyData) => void;
  heuteFilter?: boolean;
}) {
  const { t } = useTheme();
  const dailyLast = useMemo(() => getDailyLastEntry(monthRows), [monthRows]);

  // Im Heute-Modus: Stundenwerte als Tabelle zeigen
  if (heuteFilter) {
    const todayLabel = monthRows[0]?.Datum ?? '';
    const wochentag  = monthRows[0]?.Wochentag ?? '';
    const hourRows = [...monthRows].sort((a, b) => a.created < b.created ? -1 : 1);
    return (
      <div className="space-y-4">
        <div className={`text-[10px] font-bold uppercase tracking-widest ${t('text-slate-500','text-gray-400')}`}>
          Stundenwerte · Heute · {todayLabel} {wochentag} · {hourRows.length} Einträge
        </div>
        {hourRows.length === 0 ? (
          <Card><p className={`text-center py-8 ${t('text-slate-500','text-gray-400')}`}>Keine Daten für heute.</p></Card>
        ) : (
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className={`border-b ${t('border-slate-800 bg-slate-900/40','border-gray-200 bg-gray-50')}`}>
                    {TAGES_COLS.map(c => (
                      <th key={String(c.key)} className={`text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${t('text-slate-500','text-gray-400')}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hourRows.map((row, i) => (
                    <tr
                      key={i}
                      onClick={() => onDayClick(row)}
                      className={`border-b cursor-pointer transition-colors ${t('border-slate-800/40 hover:bg-slate-800/40','border-gray-100 hover:bg-emerald-50')} ${i % 2 === 0 ? '' : t('bg-slate-800/15','bg-gray-50/60')}`}
                    >
                      {TAGES_COLS.map(col => {
                        let display = '';
                        if (col.key === 'created') {
                          display = String(row[col.key] ?? '').substring(11, 16);
                        } else if (col.key === 'Datum') {
                          display = String(row[col.key] ?? '').substring(0, 5) + ' ' + (row.Wochentag ?? '');
                        } else {
                          const v = num(row[col.key] as string);
                          display = `${fmt(v, col.unit === '€' ? 2 : 1)}${col.unit}`;
                        }
                        return (
                          <td key={String(col.key)} className={`px-4 py-2 font-bold whitespace-nowrap ${col.color || t('text-slate-400','text-gray-700')}`}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`px-4 py-2 border-t text-[9px] ${t('border-slate-800 text-slate-600','border-gray-100 text-gray-400')}`}>
              💡 Klick auf eine Zeile öffnet die Detailansicht · Stundenwerte des heutigen Tages
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`text-[10px] font-bold uppercase tracking-widest ${t('text-slate-500','text-gray-400')}`}>
        Tagesabschluss-Werte · {dailyLast.length} Tage · letzter erfasster Eintrag pro Tag vor Zurücksetzung
      </div>
      {dailyLast.length === 0 ? (
        <Card><p className={`text-center py-8 ${t('text-slate-500','text-gray-400')}`}>Keine Daten.</p></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className={`border-b ${t('border-slate-800 bg-slate-900/40','border-gray-200 bg-gray-50')}`}>
                  {TAGES_COLS.map(c => (
                    <th key={String(c.key)} className={`text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${t('text-slate-500','text-gray-400')}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dailyLast.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => onDayClick(row)}
                    className={`border-b cursor-pointer transition-colors ${t('border-slate-800/40 hover:bg-slate-800/40','border-gray-100 hover:bg-emerald-50')} ${i % 2 === 0 ? '' : t('bg-slate-800/15','bg-gray-50/60')}`}
                  >
                    {TAGES_COLS.map(col => {
                      let display = '';
                      if (col.key === 'created') {
                        display = String(row[col.key] ?? '').substring(11, 16);
                      } else if (col.key === 'Datum') {
                        display = String(row[col.key] ?? '').substring(0, 5) + ' ' + (row.Wochentag ?? '');
                      } else {
                        const v = num(row[col.key] as string);
                        display = `${fmt(v, col.unit === '€' ? 2 : 1)}${col.unit}`;
                      }
                      return (
                        <td key={String(col.key)} className={`px-4 py-2 font-bold whitespace-nowrap ${col.color || t('text-slate-400','text-gray-700')}`}>
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`px-4 py-2 border-t text-[9px] ${t('border-slate-800 text-slate-600','border-gray-100 text-gray-400')}`}>
            💡 Klick auf eine Zeile öffnet die Detailansicht · Uhrzeit = letzter Messwert vor Tages-Reset
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── MonatsvergleichTab ───────────────────────────────────────────────────────

function MonatsvergleichTab({ allData }: { allData: EnergyData[] }) {
  const { t, ts, gc, ac } = useTheme();
  const axTick = { fontSize: 9, fill: ac, fontWeight: 700 };

  const monthlyStats = useMemo(() => {
    const monthMap = new Map<string, EnergyData[]>();
    for (const row of allData) {
      const [, m, y] = row.Datum.split('.');
      const key = `${m}.${y}`;
      if (!monthMap.has(key)) monthMap.set(key, []);
      monthMap.get(key)!.push(row);
    }
    const sorted = Array.from(monthMap.keys()).sort((a, b) => {
      const [am, ay] = a.split('.').map(Number), [bm, by] = b.split('.').map(Number);
      return ay !== by ? ay - by : am - bm;
    });
    return sorted.map(key => {
      const [m, y] = key.split('.');
      const days = getDailyFinal(monthMap.get(key)!);
      const s = getMonthStats(days);
      const label = `${MONTHS_DE[parseInt(m) - 1].substring(0, 3)} ${y.substring(2)}`;
      return { key, label, ...s };
    });
  }, [allData]);

  if (!monthlyStats.length) return null;

  const energieData = monthlyStats.map(m => ({
    monat: m.label, PV: +m.totalPV.toFixed(1), Netz: +m.totalGrid.toFixed(1), Einsp: +m.totalFeed.toFixed(1),
  }));
  const kostenData = monthlyStats.map(m => ({
    monat: m.label, Kosten: +m.totalKosten.toFixed(2), Autarkie: +m.autarky.toFixed(0),
  }));
  const autoData = monthlyStats.map(m => ({
    monat: m.label, km: +m.totalKm.toFixed(0), Ladung: +m.totalCar.toFixed(1),
  }));
  const heizungData = monthlyStats.map(m => ({
    monat: m.label, Heizung: +m.totalHeat.toFixed(1),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-xl font-black ${t('text-white', 'text-gray-900')}`}>Monatsvergleich</h2>
        <p className={`text-xs mt-1 ${t('text-slate-400', 'text-gray-500')}`}>{monthlyStats.length} Monate verfügbar</p>
      </div>

      {/* PV · Netzbezug · Einspeisung */}
      <Card>
        <SectionHeader>PV · Netzbezug · Einspeisung (kWh / Monat)</SectionHeader>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={energieData} barGap={2} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
            <XAxis dataKey="monat" tick={axTick} axisLine={false} tickLine={false} />
            <YAxis tick={axTick} axisLine={false} tickLine={false} unit=" kWh" width={52} />
            <Tooltip contentStyle={ts} />
            <Bar dataKey="PV" name="PV Ertrag" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Netz" name="Netzbezug" fill="#ef4444" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Einsp" name="Einspeisung" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Kosten + Autarkie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeader>Stromkosten (€ / Monat)</SectionHeader>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={kostenData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
              <XAxis dataKey="monat" tick={axTick} axisLine={false} tickLine={false} />
              <YAxis tick={axTick} axisLine={false} tickLine={false} unit=" €" width={42} />
              <Tooltip contentStyle={ts} formatter={(v: number) => [`${v.toFixed(2)} €`, 'Kosten']} />
              <Bar dataKey="Kosten" name="Stromkosten" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHeader>Autarkiegrad (% / Monat)</SectionHeader>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={kostenData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
              <XAxis dataKey="monat" tick={axTick} axisLine={false} tickLine={false} />
              <YAxis tick={axTick} axisLine={false} tickLine={false} unit="%" width={36} domain={[0, 100]} />
              <Tooltip contentStyle={ts} formatter={(v: number) => [`${v}%`, 'Autarkie']} />
              <Bar dataKey="Autarkie" name="Autarkie" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* E-Auto + Heizung */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeader>E-Auto · km & Ladung / Monat</SectionHeader>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={autoData} barGap={2} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
              <XAxis dataKey="monat" tick={axTick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="km" tick={axTick} axisLine={false} tickLine={false} unit=" km" width={44} />
              <YAxis yAxisId="kwh" orientation="right" tick={axTick} axisLine={false} tickLine={false} unit=" kWh" width={44} />
              <Tooltip contentStyle={ts} />
              <Bar yAxisId="km" dataKey="km" name="km gefahren" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="kwh" dataKey="Ladung" name="Geladen kWh" fill="#a78bfa" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHeader>Heizung (kWh / Monat)</SectionHeader>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={heizungData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
              <XAxis dataKey="monat" tick={axTick} axisLine={false} tickLine={false} />
              <YAxis tick={axTick} axisLine={false} tickLine={false} unit=" kWh" width={44} />
              <Tooltip contentStyle={ts} />
              <Bar dataKey="Heizung" name="Heizung" fill="#f97316" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Zusammenfassung Tabelle */}
      <Card>
        <SectionHeader>Alle Monate auf einen Blick</SectionHeader>
        <div className="overflow-x-auto">
          <table className={`w-full text-[11px] font-mono ${t('text-slate-300', 'text-gray-700')}`}>
            <thead>
              <tr className={`border-b ${t('border-slate-700', 'border-gray-200')}`}>
                <th className="text-left py-2 pr-3 font-black">Monat</th>
                <th className="text-right py-2 px-2 font-black">PV kWh</th>
                <th className="text-right py-2 px-2 font-black">Netz kWh</th>
                <th className="text-right py-2 px-2 font-black">Einsp. kWh</th>
                <th className="text-right py-2 px-2 font-black">Kosten</th>
                <th className="text-right py-2 px-2 font-black">Autarkie</th>
                <th className="text-right py-2 px-2 font-black">Auto km</th>
                <th className="text-right py-2 px-2 font-black">Auto kWh</th>
                <th className="text-right py-2 px-2 font-black">Heizung</th>
              </tr>
            </thead>
            <tbody>
              {monthlyStats.map(m => (
                <tr key={m.key} className={`border-b ${t('border-slate-800/50', 'border-gray-100')}`}>
                  <td className="py-1.5 pr-3 font-bold">{m.label}</td>
                  <td className="text-right px-2 text-emerald-400">{fmt(m.totalPV)}</td>
                  <td className="text-right px-2 text-red-400">{fmt(m.totalGrid)}</td>
                  <td className="text-right px-2 text-blue-400">{fmt(m.totalFeed)}</td>
                  <td className="text-right px-2 text-amber-400">{eur(m.totalKosten)}</td>
                  <td className="text-right px-2">{fmt(m.autarky, 0)}%</td>
                  <td className="text-right px-2">{fmt(m.totalKm, 0)}</td>
                  <td className="text-right px-2">{fmt(m.totalCar)}</td>
                  <td className="text-right px-2">{fmt(m.totalHeat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id:'uebersicht',      label:'Übersicht',      icon:'🏡' },
  { id:'energie',         label:'Energie',         icon:'⚡' },
  { id:'auto',            label:'Auto',            icon:'🚗' },
  { id:'temperaturen',    label:'Temperaturen',    icon:'🌡️' },
  { id:'tagesansicht',    label:'Tagesansicht',    icon:'📋' },
  { id:'monatsvergleich', label:'Monatsvergleich', icon:'📊' },
];

export default function Dashboard() {
  // Theme
  const [isDark, setIsDark] = useState(() => localStorage.getItem('energyDark') === 'true');
  const toggleDark = useCallback(() => setIsDark(d => { const n=!d; localStorage.setItem('energyDark',String(n)); return n; }), []);
  const theme = useMemo(() => buildTheme(isDark, toggleDark), [isDark, toggleDark]);

  // Data
  const [allData, setAllData]   = useState<EnergyData[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');

  // Filters & UI
  const [activeTab, setActiveTab]           = useState<TabId>('uebersicht');
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [selectedDay, setSelectedDay]       = useState('');
  const [heuteFilter, setHeuteFilter] = useState(false);
  const [lightbox, setLightbox]             = useState<LightboxData | null>(null);

  useEffect(() => {
    fetch('/api/data')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: EnergyData[]) => {
        setAllData(data);
        // Zeitstempel der zuletzt eingelesenen Zeile aus den Rohdaten
        const latest = data[data.length - 1];
        if (latest?.created) {
          const ts = String(latest.created).substring(0, 16).replace('T', ' ');
          setLastUpdated(ts);
        } else {
          setLastUpdated(new Date().toLocaleTimeString('de-AT'));
        }
        if (latest) { const [,m,y] = latest.Datum.split('.'); setSelectedMonthKey(`${m}.${y}`); }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    allData.forEach(r => { const [,m,y] = r.Datum.split('.'); set.add(`${m}.${y}`); });
    return Array.from(set).sort((a,b) => {
      const [am,ay]=a.split('.').map(Number), [bm,by]=b.split('.').map(Number);
      return ay!==by ? ay-by : am-bm;
    });
  }, [allData]);

  const { monthRows, days, stats, monthLabel, dailyMaxSOC } = useMemo(() => {
    if (!allData.length || !selectedMonthKey) return { monthRows:[], days:[], stats:null, monthLabel:'', dailyMaxSOC: new Map<string,number>() };
    const [m,y] = selectedMonthKey.split('.');
    const monthRows = allData.filter(r => { const [,rm,ry]=r.Datum.split('.'); return rm===m && ry===y; });
    const days = getDailyFinal(monthRows);
    const dailyMaxSOC = getDailyMaxSOC(monthRows);
    return { monthRows, days, stats: getMonthStats(days), monthLabel: `${MONTHS_DE[parseInt(m)-1]} ${y}`, dailyMaxSOC };
  }, [allData, selectedMonthKey]);

  // ── Heute-Filter ──
  const todayDatum = useMemo(() => allData.length ? allData[allData.length - 1].Datum : '', [allData]);
  const heuteRows  = useMemo(() => todayDatum ? allData.filter(r => r.Datum === todayDatum).sort((a,b) => a.created < b.created ? -1 : 1) : [], [allData, todayDatum]);
  const heuteDays  = useMemo(() => getDailyFinal(heuteRows), [heuteRows]);
  const heuteStats = useMemo(() => heuteDays.length ? getMonthStats(heuteDays) : null, [heuteDays]);
  const heuteMaxSOC= useMemo(() => getDailyMaxSOC(heuteRows), [heuteRows]);
  const prevDayKm = useMemo(() => {
    if (!heuteFilter || !heuteRows.length) return 0;
    const firstCreated = heuteRows[0].created;
    const prevRows = allData.filter(r => r.created < firstCreated && r.Datum !== todayDatum);
    return prevRows.length ? num(prevRows[prevRows.length - 1].Auto_Kilometerstand) : 0;
  }, [heuteFilter, heuteRows, allData, todayDatum]);
  const activeMonthRows  = heuteFilter ? heuteRows   : monthRows;
  const activeDays       = heuteFilter ? heuteDays   : days;
  const activeStats      = heuteFilter ? (heuteStats ?? stats) : stats;
  const activeDailyMaxSOC= heuteFilter ? heuteMaxSOC : dailyMaxSOC;
  const activeLabel      = heuteFilter ? `Heute \u00b7 ${todayDatum}` : monthLabel;

  // Reset day when month changes
  useEffect(() => {
    if (days.length > 0) setSelectedDay(days[days.length-1].Datum);
  }, [days]);

  const monthAvg = useMemo(() => {
    if (!days.length) return {};
    const keys: (keyof EnergyData)[] = ['PV_Ertrag_kWh','Netzbezug_kWh','Netz_Einspeisung_kWh','Akku_Geladen_kWh',
      'Akku_Entladen_kWh','Kosten_Euro','Hausverbrauch_Berechnet_kWh','Heizung_kWh','E_Auto_Ladung_kWh',
      'Temp_Aussen','Bewoelkung_Proz','PV_Prognose_Heute_kWh','Speicher_Inhalt_SOC_kWh','Buero_Kueche_kWh',
      'Gaming_buero_kWh','Waschmaschine_kWh'];
    return Object.fromEntries(keys.map(k => [k, days.reduce((s,r) => s+num(r[k] as string),0)/days.length]));
  }, [days]);

  const handleDayClick = useCallback((day: EnergyData) => setLightbox({ title: day.Datum, day, monthAvg }), [monthAvg]);

  const handleDayFilter = (day: string) => {
    setSelectedDay(day);
    if (day) setActiveTab('tagesansicht');
  };

  const latest  = days[days.length - 1];
  const insights = useMemo(() => stats && days.length ? generateInsights(stats, days) : [], [stats, days]);

  const { t, ts, gc, ac, cc } = theme;

  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${isDark?'bg-slate-950':'bg-gray-50'}`}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className={`font-mono text-xs uppercase tracking-widest ${isDark?'text-emerald-400':'text-emerald-600'}`}>Lade Energiedaten…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className={`min-h-screen flex items-center justify-center ${isDark?'bg-slate-950':'bg-gray-50'}`}>
      <div className="text-red-500 text-center"><div className="text-4xl mb-4">⚡</div>
        <p className="font-bold">Fehler beim Laden der Daten</p>
        <p className="text-sm opacity-60 mt-1">{error}</p></div>
    </div>
  );

  if (!stats || !latest) return null;
  // Active data alias for render
  const renderStats = activeStats;
  const renderDays = activeDays;
  const renderMonthRows = activeMonthRows;


  const accu1 = num(latest.SOC_Akku1_Proz), accu2 = num(latest.SOC_Akku2_Proz);
  const accuContent = num(latest.Speicher_Inhalt_SOC_kWh);
  const axTick = { fontSize: 9, fill: ac, fontWeight: 700 };

  const overviewData = activeDays.map(r => ({
    tag: r.Datum.substring(0,5), PV: num(r.PV_Ertrag_kWh), Netz: num(r.Netzbezug_kWh),
    Akku: dailyMaxSOC.get(r.Datum) ?? num(r.Speicher_Inhalt_SOC_kWh), _row: r,
  }));
  const ovClick = (d: any) => { const r=d?.activePayload?.[0]?.payload?._row; if(r) handleDayClick(r); };

  // Select styles
  const selStyle = t(
    'bg-slate-800 border border-slate-700 text-slate-200',
    'bg-white border border-gray-300 text-gray-700'
  );

  return (
    <ThemeCtx.Provider value={theme}>
      <div className={`min-h-screen font-sans transition-colors duration-200 ${isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-gray-50 text-gray-900'}`}>

        {/* ── Header ── */}
        <header className={`sticky top-0 z-30 backdrop-blur border-b ${t('bg-slate-950/90 border-slate-800','bg-white/95 border-gray-200')}`}>
          <div className="max-w-7xl mx-auto px-4 h-auto py-3 flex flex-wrap items-center justify-between gap-3">
            {/* Logo */}
            <button
              onClick={() => { setActiveTab('uebersicht'); setSelectedDay(''); setHeuteFilter(false); setSelectedMonthKey(availableMonths[availableMonths.length-1] ?? ''); }}
              className="flex items-center gap-3 flex-shrink-0 group"
              title="Zurück zur Startseite"
            >
              <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-lg shadow-lg shadow-emerald-500/20 group-hover:bg-emerald-400 transition-colors">⚡</div>
              <div className="text-left">
                <h1 className={`text-sm font-black tracking-tight leading-none ${t('text-white','text-gray-900')}`}>Energie Dashboard</h1>
                <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${t('text-emerald-400','text-emerald-600')}`}>Haus 543</p>
              </div>
            </button>

            {/* Controls right */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Live indicator */}
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${t('bg-slate-800','bg-gray-100')}`}>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className={`text-[10px] font-bold uppercase ${t('text-slate-400','text-gray-500')}`}>Live · {lastUpdated}</span>
              </div>

              {/* Heute-Filter */}
          <button
            onClick={() => setHeuteFilter(h => !h)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all ${
              heuteFilter
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : t('bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700','bg-gray-100 text-gray-600 hover:bg-gray-200')
            }`}
            title="Nur Daten von heute anzeigen"
          >
            <span>📅</span><span>Heute</span>
          </button>
          {/* Month filter */}
              <select value={selectedMonthKey} onChange={e => setSelectedMonthKey(e.target.value)}
                className={`${selStyle} text-[11px] font-bold rounded-lg px-3 py-1.5 outline-none cursor-pointer`}>
                {availableMonths.map(mk => {
                  const [m,y] = mk.split('.');
                  return <option key={mk} value={mk}>{MONTHS_DE[parseInt(m)-1]} {y}</option>;
                })}
              </select>

              {/* Dark mode toggle */}
              <button onClick={toggleDark}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all ${
                  isDark ? 'bg-slate-700 text-yellow-300 hover:bg-slate-600'
                         : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={isDark ? 'Light Mode' : 'Dark Mode'}>
                {isDark ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </header>

        {/* ── Tab Bar ── */}
        <div className={`sticky top-[68px] z-20 backdrop-blur border-b ${t('bg-slate-950/90 border-slate-800','bg-white/95 border-gray-200')}`}>
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex gap-2 overflow-x-auto no-scrollbar">
            {TABS.map(tab => (
              <React.Fragment key={tab.id}>
                <TabButton id={tab.id} label={tab.label} icon={tab.icon} active={activeTab === tab.id} onClick={setActiveTab} />
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Main ── */}
        <main className="max-w-7xl mx-auto px-4 py-8">

          {/* ÜBERSICHT */}
          {activeTab === 'uebersicht' && (
            <div className="space-y-8">
              <section>
                <h2 className={`text-[10px] font-black uppercase tracking-widest mb-4 ${t('text-slate-500','text-gray-400')}`}>
                  Monatsübersicht · {activeLabel} · {activeStats.daysCount} Tage erfasst
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Stromkosten"  value={fmt(activeStats.totalKosten,2)} unit="€"   icon="🧾" color={cc('rose')}    sub={`∅ ${fmt(activeStats.totalKosten/activeStats.daysCount,2)} €/Tag`} />
                  <StatCard label="PV Ertrag"    value={fmt(activeStats.totalPV)}       unit="kWh"  icon="☀️" color={cc('amber')}   sub={`∅ ${fmt(activeStats.totalPV/activeStats.daysCount)} kWh/Tag`} />
                  <StatCard label="Autarkiegrad" value={fmt(activeStats.autarky,0)}     unit="%"    icon="🏡" color={cc(activeStats.autarky>=50?'emerald':'slate')} sub={`Netzbezug ${fmt(activeStats.totalGrid)} kWh`} />
                  <StatCard label="PV-Ersparnis" value={fmt(activeStats.pvSavings,2)}   unit="€"    icon="💰" color={cc('green')}   sub={`+ ${fmt(activeStats.feedRevenue,2)} € Einspeisung`} />
                </div>
              </section>

              {/* ── Monats-Highlights ── */}
              {(() => {
                // Bester PV-Tag
                const bestPV = activeDays.reduce((b,r) => num(r.PV_Ertrag_kWh)>num(b.PV_Ertrag_kWh)?r:b, activeDays[0]);
                // Günstigster Tag
                const cheapDay = activeDays.reduce((b,r) => num(r.Kosten_Euro)<num(b.Kosten_Euro)?r:b, activeDays[0]);
                // Höchster Akku-Stand (Tagesmax)
                const maxSOCEntry = activeDays.reduce((b,r) => {
                  const soc = activeDailyMaxSOC.get(r.Datum)??0;
                  return soc > (activeDailyMaxSOC.get(b.Datum)??0) ? r : b;
                }, activeDays[0]);
                const maxSOCVal = activeDailyMaxSOC.get(maxSOCEntry?.Datum??'')??0;
                // Bester Autarkie-Tag
                const autarkyDay = (r: EnergyData) => {
                  const s = num(r.PV_Ertrag_kWh)+num(r.Akku_Entladen_kWh);
                  const a = s+num(r.Netzbezug_kWh);
                  return a>0 ? (s/a)*100 : 0;
                };
                const bestAutarky = activeDays.reduce((b,r) => autarkyDay(r)>autarkyDay(b)?r:b, activeDays[0]);
                // Wärmster Tag
                const _ovMaxTemp = getDailyMaxTemp(activeMonthRows);
        const hottestDay = activeDays.reduce((b, r) => {
          const mxB = _ovMaxTemp.get(b.Datum) ?? num(b.Temp_Aussen);
          const mxR = _ovMaxTemp.get(r.Datum) ?? num(r.Temp_Aussen);
          return mxR > mxB ? r : b;
        }, activeDays[0]);
        const _hottestDayVal = _ovMaxTemp.get(hottestDay?.Datum ?? '') ?? num(hottestDay?.Temp_Aussen ?? '');
                // Meiste Einspeisung
                const bestFeed = activeDays.reduce((b,r) => num(r.Netz_Einspeisung_kWh)>num(b.Netz_Einspeisung_kWh)?r:b, activeDays[0]);
                // Roboter Gesamtfläche
                const totalRobot = activeDays.reduce((s,r) => s+num(r.Roboter_Flaeche_m2), 0);
                // Meiste km Tag
                const kmByDay = activeDays.map((r,i) => ({
                  datum: r.Datum, km: i===0?0:Math.max(0,num(r.Auto_Kilometerstand)-num(activeDays[i-1].Auto_Kilometerstand))
                }));
                const mostKmDay = kmByDay.reduce((b,r) => r.km>b.km?r:b, kmByDay[0]??{datum:'',km:0});

                const row1 = [
                  { icon:'☀️', label:'Bester PV-Tag',     value:`${fmt(num(bestPV?.PV_Ertrag_kWh))} kWh`,  sub: bestPV?.Datum },
                  { icon:'🔋', label:'Akku-Maximum',       value:`${fmt(maxSOCVal)} kWh`,                    sub: maxSOCEntry?.Datum },
                  { icon:'🏡', label:'Bester Autarkie-Tag',value:`${fmt(autarkyDay(bestAutarky),0)}%`,        sub: bestAutarky?.Datum },
                  { icon:'💸', label:'Günstigster Tag',    value: eur(num(cheapDay?.Kosten_Euro)),            sub: cheapDay?.Datum },
                ];
                const row2 = [
                  { icon:'🌡️', label:'Wärmster Tag',       value:`${fmt(_hottestDayVal)}°C`,   sub: hottestDay?.Datum },
                  { icon:'⬆️', label:'Meist Eingespeist',  value:`${fmt(num(bestFeed?.Netz_Einspeisung_kWh))} kWh`, sub: bestFeed?.Datum },
                  { icon:'🧹', label:'Roboter Monat',      value:`${fmt(totalRobot,0)} m²`,                  sub:'Gesamtfläche' },
                  { icon:'🚗', label:'Meiste km/Tag',      value:`${fmt(mostKmDay.km,0)} km`,                sub: mostKmDay.datum?.substring(0,5) || '–' },
                ];
                return (
                  <section className="space-y-3">
                    <h2 className={`text-[10px] font-black uppercase tracking-widest ${t('text-slate-500','text-gray-400')}`}>
                      ✨ Monats-Highlights · {activeLabel}
                    </h2>
                    <HighlightStrip items={row1} />
                    <HighlightStrip items={row2} />
                  </section>
                );
              })()}

              {/* KI-Analyse */}
              <section>
                <h2 className={`text-[10px] font-black uppercase tracking-widest mb-4 ${t('text-slate-500','text-gray-400')}`}>🤖 KI-Monatsanalyse · {activeLabel}</h2>
                <div className={`${t('bg-slate-900/60 border-emerald-900/40','bg-emerald-50 border-emerald-200')} border rounded-2xl p-5 space-y-3`}>
                  {insights.map((ins, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                      <p className={`text-sm leading-relaxed ${t('text-slate-300','text-gray-700')}`}>{ins}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Highlight Cards */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Energie-Bilanz */}
                <div className={`rounded-2xl p-5 border ${activeStats.netBalance >= 0
                  ? t('bg-emerald-950/40 border-emerald-700/30','bg-emerald-50 border-emerald-200')
                  : t('bg-slate-800/60 border-slate-700/50','bg-white border-gray-200')}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">⚡</span>
                    <span className={`text-[11px] font-black uppercase tracking-widest opacity-60`}>Energie-Bilanz</span>
                  </div>
                  <div className={`divide-y ${t('divide-white/5','divide-gray-100')}`}>
                    <Pill label="PV Ertrag"    value={`${fmt(activeStats.totalPV)} kWh`}   color="text-amber-500" />
                    <Pill label="Netzbezug"    value={`${fmt(activeStats.totalGrid)} kWh`}  color="text-rose-500" />
                    <Pill label="Einspeisung"  value={`${fmt(activeStats.totalFeed)} kWh`}  color="text-sky-500" />
                    <Pill label="Akku geladen" value={`${fmt(activeStats.totalCharge)} kWh`}color="text-violet-500" />
                    <Pill label="Akku entladen"value={`${fmt(activeStats.totalDischarge)} kWh`}color="text-violet-400" />
                  </div>
                  <div className={`mt-4 p-3 rounded-xl text-center ${activeStats.netBalance>=0
                    ? t('bg-emerald-500/10 text-emerald-400','bg-emerald-100 text-emerald-700')
                    : t('bg-rose-500/10 text-rose-400','bg-rose-100 text-rose-700')}`}>
                    <div className="text-[10px] uppercase font-black tracking-widest opacity-60">Netto-Bilanz</div>
                    <div className="text-xl font-black mt-0.5">{activeStats.netBalance>=0?'+':''}{eur(activeStats.netBalance)}</div>
                  </div>
                </div>

                {/* Aktueller Stand */}
                <div className={`rounded-2xl p-5 border ${t('bg-slate-800/60 border-slate-700/50','bg-white border-gray-200')}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">📡</span>
                    <span className="text-[11px] font-black uppercase tracking-widest opacity-60">Aktueller Stand</span>
                  </div>
                  <div className="space-y-3 mb-4">
                    {[{label:'Akku 1',val:accu1},{label:'Akku 2',val:accu2}].map(b => (
                      <div key={b.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className={t('text-slate-400','text-gray-500')}>{b.label}</span>
                          <span className="font-black text-violet-600">{b.val}%</span>
                        </div>
                        <div className={`h-2 rounded-full overflow-hidden ${t('bg-slate-700','bg-gray-200')}`}>
                          <div className="h-full bg-violet-500 rounded-full transition-all" style={{width:`${b.val}%`}} />
                        </div>
                      </div>
                    ))}
                    <div className="text-center pt-1">
                      <div className={`text-[10px] uppercase font-bold ${t('text-slate-500','text-gray-400')}`}>Speicher-Inhalt</div>
                      <div className="text-2xl font-black text-violet-600">{fmt(accuContent)} <span className="text-sm">kWh</span></div>
                      <div className={`text-[9px] mt-0.5 ${t('text-slate-500','text-gray-400')}`}>nutzbar: {fmt(Math.max(0, accuContent-1.23))} kWh · max 10,24 kWh</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label:'Außen', val:`${fmt(num(latest.Temp_Aussen))}°`, sub:`☁️ ${latest.Bewoelkung_Proz}%`, color:'text-sky-600' },
                      { label:'PV Prognose', val:`${fmt(num(latest.PV_Prognose_Heute_kWh))} kWh`, sub:'heute', color:'text-amber-600' },
                    ].map(b => (
                      <div key={b.label} className={`${t('bg-slate-700/40','bg-gray-100')} rounded-xl p-3 text-center`}>
                        <div className={`text-[9px] uppercase font-black ${t('text-slate-500','text-gray-400')}`}>{b.label}</div>
                        <div className={`text-lg font-black ${b.color}`}>{b.val}</div>
                        <div className={`text-[9px] ${t('text-slate-500','text-gray-400')}`}>{b.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* E-Auto */}
                <div className={`rounded-2xl p-5 border ${t('bg-slate-800/60 border-slate-700/50','bg-white border-gray-200')}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🚗</span>
                    <span className="text-[11px] font-black uppercase tracking-widest opacity-60">Renault 4 E-Tech</span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-sm ${t('text-slate-400','text-gray-500')}`}>Reichweite</span>
                    <span className="text-2xl font-black text-blue-600">{latest.Auto_Reichweite_km} <span className="text-sm">km</span></span>
                  </div>
                  <div className={`divide-y ${t('divide-white/5','divide-gray-100')}`}>
                    <Pill label="Geladene Energie (Monat)" value={`${fmt(activeStats.totalCar)} kWh`}  color="text-blue-600" />
                    <Pill label="Gefahrene km (Monat)"     value={`${fmt(activeStats.totalKm,0)} km`}   color="text-blue-500" />
                    <Pill label="Kilometerstand"           value={`${parseInt(latest.Auto_Kilometerstand||'0').toLocaleString('de-AT')} km`} color={t('text-slate-300','text-gray-600')} />
                  </div>
                  {/* Ladequellen-Breakdown */}
                  {(() => {
                    const pv   = activeStats.totalCarPV;
                    const netz = activeStats.totalCarNetz;
                    const akku = activeStats.totalCarAkku;
                    const total = pv + netz + akku;
                    if (total <= 0) return null;
                    const pct = (v: number) => Math.round((v / total) * 100);
                    return (
                      <div className="mt-4">
                        <div className={`text-[9px] font-black uppercase tracking-widest mb-2 ${t('text-slate-500','text-gray-400')}`}>Ladequellen diesen Monat</div>
                        {/* Stacked progress bar */}
                        <div className={`h-3 rounded-full overflow-hidden flex mb-2 ${t('bg-slate-700','bg-gray-200')}`}>
                          <div className="bg-amber-400 h-full transition-all" style={{width:`${pct(pv)}%`}} />
                          <div className="bg-violet-500 h-full transition-all" style={{width:`${pct(akku)}%`}} />
                          <div className="bg-rose-500 h-full transition-all"   style={{width:`${pct(netz)}%`}} />
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[9px] font-bold text-center">
                          <div>
                            <span className="text-amber-500">☀️ PV</span>
                            <div className={t('text-slate-300','text-gray-700')}>{fmt(pv)} kWh</div>
                            <div className={`${t('text-slate-500','text-gray-400')}`}>{pct(pv)}%</div>
                          </div>
                          <div>
                            <span className="text-violet-500">🪫 Akku</span>
                            <div className={t('text-slate-300','text-gray-700')}>{fmt(akku)} kWh</div>
                            <div className={`${t('text-slate-500','text-gray-400')}`}>{pct(akku)}%</div>
                          </div>
                          <div>
                            <span className="text-rose-500">🔌 Tiwag</span>
                            <div className={t('text-slate-300','text-gray-700')}>{fmt(netz)} kWh</div>
                            <div className={`${t('text-slate-500','text-gray-400')}`}>{pct(netz)}%</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </section>

              {/* Overview Charts */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <SectionHeader>PV Ertrag vs. Netzbezug — klicken für Details</SectionHeader>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={overviewData} barGap={2} onClick={ovClick} style={{cursor:'pointer'}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
                      <XAxis dataKey="tag" tick={axTick} axisLine={false} tickLine={false} />
                      <YAxis tick={axTick} axisLine={false} tickLine={false} unit=" kWh" width={50} />
                      <Tooltip contentStyle={ts} cursor={{fill:'#00000008'}} />
                      <Bar dataKey="PV"   name="PV Ertrag"  fill="#f59e0b" radius={[4,4,0,0]} maxBarSize={20} />
                      <Bar dataKey="Netz" name="Netzbezug"  fill="#f43f5e" radius={[4,4,0,0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <SectionHeader>Speicher-Inhalt (kWh) — klicken für Details</SectionHeader>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={overviewData} onClick={ovClick} style={{cursor:'pointer'}}>
                      <defs><linearGradient id="akkuGradO" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gc} />
                      <XAxis dataKey="tag" tick={axTick} axisLine={false} tickLine={false} />
                      <YAxis tick={axTick} axisLine={false} tickLine={false} unit=" kWh" width={50} />
                      <Tooltip contentStyle={ts} />
                      <Area type="monotone" dataKey="Akku" name="Speicher" stroke="#8b5cf6" strokeWidth={2} fill="url(#akkuGradO)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </section>
            </div>
          )}

          {activeTab === 'energie'         && <EnergieTab stats={activeStats} days={activeDays} monthRows={activeMonthRows} onDayClick={handleDayClick} />}
          {activeTab === 'auto'            && <AutoTab stats={activeStats} days={activeDays} onDayClick={handleDayClick} prevDayKm={prevDayKm} />}
          {activeTab === 'temperaturen'    && <TemperaturenTab days={activeDays} monthRows={activeMonthRows} onDayClick={handleDayClick} />}
          {activeTab === 'tagesansicht'    && (
            <TagesansichtTab monthRows={activeMonthRows} days={activeDays} onDayClick={handleDayClick} heuteFilter={heuteFilter} />
          )}
          {activeTab === 'monatsvergleich' && <MonatsvergleichTab allData={allData} />}
        </main>

        <footer className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p className={`text-[9px] font-bold uppercase tracking-widest ${t('text-slate-600','text-gray-300')}`}>
            Haus 543 · Energy Dashboard · Daten via HomeAssistant
          </p>
        </footer>

        {lightbox && <Lightbox data={lightbox} onClose={() => setLightbox(null)} />}
      </div>
    </ThemeCtx.Provider>
  );
}
