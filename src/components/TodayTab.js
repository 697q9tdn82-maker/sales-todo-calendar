import { useMemo, useState } from "react";
import { C, PRIORITIES, PRODUCTS, MILESTONES } from "../constants";
import { addDays, bizInfo, byPriority, fmtMD, isDoneTodo, parseQuick } from "../utils";
import TaskRow from "./TaskRow";

const card = { background: C.panel, borderRadius: 14, border: `1px solid ${C.line}`, padding: "12px 14px" };
const yen = (n) => { const v = Number(n) || 0; return v >= 10000 ? (v / 10000).toFixed(1).replace(/\.0$/, "") + "万" : v.toLocaleString(); };

function Section({ title, count, open, onToggle, right, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <button onClick={onToggle} disabled={!onToggle} style={{
          background: "none", border: "none", padding: 0, cursor: onToggle ? "pointer" : "default",
          color: C.text, fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", gap: 6,
        }}>
          {onToggle && <span style={{ color: C.sub, fontSize: 11 }}>{open ? "▾" : "▸"}</span>}
          {title}<span style={{ color: C.sub, fontWeight: 600, fontSize: 12 }}>{count}件</span>
        </button>
        <div style={{ marginLeft: "auto" }}>{right}</div>
      </div>
      {open && children}
    </div>
  );
}

// ── TOP: 今日やること ─────────────────────────────────
export default function TodayTab({ today, todos, reports, board, onQuickAdd, onToggle, onOpen, onAddReport, onDeleteReport, onDeleteDone, onExport }) {
  const [q, setQ] = useState("");
  const [rep, setRep] = useState("");
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [search, setSearch] = useState("");

  const parsed = q.trim() ? parseQuick(q, today) : null;
  const biz = bizInfo(today);

  const { todayList, upcoming, doneList } = useMemo(() => {
    const open = todos.filter((t) => !isDoneTodo(t));
    return {
      todayList: open.filter((t) => t.date <= today).sort(byPriority),
      upcoming: open.filter((t) => t.date > today).sort((a, b) => a.date.localeCompare(b.date) || byPriority(a, b)),
      doneList: todos.filter(isDoneTodo).sort((a, b) => (b.doneAt || b.date || "").localeCompare(a.doneAt || a.date || "")),
    };
  }, [todos, today]);

  const qs = search.trim().toLowerCase();
  const upcomingShown = qs ? upcoming.filter((t) => ((t.title || "") + (t.note || "")).toLowerCase().includes(qs)) : upcoming;
  const todayReports = reports.filter((r) => r.date === today);
  const highCount = todayList.filter((t) => t.priority === "high").length;

  function submitQuick() {
    if (!parsed || !parsed.title) return;
    onQuickAdd(parsed);
    setQ("");
  }
  function submitReport() {
    const names = rep.split(/[、,，\s]+/).map((s) => s.trim()).filter(Boolean);
    names.forEach((n) => onAddReport(n));
    setRep("");
  }

  // 今月の進捗(ボード)
  const mLabel = `${Number(today.slice(5, 7))}月`;
  const progress = (board?.products || []).map((p) => {
    const tgt = Number(p.monthlyTargets?.[mLabel]) || 0;
    const res = Number(p.monthlyResults?.[mLabel]) || 0;
    const next = (MILESTONES[p.key] || []).find((m) => Math.round(tgt * m.pct / 100) > res);
    return { ...p, tgt, res, pct: tgt > 0 ? Math.round(res / tgt * 100) : 0, next,
      color: PRODUCTS.find((x) => x.key === p.key)?.color || C.sub };
  }).filter((p) => p.tgt > 0);

  // 今後のタスクを日付ごとにまとめる
  const groups = [];
  upcomingShown.forEach((t) => {
    const g = groups[groups.length - 1];
    if (g && g.date === t.date) g.items.push(t); else groups.push({ date: t.date, items: [t] });
  });

  return (
    <div>
      {/* ── 日付・営業日 ── */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{fmtMD(today)}</div>
        <div style={{ fontSize: 12, color: C.sub }}>
          {biz.isBiz ? <><b style={{ color: C.gold }}>{biz.passed}</b>営業日目</> : "休日"}　残り<b style={{ color: "#FF9500" }}>{biz.remain}</b>日／月{biz.total}日
        </div>
      </div>

      {/* ── 一言入力 ── */}
      <div style={{ ...card, padding: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submitQuick(); }}
            placeholder="明日 山田商事 折り返し ／ !!田中 至急電話"
            style={{ flex: 1, minWidth: 0, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "11px 12px", color: C.text, fontSize: 15, outline: "none" }} />
          <button onClick={submitQuick} disabled={!parsed?.title} style={{
            border: "none", borderRadius: 10, padding: "0 16px", fontSize: 14, fontWeight: 800, cursor: "pointer",
            background: parsed?.title ? C.grad : C.line, color: parsed?.title ? C.bg : C.sub,
          }}>追加</button>
        </div>
        <div style={{ fontSize: 11, color: C.sub, marginTop: 6, minHeight: 15 }}>
          {parsed?.title
            ? <>→ <b style={{ color: C.text }}>{parsed.title}</b>　📅 {fmtMD(parsed.date)}　<span style={{ color: PRIORITIES[parsed.priority].color }}>● {PRIORITIES[parsed.priority].label}</span></>
            : <>日付は「明日・金曜・11/20」など、「!」で重要、「!!」で緊急</>}
        </div>
      </div>

      {/* ── 今日 ── */}
      <Section title="今日やること" count={todayList.length} open
        right={highCount > 0 && <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>緊急 {highCount}</span>}>
        {todayList.length === 0
          ? <div style={{ ...card, textAlign: "center", color: C.sub, fontSize: 13, padding: 22 }}>🎉 今日のタスクは全部おわり！</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {todayList.map((t) => <TaskRow key={t.id} todo={t} onToggle={onToggle} onOpen={onOpen} />)}
            </div>}
      </Section>

      {/* ── 報告書 ── */}
      <div style={{ ...card, marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>📝 本日提出の報告書 <span style={{ color: C.sub, fontWeight: 600, fontSize: 12 }}>{todayReports.length}社</span></div>
          <button onClick={onExport} style={{
            marginLeft: "auto", padding: "6px 11px", borderRadius: 9, border: "1px solid #34D39960",
            background: "#34D39918", color: "#34D399", fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}>📥 今西さん提出用</button>
        </div>
        {todayReports.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {todayReports.map((r) => (
              <span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 16, padding: "4px 6px 4px 11px", fontSize: 12 }}>
                {r.name}
                <button onClick={() => onDeleteReport(r.id)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 13, padding: "0 2px" }}>×</button>
              </span>
            ))}
          </div>
        )}
        <input value={rep} onChange={(e) => setRep(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submitReport(); }}
          placeholder="会社名を入力してEnter（「、」区切りで複数OK）"
          style={{ width: "100%", boxSizing: "border-box", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 11px", color: C.text, fontSize: 13, outline: "none" }} />
      </div>

      {/* ── 今月の進捗 ── */}
      {progress.length > 0 && (
        <div style={{ ...card, marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>📊 {mLabel}の進捗</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {progress.map((p) => (
              <div key={p.key}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12 }}>
                  <span style={{ color: p.color, fontWeight: 800, minWidth: 56 }}>{p.label}</span>
                  <span style={{ fontWeight: 800, color: p.pct >= 100 ? C.gold : C.text }}>{p.pct}%</span>
                  <span style={{ color: C.sub }}>{yen(p.res)}/{yen(p.tgt)}</span>
                  {p.next && <span style={{ marginLeft: "auto", color: "#FBBF24", fontSize: 11 }}>{p.next.day}営業日{p.next.pct}%まで あと{yen(Math.round(p.tgt * p.next.pct / 100) - p.res)}</span>}
                </div>
                <div style={{ height: 5, background: C.panel2, borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
                  <div style={{ height: "100%", width: `${Math.min(p.pct, 100)}%`, background: p.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 今後 ── */}
      <Section title="今後のタスク" count={upcoming.length} open={showUpcoming} onToggle={() => setShowUpcoming(!showUpcoming)}>
        {upcoming.length > 5 && (
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 検索"
            style={{ width: "100%", boxSizing: "border-box", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 11px", color: C.text, fontSize: 13, outline: "none", marginBottom: 8 }} />
        )}
        {groups.length === 0 && <div style={{ color: C.dim, fontSize: 12, padding: "4px 2px" }}>なし</div>}
        {groups.map((g) => (
          <div key={g.date} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: g.date === addDays(today, 1) ? C.gold : C.sub, fontWeight: 700, margin: "0 2px 5px" }}>
              {fmtMD(g.date)}{g.date === addDays(today, 1) && "　明日"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.items.map((t) => <TaskRow key={t.id} todo={t} onToggle={onToggle} onOpen={onOpen} />)}
            </div>
          </div>
        ))}
      </Section>

      {/* ── 完了 ── */}
      <Section title="完了" count={doneList.length} open={showDone} onToggle={() => setShowDone(!showDone)}
        right={doneList.length > 0 && (
          <button onClick={onDeleteDone} style={{ background: "none", border: `1px solid ${C.red}55`, color: C.red, borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
            まとめて削除
          </button>
        )}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {doneList.map((t) => <TaskRow key={t.id} todo={t} onToggle={onToggle} onOpen={onOpen} showDate />)}
        </div>
      </Section>
    </div>
  );
}
