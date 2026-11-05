import { useState } from "react";
import { C, DAYS_JP, PRIORITIES } from "../constants";
import { byPriority, dowOf, fmtMD, isBizDayStr, isDoneTodo, makeDateStr } from "../utils";
import TaskRow from "./TaskRow";

// ── カレンダー: 月表示 + 選んだ日のタスク ─────────────
export default function CalendarTab({ today, todos, onToggle, onOpen, onAddOn }) {
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [sel, setSel] = useState(today);

  const first = dowOf(makeDateStr(ym.y, ym.m, 1));
  const days  = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const byDate = {};
  todos.forEach((t) => { (byDate[t.date] = byDate[t.date] || []).push(t); });
  const selList = (byDate[sel] || []).slice().sort((a, b) => (isDoneTodo(a) - isDoneTodo(b)) || byPriority(a, b));

  const move = (n) => setYm(({ y, m }) => { const mm = m + n; return { y: y + Math.floor(mm / 12), m: ((mm % 12) + 12) % 12 }; });
  const navBtn = { background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, width: 34, height: 30, cursor: "pointer", color: C.text, fontSize: 16 };

  return (
    <div>
      <div style={{ background: C.panel, borderRadius: 16, border: `1px solid ${C.line}`, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: `1px solid ${C.line}` }}>
          <button onClick={() => move(-1)} style={navBtn}>‹</button>
          <button onClick={() => { setYm({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }); setSel(today); }}
            style={{ background: "none", border: "none", color: C.text, fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
            {ym.y}年{ym.m + 1}月
          </button>
          <button onClick={() => move(1)} style={navBtn}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", textAlign: "center" }}>
          {DAYS_JP.map((d, i) => (
            <div key={d} style={{ padding: "6px 0", fontSize: 11, fontWeight: 700, color: i === 0 ? C.red : i === 6 ? "#4FC3F7" : C.sub }}>{d}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={"e" + i} style={{ minHeight: 58, borderTop: `1px solid ${C.chip}` }} />;
            const ds = makeDateStr(ym.y, ym.m, d);
            const list = byDate[ds] || [];
            const open = list.filter((t) => !isDoneTodo(t));
            const isToday = ds === today, isSel = ds === sel;
            const w = (first + d - 1) % 7;
            const holiday = !isBizDayStr(ds) && w !== 0 && w !== 6;
            return (
              <div key={ds} onClick={() => setSel(ds)} style={{
                minHeight: 58, padding: "4px 2px", cursor: "pointer", borderTop: `1px solid ${C.chip}`,
                background: isSel ? "#223354" : "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: isToday ? 900 : 500,
                  background: isToday ? C.grad : "transparent",
                  color: isToday ? C.bg : (w === 0 || holiday) ? C.red : w === 6 ? "#4FC3F7" : C.text,
                }}>{d}</div>
                {open.length > 0 && (
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center", maxWidth: 40 }}>
                    {open.slice(0, 4).map((t) => (
                      <span key={t.id} style={{ width: 6, height: 6, borderRadius: "50%", background: (PRIORITIES[t.priority] || PRIORITIES.low).color }} />
                    ))}
                    {open.length > 4 && <span style={{ fontSize: 8, color: C.sub, lineHeight: "6px" }}>+</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", margin: "16px 2px 8px" }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{fmtMD(sel)}{sel === today && <span style={{ color: C.gold, fontSize: 12, marginLeft: 6 }}>今日</span>}</div>
        <span style={{ color: C.sub, fontSize: 12, marginLeft: 8 }}>{selList.length}件</span>
        <button onClick={() => onAddOn(sel)} style={{
          marginLeft: "auto", padding: "6px 12px", borderRadius: 9, border: `1px dashed ${C.line}`, background: "transparent",
          color: C.sub, fontSize: 12, cursor: "pointer",
        }}>＋ この日に追加</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {selList.length === 0 && <div style={{ color: C.dim, fontSize: 12, padding: "6px 2px" }}>タスクなし</div>}
        {selList.map((t) => <TaskRow key={t.id} todo={t} onToggle={onToggle} onOpen={onOpen} />)}
      </div>
    </div>
  );
}
