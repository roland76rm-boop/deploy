import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type TabId = 'uebersicht' | 'energie' | 'auto' | 'temperaturen' | 'tagesansicht';

interface LightboxData {
  title: string;
  day: EnergyData;
  monthAvg: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const num = (v: string | undefined): number => {
  if (v === undefined || v === null || v === '') return 0;
  const parsed = parseFloat(String(v).replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
};

const fmt = (v: number, d = 1) => v.toFixed(d);
const eur = (v: number) => v.toFixed(2) + ' €';

const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function getDailyFinal(rows: EnergyData[]): EnergyData[] {
  const map = new Map<string, EnergyData>();
  for (const row of rows) map.set(row.Datum, row);
  return Array.from(map.values()).sort((a, b) => {
    const toMs = (r: EnergyData) => {
      const [d, m, y] = r.Datum.split('.').map(Number);
      return new Date(y, m - 1, d).getTime();
    };
    return toMs(a) - toMs(b);
  });
}

function getMonthStats(days: EnergyData[]) {
  const n = days.length || 1;
  const totalPV        = days.reduce((s, r) => s + num(r.PV_Ertrag_kWh), 0);
  const totalGrid      = days.reduce((s, r) => s + num(r.Netzbezug_kWh), 0);
  const totalFeed      = days.reduce((s, r) => s + num(r.Netz_Einspeisung_kWh), 0);
  const totalCharge    = days.reduce((s, r) => s + num(r.Akku_Geladen_kWh), 0);
  const totalDischarge = days.reduce((s, r) => s + num(r.Akku_Entladen_kWh), 0);
  const totalHeat      = days.reduce((s, r) => s + num(r.Heizung_kWh), 0);
  const totalCar       = days.reduce((s, r) => s + num(r.E_Auto_Ladung_kWh), 0);
  const firstKm        = num(days[0]?.Auto_Kilometerstand);
  const lastKm         = num(days[days.length - 1]?.Auto_Kilometerstand);
  const totalKm        = Math.max(0, lastKm - firstKm);
  const totalKosten    = days.reduce((s, r) => s + num(r.Kosten_Euro), 0);
  const totalHaus      = days.reduce((s, r) => s + num(r.Hausverbrauch_Berechnet_kWh), 0);
  const totalSelf      = totalPV + totalDischarge;
  const totalAll       = totalSelf + totalGrid;
  const autarky        = totalAll > 0 ? (totalSelf / totalAll) * 100 : 0;
  const feedRevenue    = totalFeed * 0.08;
  const pvSavings      = (totalPV - totalFeed) * 0.28;
  const netBalance     = pvSavings + feedRevenue - totalKosten;
  return {
    totalPV, totalGrid, totalFeed, totalCharge, totalDischarge,
    totalHeat, totalCar, totalKm, totalKosten, totalHaus,
    autarky, feedRevenue, pvSavings, netBalance, daysCount: n,
  };
}

function generateInsights(stats: ReturnType<typeof getMonthStats>, days: EnergyData[]): string[] {
  if (!days.length) return ['Noch keine Daten für diesen Monat vorhanden.'];
  const insights: string[] = [];
  const n = days.length;

  // Autarkie
  if (stats.autarky >= 70)
    insights.push(`☀️ Ausgezeichnete Autarkie von ${fmt(stats.autarky, 0)}% – das Haus versorgt sich fast selbst aus eigener PV-Energie.`);
  else if (stats.autarky >= 50)
    insights.push(`✅ Gute Autarkie von ${fmt(stats.autarky, 0)}% – mehr als die Hälfte des Verbrauchs kommt aus eigener Energie.`);
  else if (stats.autarky >= 30)
    insights.push(`📊 Autarkie liegt bei ${fmt(stats.autarky, 0)}% – der Netzbezug dominiert noch, PV liefert aber einen wichtigen Beitrag.`);
  else
    insights.push(`⚠️ Autarkie nur ${fmt(stats.autarky, 0)}% – sehr viel Netzstrom. Prüfen ob PV-Anlage optimal läuft.`);

  // Bester PV-Tag
  const bestPV = days.reduce((b, r) => num(r.PV_Ertrag_kWh) > num(b.PV_Ertrag_kWh) ? r : b, days[0]);
  insights.push(`🏆 Bester PV-Tag war der ${bestPV.Datum} mit ${fmt(num(bestPV.PV_Ertrag_kWh))} kWh – ${bestPV.Wochentag}.`);

  // Netto-Bilanz
  if (stats.netBalance >= 0)
    insights.push(`💰 Netto-Bilanz positiv: +${eur(stats.netBalance)} – PV-Einnahmen und Eigenverbrauch übersteigen die Netzkosten.`);
  else
    insights.push(`📉 Netto-Bilanz: ${eur(stats.netBalance)} – Netzbezugskosten (${eur(stats.totalKosten)}) übersteigen PV-Einnahmen.`);

  // Heizung
  const avgHeat = stats.totalHeat / n;
  if (avgHeat > 12)
    insights.push(`🔥 Hoher Heizungsverbrauch: ∅ ${fmt(avgHeat)} kWh/Tag – typisch für die kalte Jahreszeit.`);
  else if (avgHeat < 2 && avgHeat > 0)
    insights.push(`🌿 Sehr niedriger Heizungsverbrauch: ∅ ${fmt(avgHeat)} kWh/Tag – die Heizung läuft kaum.`);

  // E-Auto
  if (stats.totalKm > 600)
    insights.push(`🚗 Intensiver Monat für das E-Auto: ${fmt(stats.totalKm, 0)} km gefahren, ${fmt(stats.totalCar)} kWh geladen.`);
  else if (stats.totalKm > 0)
    insights.push(`🚗 E-Auto: ${fmt(stats.totalKm, 0)} km gefahren, ∅ Verbrauch ${stats.totalKm > 0 ? fmt(stats.totalCar / stats.totalKm * 100, 1) : '–'} kWh/100km.`);

  // Ausreißer-Kosten
  const avgCost = stats.totalKosten / n;
  const highDay = days.find(r => num(r.Kosten_Euro) > avgCost * 2.5);
  if (highDay)
    insights.push(`❗ Ungewöhnlich hohe Kosten am ${highDay.Datum}: ${eur(num(highDay.Kosten_Euro))} (∅ ${eur(avgCost)}/Tag) – mögliche Ursache: hoher Netzbezug.`);

  return insights.slice(0, 5);
}

// ─── Tooltip style ────────────────────────────────────────────────────────────

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '12px',
  color: '#e2e8f0',
  fontSize: '11px',
  fontWeight: 700,
};

// ─── Small UI Components ──────────────────────────────────────────────────────

function StatCard({ label, value, unit, icon, color, sub }: {
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

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs font-black ${color}`}>{value}</span>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">
      {children}
    </h3>
  );
}

function HighlightStrip({ items }: {
  items: { icon: string; label: string; value: string; sub?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((h, i) => (
        <div key={i} className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3">
          <div className="text-base mb-1">{h.icon}</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">{h.label}</div>
          <div className="text-sm font-black text-white leading-tight">{h.value}</div>
          {h.sub && <div className="text-[9px] text-slate-500 mt-0.5">{h.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function TabButton({ id, label, icon, active, onClick }: {
  id: TabId; label: string; icon: string; active: boolean; onClick: (id: TabId) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all whitespace-nowrap ${
        active
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

const LIGHTBOX_ROWS: { label: string; key: keyof EnergyData; unit: string; color: string }[] = [
  { label: 'PV Ertrag',        key: 'PV_Ertrag_kWh',            unit: 'kWh', color: 'text-amber-400' },
  { label: 'Netzbezug',        key: 'Netzbezug_kWh',            unit: 'kWh', color: 'text-rose-400' },
  { label: 'Einspeisung',      key: 'Netz_Einspeisung_kWh',     unit: 'kWh', color: 'text-sky-400' },
  { label: 'Akku geladen',     key: 'Akku_Geladen_kWh',         unit: 'kWh', color: 'text-violet-400' },
  { label: 'Akku entladen',    key: 'Akku_Entladen_kWh',        unit: 'kWh', color: 'text-violet-300' },
  { label: 'Stromkosten',      key: 'Kosten_Euro',              unit: '€',   color: 'text-red-400' },
  { label: 'Hausverbrauch',    key: 'Hausverbrauch_Berechnet_kWh', unit: 'kWh', color: 'text-slate-300' },
  { label: 'Heizung',          key: 'Heizung_kWh',              unit: 'kWh', color: 'text-orange-400' },
  { label: 'E-Auto Ladung',    key: 'E_Auto_Ladung_kWh',        unit: 'kWh', color: 'text-blue-400' },
  { label: 'Außentemperatur',  key: 'Temp_Aussen',              unit: '°C',  color: 'text-cyan-400' },
  { label: 'Bewölkung',        key: 'Bewoelkung_Proz',          unit: '%',   color: 'text-slate-400' },
  { label: 'PV Prognose',      key: 'PV_Prognose_Heute_kWh',    unit: 'kWh', color: 'text-amber-300' },
  { label: 'Speicher SOC',     key: 'Speicher_Inhalt_SOC_kWh',  unit: 'kWh', color: 'text-purple-400' },
  { label: 'Büro / Küche',     key: 'Buero_Kueche_kWh',         unit: 'kWh', color: 'text-purple-300' },
  { label: 'Gaming-PC',        key: 'Gaming_buero_kWh',         unit: 'kWh', color: 'text-pink-400' },
  { label: 'Waschmaschine',    key: 'Waschmaschine_kWh',        unit: 'kWh', color: 'text-yellow-400' },
];

function Lightbox({ data, onClose }: { data: LightboxData; onClose: () => void }) {
  const { day, monthAvg } = data;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-black text-white">{data.title}</h2>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{day.Wochentag}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <div className="space-y-0.5">
          {LIGHTBOX_ROWS.map(({ label, key, unit, color }) => {
            const val = num(day[key] as string);
            const avg = monthAvg[key] ?? 0;
            const diff = avg > 0 ? ((val - avg) / avg) * 100 : 0;
            const isEur = unit === '€';
            return (
              <div key={key} className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-xs text-slate-400">{label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black ${color}`}>
                    {fmt(val, isEur ? 2 : 1)} {unit}
                  </span>
                  {Math.abs(diff) > 15 && avg > 0.01 && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      diff > 0 ? 'bg-rose-900/50 text-rose-400' : 'bg-emerald-900/50 text-emerald-400'
                    }`}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-slate-600 mt-4 text-center">
          % = Abweichung vom Monatsdurchschnitt · ESC oder Klick außen zum Schließen
        </p>
      </div>
    </div>
  );
}

// ─── Energie Tab ──────────────────────────────────────────────────────────────

function EnergieTab({ stats, days, onDayClick }: {
  stats: ReturnType<typeof getMonthStats>;
  days: EnergyData[];
  onDayClick: (day: EnergyData) => void;
}) {
  if (!days.length) return <Card><p className="text-slate-500 text-center py-8">Keine Daten.</p></Card>;

  const bestPV     = days.reduce((b, r) => num(r.PV_Ertrag_kWh) > num(b.PV_Ertrag_kWh) ? r : b, days[0]);
  const mostGrid   = days.reduce((b, r) => num(r.Netzbezug_kWh) > num(b.Netzbezug_kWh) ? r : b, days[0]);
  const lowestCost = days.reduce((b, r) => num(r.Kosten_Euro) < num(b.Kosten_Euro) ? r : b, days[0]);
  const highFeed   = days.reduce((b, r) => num(r.Netz_Einspeisung_kWh) > num(b.Netz_Einspeisung_kWh) ? r : b, days[0]);

  const highlights = [
    { icon: '☀️', label: 'Bester PV-Tag', value: `${fmt(num(bestPV.PV_Ertrag_kWh))} kWh`, sub: bestPV.Datum },
    { icon: '🔌', label: 'Meist Netzbezug', value: `${fmt(num(mostGrid.Netzbezug_kWh))} kWh`, sub: mostGrid.Datum },
    { icon: '💸', label: 'Günstigster Tag', value: eur(num(lowestCost.Kosten_Euro)), sub: lowestCost.Datum },
    { icon: '⬆️', label: 'Meist Eingespeist', value: `${fmt(num(highFeed.Netz_Einspeisung_kWh))} kWh`, sub: highFeed.Datum },
  ];

  const chartData = days.map(r => ({
    tag: r.Datum.substring(0, 5),
    PV: num(r.PV_Ertrag_kWh),
    Netz: num(r.Netzbezug_kWh),
    Einspeisung: num(r.Netz_Einspeisung_kWh),
    Kosten: num(r.Kosten_Euro),
    Akku: num(r.Speicher_Inhalt_SOC_kWh),
    _row: r,
  }));

  const applianceData = [
    { name: 'Heizung',        value: days.reduce((s,r) => s+num(r.Heizung_kWh),0),         color: '#f97316' },
    { name: 'E-Auto',         value: days.reduce((s,r) => s+num(r.E_Auto_Ladung_kWh),0),   color: '#3b82f6' },
    { name: 'Büro/Küche',     value: days.reduce((s,r) => s+num(r.Buero_Kueche_kWh),0),    color: '#8b5cf6' },
    { name: 'Gaming-PC',      value: days.reduce((s,r) => s+num(r.Gaming_buero_kWh),0),    color: '#ec4899' },
    { name: 'Kühlschrank',    value: days.reduce((s,r) => s+num(r.Kuehlschrank_kWh),0),    color: '#06b6d4' },
    { name: 'Gefrierschrank', value: days.reduce((s,r) => s+num(r.Gefrierschrank_kWh),0),  color: '#14b8a6' },
    { name: 'Geschirrspüler', value: days.reduce((s,r) => s+num(r.Geschirrspueler_kWh),0), color: '#a3e635' },
    { name: 'Waschmaschine',  value: days.reduce((s,r) => s+num(r.Waschmaschine_kWh),0),   color: '#fbbf24' },
    { name: 'TV / WZ',        value: days.reduce((s,r) => s+num(r.TV_WZ_kWh),0),           color: '#f43f5e' },
  ].filter(d => d.value > 0).sort((a,b) => b.value - a.value);

  const handleClick = (data: any) => {
    const row = data?.activePayload?.[0]?.payload?._row;
    if (row) onDayClick(row);
  };

  return (
    <div className="space-y-6">
      <HighlightStrip items={highlights} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="PV Ertrag" value={fmt(stats.totalPV)} unit="kWh" icon="☀️" color="bg-amber-950/50 border-amber-800/30 text-amber-100" sub={`∅ ${fmt(stats.totalPV/stats.daysCount)} kWh/Tag`} />
        <StatCard label="Netzbezug" value={fmt(stats.totalGrid)} unit="kWh" icon="🔌" color="bg-rose-950/50 border-rose-800/30 text-rose-100" sub={`∅ ${fmt(stats.totalGrid/stats.daysCount)} kWh/Tag`} />
        <StatCard label="Einspeisung" value={fmt(stats.totalFeed)} unit="kWh" icon="⬆️" color="bg-sky-950/50 border-sky-800/30 text-sky-100" sub={`${eur(stats.feedRevenue)} Erlös`} />
        <StatCard label="Autarkiegrad" value={fmt(stats.autarky, 0)} unit="%" icon="🏡" color={stats.autarky >= 50 ? 'bg-emerald-950/50 border-emerald-800/30 text-emerald-100' : 'bg-slate-800/60 border-slate-700/50 text-slate-100'} sub={`Netto ${stats.netBalance >= 0 ? '+' : ''}${eur(stats.netBalance)}`} />
      </div>

      <Card>
        <SectionHeader>PV · Netzbezug · Einspeisung — auf Balken klicken für Tagesdetails</SectionHeader>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={2} onClick={handleClick} style={{ cursor: 'pointer' }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
            <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit=" kWh" width={50} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff08' }} />
            <Bar dataKey="PV" name="PV Ertrag" fill="#f59e0b" radius={[4,4,0,0]} maxBarSize={16} />
            <Bar dataKey="Netz" name="Netzbezug" fill="#f43f5e" radius={[4,4,0,0]} maxBarSize={16} />
            <Bar dataKey="Einspeisung" name="Einspeisung" fill="#38bdf8" radius={[4,4,0,0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeader>Speicher-Inhalt (kWh)</SectionHeader>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} onClick={handleClick} style={{ cursor: 'pointer' }}>
              <defs>
                <linearGradient id="akkuGradE" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit=" kWh" width={50} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="Akku" name="Speicher" stroke="#8b5cf6" strokeWidth={2} fill="url(#akkuGradE)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHeader>Tageskosten (€)</SectionHeader>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} onClick={handleClick} style={{ cursor: 'pointer' }}>
              <defs>
                <linearGradient id="kostenGradE" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit=" €" width={40} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${fmt(v, 2)} €`, 'Kosten']} />
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
              <PieChart>
                <Pie data={applianceData} innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {applianceData.map((e, i) => <Cell key={i} fill={e.color} />)}
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
      </Card>
    </div>
  );
}

// ─── Auto Tab ─────────────────────────────────────────────────────────────────

function AutoTab({ stats, days, onDayClick }: {
  stats: ReturnType<typeof getMonthStats>;
  days: EnergyData[];
  onDayClick: (day: EnergyData) => void;
}) {
  if (!days.length) return <Card><p className="text-slate-500 text-center py-8">Keine Daten.</p></Card>;

  const kmByDay = days.map((r, i) => {
    const prev = days[i - 1];
    const km = i === 0 ? 0 : Math.max(0, num(r.Auto_Kilometerstand) - num(prev.Auto_Kilometerstand));
    return { tag: r.Datum.substring(0, 5), km, laden: num(r.E_Auto_Ladung_kWh), reichweite: num(r.Auto_Reichweite_km), _row: r };
  });

  const mostKmEntry = kmByDay.reduce((b, r) => r.km > b.km ? r : b, kmByDay[0]);
  const mostCharge  = days.reduce((b, r) => num(r.E_Auto_Ladung_kWh) > num(b.E_Auto_Ladung_kWh) ? r : b, days[0]);
  const latest      = days[days.length - 1];

  const highlights = [
    { icon: '🏎️', label: 'Meiste km an einem Tag', value: `${fmt(mostKmEntry.km, 0)} km`, sub: mostKmEntry.tag },
    { icon: '⚡', label: 'Meiste Ladung an einem Tag', value: `${fmt(num(mostCharge.E_Auto_Ladung_kWh))} kWh`, sub: mostCharge.Datum },
    { icon: '🔋', label: 'Aktuelle Reichweite', value: `${latest.Auto_Reichweite_km} km`, sub: 'Jetzt' },
    { icon: '📍', label: 'Kilometerstand', value: `${parseInt(latest.Auto_Kilometerstand || '0').toLocaleString('de-AT')} km`, sub: 'Odometer' },
  ];

  const handleClick = (data: any) => {
    const row = data?.activePayload?.[0]?.payload?._row;
    if (row) onDayClick(row);
  };

  const efficienz = stats.totalKm > 0 ? stats.totalCar / stats.totalKm * 100 : 0;

  return (
    <div className="space-y-6">
      <HighlightStrip items={highlights} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Gefahrene km" value={fmt(stats.totalKm, 0)} unit="km" icon="🚗" color="bg-blue-950/50 border-blue-800/30 text-blue-100" sub={`∅ ${fmt(stats.totalKm/stats.daysCount, 1)} km/Tag`} />
        <StatCard label="E-Auto Ladung" value={fmt(stats.totalCar)} unit="kWh" icon="⚡" color="bg-indigo-950/50 border-indigo-800/30 text-indigo-100" sub={`∅ ${fmt(stats.totalCar/stats.daysCount)} kWh/Tag`} />
        <StatCard label="Ø Verbrauch" value={stats.totalKm > 0 ? fmt(efficienz, 1) : '–'} unit="kWh/100km" icon="📊" color="bg-slate-800/60 border-slate-700/50 text-slate-100" sub="Effizienz" />
        <StatCard label="Reichweite" value={latest.Auto_Reichweite_km || '–'} unit="km" icon="🔋" color="bg-teal-950/50 border-teal-800/30 text-teal-100" sub="Aktuell" />
      </div>

      <Card>
        <SectionHeader>Tages-km & Ladung — klicken für Details</SectionHeader>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={kmByDay} barGap={4} onClick={handleClick} style={{ cursor: 'pointer' }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
            <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="km" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit=" km" width={45} />
            <YAxis yAxisId="kwh" orientation="right" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit=" kWh" width={45} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff08' }} />
            <Bar yAxisId="km" dataKey="km" name="Gefahrene km" fill="#3b82f6" radius={[4,4,0,0]} maxBarSize={18} />
            <Bar yAxisId="kwh" dataKey="laden" name="Geladen kWh" fill="#22d3ee" radius={[4,4,0,0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <SectionHeader>Reichweite (km)</SectionHeader>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={kmByDay} onClick={handleClick} style={{ cursor: 'pointer' }}>
            <defs>
              <linearGradient id="reichweiteGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
            <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit=" km" width={50} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="reichweite" name="Reichweite" stroke="#3b82f6" strokeWidth={2} fill="url(#reichweiteGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ─── Temperaturen Tab ─────────────────────────────────────────────────────────

function TemperaturenTab({ days, onDayClick }: {
  days: EnergyData[];
  onDayClick: (day: EnergyData) => void;
}) {
  if (!days.length) return <Card><p className="text-slate-500 text-center py-8">Keine Daten.</p></Card>;

  const latest  = days[days.length - 1];
  const hottest = days.reduce((b, r) => num(r.Temp_Aussen) > num(b.Temp_Aussen) ? r : b, days[0]);
  const coldest = days.reduce((b, r) => num(r.Temp_Aussen) < num(b.Temp_Aussen) ? r : b, days[0]);
  const mostHeat = days.reduce((b, r) => num(r.Heizung_kWh) > num(b.Heizung_kWh) ? r : b, days[0]);
  const avgHumid = days.reduce((s,r) => s + num(r.Luftfeuchte_Schlafzimmer_Proz), 0) / days.length;

  const highlights = [
    { icon: '🌡️', label: 'Wärmster Tag', value: `${fmt(num(hottest.Temp_Aussen))}°C`, sub: hottest.Datum },
    { icon: '🥶', label: 'Kältester Tag', value: `${fmt(num(coldest.Temp_Aussen))}°C`, sub: coldest.Datum },
    { icon: '🔥', label: 'Meiste Heizung', value: `${fmt(num(mostHeat.Heizung_kWh))} kWh`, sub: mostHeat.Datum },
    { icon: '💧', label: 'Ø Luftfeuchte', value: `${fmt(avgHumid, 0)}%`, sub: 'Schlafzimmer' },
  ];

  const chartData = days.map(r => ({
    tag: r.Datum.substring(0, 5),
    aussen: num(r.Temp_Aussen),
    bewoelkung: num(r.Bewoelkung_Proz),
    heizung: num(r.Heizung_kWh),
    feucht: num(r.Luftfeuchte_Schlafzimmer_Proz),
    _row: r,
  }));

  const handleClick = (data: any) => {
    const row = data?.activePayload?.[0]?.payload?._row;
    if (row) onDayClick(row);
  };

  return (
    <div className="space-y-6">
      <HighlightStrip items={highlights} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Außen aktuell', value: `${fmt(num(latest.Temp_Aussen))}°`, sub: `☁️ ${latest.Bewoelkung_Proz}%`, color: 'text-sky-400' },
          { label: 'Wasserbett Papa', value: `${fmt(num(latest.Temp_Wasserbett_Papa))}°`, sub: 'Temperatur', color: 'text-pink-400' },
          { label: 'Wasserbett Mama', value: `${fmt(num(latest.Temp_Wasserbett_Mama))}°`, sub: 'Temperatur', color: 'text-pink-300' },
          { label: 'Luftfeuchte SZ', value: `${latest.Luftfeuchte_Schlafzimmer_Proz}%`, sub: 'Schlafzimmer', color: 'text-teal-400' },
        ].map((b, i) => (
          <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 text-center">
            <div className="text-[9px] uppercase font-black text-slate-500 mb-1">{b.label}</div>
            <div className={`text-3xl font-black ${b.color}`}>{b.value}</div>
            <div className="text-[10px] text-slate-500 mt-1">{b.sub}</div>
          </div>
        ))}
      </div>

      <Card>
        <SectionHeader>Außentemperatur & Bewölkung — klicken für Details</SectionHeader>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} onClick={handleClick} style={{ cursor: 'pointer' }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
            <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="temp" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit="°" width={35} />
            <YAxis yAxisId="cloud" orientation="right" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit="%" width={35} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line yAxisId="temp" type="monotone" dataKey="aussen" name="Außentemp" stroke="#38bdf8" strokeWidth={2} dot={false} />
            <Line yAxisId="cloud" type="monotone" dataKey="bewoelkung" name="Bewölkung" stroke="#475569" strokeWidth={1} strokeDasharray="4 2" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeader>Heizungsverbrauch (kWh)</SectionHeader>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} onClick={handleClick} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit=" kWh" width={45} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="heizung" name="Heizung" fill="#f97316" radius={[4,4,0,0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHeader>Luftfeuchte Schlafzimmer (%)</SectionHeader>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} onClick={handleClick} style={{ cursor: 'pointer' }}>
              <defs>
                <linearGradient id="feuchtGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit="%" width={35} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="feucht" name="Luftfeuchte" stroke="#14b8a6" strokeWidth={2} fill="url(#feuchtGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ─── Tagesansicht Tab ─────────────────────────────────────────────────────────

const TABLE_COLS: { label: string; key: keyof EnergyData; unit: string; color: string }[] = [
  { label: 'Uhrzeit',      key: 'created',                     unit: '',     color: 'text-slate-400' },
  { label: 'PV',           key: 'PV_Ertrag_kWh',               unit: 'kWh',  color: 'text-amber-400' },
  { label: 'Netz',         key: 'Netzbezug_kWh',               unit: 'kWh',  color: 'text-rose-400' },
  { label: 'Einspeis.',    key: 'Netz_Einspeisung_kWh',        unit: 'kWh',  color: 'text-sky-400' },
  { label: 'Kosten',       key: 'Kosten_Euro',                 unit: '€',    color: 'text-red-300' },
  { label: 'SOC kWh',      key: 'Speicher_Inhalt_SOC_kWh',     unit: 'kWh',  color: 'text-violet-400' },
  { label: 'Hausverbr.',   key: 'Hausverbrauch_Berechnet_kWh', unit: 'kWh',  color: 'text-slate-300' },
  { label: 'Heizung',      key: 'Heizung_kWh',                 unit: 'kWh',  color: 'text-orange-400' },
  { label: 'E-Auto',       key: 'E_Auto_Ladung_kWh',           unit: 'kWh',  color: 'text-blue-400' },
  { label: 'Außen °C',     key: 'Temp_Aussen',                 unit: '°',    color: 'text-cyan-400' },
  { label: 'Prognose',     key: 'PV_Prognose_Heute_kWh',       unit: 'kWh',  color: 'text-amber-300' },
  { label: 'Roboter m²',   key: 'Roboter_Flaeche_m2',          unit: 'm²',   color: 'text-teal-400' },
];

function TagesansichtTab({ monthRows, days, selectedDay, setSelectedDay }: {
  monthRows: EnergyData[];
  days: EnergyData[];
  selectedDay: string;
  setSelectedDay: (d: string) => void;
}) {
  const dayRows = monthRows
    .filter(r => r.Datum === selectedDay)
    .sort((a, b) => (a.created < b.created ? -1 : 1));

  return (
    <div className="space-y-4">
      {/* Day selector */}
      <div className="flex items-start gap-3 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">Tag wählen:</span>
        <div className="flex gap-2 flex-wrap">
          {days.map(d => (
            <button
              key={d.Datum}
              onClick={() => setSelectedDay(d.Datum)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                d.Datum === selectedDay
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {d.Datum.substring(0, 5)}
            </button>
          ))}
        </div>
      </div>

      {dayRows.length === 0 ? (
        <Card>
          <p className="text-slate-500 text-center py-8">Kein Tag ausgewählt oder keine Daten vorhanden.</p>
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="p-5 pb-3 border-b border-slate-800">
            <SectionHeader>Stundenwerte · {selectedDay} · {dayRows[0]?.Wochentag} · {dayRows.length} Einträge</SectionHeader>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40">
                  {TABLE_COLS.map(c => (
                    <th key={c.key} className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayRows.map((row, i) => (
                  <tr key={i} className={`border-b border-slate-800/40 transition-colors hover:bg-slate-800/30 ${i % 2 === 0 ? '' : 'bg-slate-800/15'}`}>
                    {TABLE_COLS.map(c => (
                      <td key={c.key} className={`px-4 py-2 font-bold whitespace-nowrap ${c.color}`}>
                        {c.key === 'created'
                          ? String(row[c.key] ?? '').substring(11, 16)
                          : `${fmt(num(row[c.key] as string), c.unit === '€' ? 2 : 1)}${c.unit}`
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'uebersicht',   label: 'Übersicht',    icon: '🏡' },
  { id: 'energie',      label: 'Energie',       icon: '⚡' },
  { id: 'auto',         label: 'Auto',          icon: '🚗' },
  { id: 'temperaturen', label: 'Temperaturen',  icon: '🌡️' },
  { id: 'tagesansicht', label: 'Tagesansicht',  icon: '📋' },
];

export default function Dashboard() {
  const [allData, setAllData]             = useState<EnergyData[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [lastUpdated, setLastUpdated]     = useState('');
  const [activeTab, setActiveTab]         = useState<TabId>('uebersicht');
  const [selectedMonthKey, setSelectedMonthKey] = useState(''); // 'MM.YYYY'
  const [selectedDay, setSelectedDay]     = useState('');
  const [lightbox, setLightbox]           = useState<LightboxData | null>(null);

  // Fetch data
  useEffect(() => {
    fetch('/api/data')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: EnergyData[]) => {
        setAllData(data);
        setLastUpdated(new Date().toLocaleTimeString('de-AT'));
        const latest = data[data.length - 1];
        if (latest) {
          const [, m, y] = latest.Datum.split('.');
          setSelectedMonthKey(`${m}.${y}`);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ESC closes lightbox
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // Available months
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    allData.forEach(r => {
      const [, m, y] = r.Datum.split('.');
      set.add(`${m}.${y}`);
    });
    return Array.from(set).sort((a, b) => {
      const [am, ay] = a.split('.').map(Number);
      const [bm, by] = b.split('.').map(Number);
      return ay !== by ? ay - by : am - bm;
    });
  }, [allData]);

  // Filtered data for selected month
  const { monthRows, days, stats, monthLabel } = useMemo(() => {
    if (!allData.length || !selectedMonthKey) return { monthRows: [], days: [], stats: null, monthLabel: '' };
    const [m, y] = selectedMonthKey.split('.');
    const monthRows = allData.filter(r => {
      const [, rm, ry] = r.Datum.split('.');
      return rm === m && ry === y;
    });
    const days = getDailyFinal(monthRows);
    const stats = getMonthStats(days);
    const monthLabel = `${MONTHS_DE[parseInt(m) - 1]} ${y}`;
    return { monthRows, days, stats, monthLabel };
  }, [allData, selectedMonthKey]);

  // Default selected day = last day of month
  useEffect(() => {
    if (days.length > 0) setSelectedDay(days[days.length - 1].Datum);
  }, [days]);

  // Month averages for lightbox comparison
  const monthAvg = useMemo(() => {
    if (!days.length) return {};
    const keys: (keyof EnergyData)[] = [
      'PV_Ertrag_kWh', 'Netzbezug_kWh', 'Netz_Einspeisung_kWh', 'Akku_Geladen_kWh',
      'Akku_Entladen_kWh', 'Kosten_Euro', 'Hausverbrauch_Berechnet_kWh', 'Heizung_kWh',
      'E_Auto_Ladung_kWh', 'Temp_Aussen', 'Bewoelkung_Proz', 'PV_Prognose_Heute_kWh',
      'Speicher_Inhalt_SOC_kWh', 'Buero_Kueche_kWh', 'Gaming_buero_kWh', 'Waschmaschine_kWh',
    ];
    return Object.fromEntries(
      keys.map(k => [k, days.reduce((s, r) => s + num(r[k] as string), 0) / days.length])
    );
  }, [days]);

  const handleDayClick = useCallback((day: EnergyData) => {
    setLightbox({ title: day.Datum, day, monthAvg });
  }, [monthAvg]);

  const latest  = days[days.length - 1];
  const insights = useMemo(() => stats && days.length ? generateInsights(stats, days) : [], [stats, days]);

  // ── Loading / Error ──
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-emerald-400 font-mono text-xs uppercase tracking-widest">Lade Energiedaten…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-red-400 text-center">
        <div className="text-4xl mb-4">⚡</div>
        <p className="font-bold">Fehler beim Laden der Daten</p>
        <p className="text-sm opacity-60 mt-1">{error}</p>
      </div>
    </div>
  );

  if (!stats || !latest) return null;

  const accu1       = num(latest.SOC_Akku1_Proz);
  const accu2       = num(latest.SOC_Akku2_Proz);
  const accuContent = num(latest.Speicher_Inhalt_SOC_kWh);

  // Overview charts data
  const overviewChartData = days.map(r => ({
    tag: r.Datum.substring(0, 5),
    PV: num(r.PV_Ertrag_kWh),
    Netz: num(r.Netzbezug_kWh),
    Akku: num(r.Speicher_Inhalt_SOC_kWh),
    _row: r,
  }));

  const handleOverviewClick = (data: any) => {
    const row = data?.activePayload?.[0]?.payload?._row;
    if (row) handleDayClick(row);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-lg shadow-lg shadow-emerald-500/20">⚡</div>
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
            {/* Month filter */}
            <select
              value={selectedMonthKey}
              onChange={e => setSelectedMonthKey(e.target.value)}
              className="bg-emerald-900/40 border border-emerald-700/30 text-emerald-400 text-[11px] font-black rounded-lg px-3 py-2 outline-none cursor-pointer"
            >
              {availableMonths.map(mk => {
                const [m, y] = mk.split('.');
                return <option key={mk} value={mk}>{MONTHS_DE[parseInt(m) - 1]} {y}</option>;
              })}
            </select>
          </div>
        </div>
      </header>

      {/* ── Tab Bar ── */}
      <div className="sticky top-16 z-20 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-5 py-2.5 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(t => {
            const isActive = activeTab === t.id;
            return (
              <React.Fragment key={t.id}>
                <TabButton id={t.id} label={t.label} icon={t.icon} active={isActive} onClick={setActiveTab} />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="max-w-7xl mx-auto px-5 py-8">

        {/* ────── ÜBERSICHT ────── */}
        {activeTab === 'uebersicht' && (
          <div className="space-y-8">

            {/* KPI Cards */}
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
                Monatsübersicht · {monthLabel} · {stats.daysCount} Tage erfasst
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Stromkosten" value={fmt(stats.totalKosten, 2)} unit="€" icon="🧾" color="bg-rose-950/50 border-rose-800/30 text-rose-100" sub={`∅ ${fmt(stats.totalKosten/stats.daysCount, 2)} €/Tag`} />
                <StatCard label="PV Ertrag" value={fmt(stats.totalPV)} unit="kWh" icon="☀️" color="bg-amber-950/50 border-amber-800/30 text-amber-100" sub={`∅ ${fmt(stats.totalPV/stats.daysCount)} kWh/Tag`} />
                <StatCard label="Autarkiegrad" value={fmt(stats.autarky, 0)} unit="%" icon="🏡" color={stats.autarky >= 50 ? 'bg-emerald-950/50 border-emerald-800/30 text-emerald-100' : 'bg-slate-800/60 border-slate-700/50 text-slate-100'} sub={`Netzbezug ${fmt(stats.totalGrid)} kWh`} />
                <StatCard label="PV-Ersparnis" value={fmt(stats.pvSavings, 2)} unit="€" icon="💰" color="bg-green-950/50 border-green-800/30 text-green-100" sub={`+ ${fmt(stats.feedRevenue, 2)} € Einspeisung`} />
              </div>
            </section>

            {/* KI Monatsanalyse */}
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
                🤖 KI-Monatsanalyse · {monthLabel}
              </h2>
              <div className="bg-slate-900/60 border border-emerald-900/40 rounded-2xl p-5 space-y-3">
                {insights.map((ins, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                    <p className="text-sm text-slate-300 leading-relaxed">{ins}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Highlights row */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Energie-Bilanz */}
              <div className={`rounded-2xl p-5 border ${stats.netBalance >= 0 ? 'bg-emerald-950/40 border-emerald-700/30' : 'bg-slate-800/60 border-slate-700/50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⚡</span>
                  <span className="text-[11px] font-black uppercase tracking-widest opacity-60">Energie-Bilanz</span>
                </div>
                <div className="divide-y divide-white/5">
                  <Pill label="PV Ertrag" value={`${fmt(stats.totalPV)} kWh`} color="text-amber-400" />
                  <Pill label="Netzbezug" value={`${fmt(stats.totalGrid)} kWh`} color="text-rose-400" />
                  <Pill label="Einspeisung" value={`${fmt(stats.totalFeed)} kWh`} color="text-sky-400" />
                  <Pill label="Akku geladen" value={`${fmt(stats.totalCharge)} kWh`} color="text-violet-400" />
                  <Pill label="Akku entladen" value={`${fmt(stats.totalDischarge)} kWh`} color="text-violet-300" />
                </div>
                <div className={`mt-4 p-3 rounded-xl text-center ${stats.netBalance >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  <div className="text-[10px] uppercase font-black tracking-widest opacity-60">Netto-Bilanz</div>
                  <div className="text-xl font-black mt-0.5">{stats.netBalance >= 0 ? '+' : ''}{eur(stats.netBalance)}</div>
                </div>
              </div>

              {/* Aktueller Stand */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📡</span>
                  <span className="text-[11px] font-black uppercase tracking-widest opacity-60">Aktueller Stand</span>
                </div>
                <div className="space-y-3 mb-4">
                  {[{ label: 'Akku 1', val: accu1 }, { label: 'Akku 2', val: accu2 }].map(b => (
                    <div key={b.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">{b.label}</span>
                        <span className="font-black text-violet-400">{b.val}%</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${b.val}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="text-center pt-1">
                    <div className="text-[10px] uppercase text-slate-500 font-bold">Speicher-Inhalt</div>
                    <div className="text-2xl font-black text-violet-300">{fmt(accuContent)} <span className="text-sm">kWh</span></div>
                    <div className="text-[9px] text-slate-500 mt-0.5">
                      nutzbar: {fmt(Math.max(0, accuContent - 1.23))} kWh · max 10,24 kWh
                    </div>
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
              </div>

              {/* Auto */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🚗</span>
                  <span className="text-[11px] font-black uppercase tracking-widest opacity-60">Renault 4 E-Tech</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-slate-400">Reichweite</span>
                  <span className="text-2xl font-black text-blue-400">{latest.Auto_Reichweite_km} <span className="text-sm">km</span></span>
                </div>
                <div className="divide-y divide-white/5">
                  <Pill label="Geladene Energie (Monat)" value={`${fmt(stats.totalCar)} kWh`} color="text-blue-400" />
                  <Pill label="Gefahrene km (Monat)" value={`${fmt(stats.totalKm, 0)} km`} color="text-blue-300" />
                  <Pill label="Kilometerstand" value={`${parseInt(latest.Auto_Kilometerstand || '0').toLocaleString('de-AT')} km`} color="text-slate-300" />
                </div>
              </div>
            </section>

            {/* Overview Charts */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <SectionHeader>PV Ertrag vs. Netzbezug — klicken für Details</SectionHeader>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={overviewChartData} barGap={2} onClick={handleOverviewClick} style={{ cursor: 'pointer' }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit=" kWh" width={50} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff08' }} />
                    <Bar dataKey="PV" name="PV Ertrag" fill="#f59e0b" radius={[4,4,0,0]} maxBarSize={20} />
                    <Bar dataKey="Netz" name="Netzbezug" fill="#f43f5e" radius={[4,4,0,0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <SectionHeader>Speicher-Inhalt (kWh) — klicken für Details</SectionHeader>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={overviewChartData} onClick={handleOverviewClick} style={{ cursor: 'pointer' }}>
                    <defs>
                      <linearGradient id="akkuGradO" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} unit=" kWh" width={50} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="Akku" name="Speicher-Inhalt" stroke="#8b5cf6" strokeWidth={2} fill="url(#akkuGradO)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </section>

          </div>
        )}

        {activeTab === 'energie'      && <EnergieTab stats={stats} days={days} onDayClick={handleDayClick} />}
        {activeTab === 'auto'         && <AutoTab stats={stats} days={days} onDayClick={handleDayClick} />}
        {activeTab === 'temperaturen' && <TemperaturenTab days={days} onDayClick={handleDayClick} />}
        {activeTab === 'tagesansicht' && (
          <TagesansichtTab
            monthRows={monthRows}
            days={days}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
          />
        )}

      </main>

      <footer className="max-w-7xl mx-auto px-5 py-6 text-center">
        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
          Haus Tirol · Smart Home Energy Dashboard · Daten via HomeAssistant
        </p>
      </footer>

      {lightbox && <Lightbox data={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
