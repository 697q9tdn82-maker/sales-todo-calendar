import { useState } from "react";
import { C, PRIORITIES, STATUSES, REPEATS, ACTION_CATEGORIES, PRODUCT_CATEGORIES, CONTACT_CATEGORIES } from "../constants";
import { addDays, fmtMD, getCats, todoStatus } from "../utils";

const label = { fontSize: 11, color: C.sub, display: "block", marginBottom: 6, fontWeight: 700 };
const input = {
  width: "100%", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10,
  padding: "11px 14px", color: C.text, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
function Seg({ items, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {items.map(([k, text, color]) => {
        const on = value === k;
        return (
          <button key={k} type="button" onClick={() => onChange(k)} style={{
            flex: 1, minWidth: 56, padding: "9px 4px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 700,
            border: `1px solid ${on ? color || C.gold : "transparent"}`,
            background: on ? (color || C.gold) + "22" : C.panel2, color: on ? color || C.gold : C.dim,
          }}>{text}</button>
        );
      })}
    </div>
  );
}
function Chips({ title, dict, selected, onToggle }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: C.dim, marginBottom: 5 }}>{title}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(dict).map(([k, v]) => {
          const on = selected.includes(k), color = v.color || "#4FC3F7";
          return (
            <button key={k} type="button" onClick={() => onToggle(k)} style={{
              padding: "6px 11px", borderRadius: 16, cursor: "pointer", fontSize: 12, fontWeight: 600,
              border: `1px solid ${on ? color : "transparent"}`, background: on ? color + "1c" : C.panel2, color: on ? color : C.dim,
            }}>{v.icon} {v.label}</button>
          );
        })}
      </div>
    </div>
  );
}

// ── タスクの追加・編集 ───────────────────────────────
// 必須は「タスク名・日付」だけ。分類やメモは「詳細」に格納
export default function TaskModal({ todo, defaultDate, today, onClose, onSave, onDelete }) {
  const [f, setF] = useState(() => todo
    ? { title: todo.title || "", date: todo.date || today, priority: todo.priority || "low", status: todoStatus(todo),
        categories: getCats(todo), note: todo.note || "", repeat: todo.repeat || "" }
    : { title: "", date: defaultDate || today, priority: "low", status: "undone", categories: [], note: "", repeat: "" });
  const [more, setMore] = useState(() => !!todo && (getCats(todo).length > 0 || !!todo.note || !!todo.repeat));
  const [saving, setSaving] = useState(false);
  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const toggleCat = (k) => set({ categories: f.categories.includes(k) ? f.categories.filter((c) => c !== k) : [...f.categories, k] });

  async function save() {
    if (!f.title.trim() || saving) return;
    setSaving(true);
    try { await onSave({ ...f, title: f.title.trim() }, todo); onClose(); }
    catch (e) { alert("保存に失敗しました: " + e.message); setSaving(false); }
  }

  const quick = [["今日", today], ["明日", addDays(today, 1)], ["明後日", addDays(today, 2)], ["1週間後", addDays(today, 7)]];

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "#000000BB", zIndex: 300,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        background: C.panel, width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto",
        borderRadius: "20px 20px 0 0", border: `1px solid ${C.line}`, padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{todo ? "タスク編集" : "タスク追加"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.sub, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <input autoFocus={!todo} value={f.title} onChange={(e) => set({ title: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) save(); }}
          placeholder="例：山田商事 折り返し" style={input} />

        <div>
          <span style={label}>日付　<span style={{ color: C.gold }}>{fmtMD(f.date)}</span></span>
          <div style={{ display: "flex", gap: 6 }}>
            {quick.map(([t, d]) => (
              <button key={t} type="button" onClick={() => set({ date: d })} style={{
                flex: 1, padding: "8px 0", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${f.date === d ? C.gold : "transparent"}`, background: f.date === d ? C.gold + "22" : C.panel2,
                color: f.date === d ? C.gold : C.dim,
              }}>{t}</button>
            ))}
            <input type="date" value={f.date} onChange={(e) => e.target.value && set({ date: e.target.value })}
              style={{ ...input, width: 44, padding: "6px", fontSize: 12, colorScheme: "dark", flexShrink: 0 }} title="日付を選ぶ" />
          </div>
        </div>

        <div>
          <span style={label}>優先度</span>
          <Seg value={f.priority} onChange={(v) => set({ priority: v })}
            items={[["low", "通常", PRIORITIES.low.color], ["medium", "重要", PRIORITIES.medium.color], ["high", "緊急", PRIORITIES.high.color]]} />
        </div>

        {todo && (
          <div>
            <span style={label}>ステータス</span>
            <Seg value={f.status} onChange={(v) => set({ status: v })}
              items={Object.entries(STATUSES).map(([k, v]) => [k, `${v.icon} ${v.label}`, v.color])} />
          </div>
        )}

        <button type="button" onClick={() => setMore(!more)} style={{
          background: "none", border: "none", color: C.sub, fontSize: 12, cursor: "pointer", textAlign: "left", padding: 0,
        }}>{more ? "▾" : "▸"} 詳細（商品・アクション・連絡手段・繰り返し・メモ）</button>

        {more && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Chips title="商品" dict={PRODUCT_CATEGORIES} selected={f.categories} onToggle={toggleCat} />
            <Chips title="営業アクション（初回接触・提案・クロージングは案件にも自動登録）" dict={ACTION_CATEGORIES} selected={f.categories} onToggle={toggleCat} />
            <Chips title="連絡手段" dict={CONTACT_CATEGORIES} selected={f.categories} onToggle={toggleCat} />
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: C.dim, marginBottom: 5 }}>繰り返し（済にすると次回分を自動作成）</div>
              <Seg value={f.repeat} onChange={(v) => set({ repeat: v })}
                items={Object.entries(REPEATS).map(([k, v]) => [k, v.label, "#4FC3F7"])} />
            </div>
            <textarea value={f.note} onChange={(e) => set({ note: e.target.value })} rows={2}
              placeholder="メモ" style={{ ...input, resize: "vertical", fontSize: 13 }} />
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          {todo && (
            <button type="button" onClick={() => { if (window.confirm("このタスクを削除しますか？")) { onDelete(todo); onClose(); } }} style={{
              padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.red}55`, background: C.red + "14",
              color: C.red, cursor: "pointer", fontSize: 13, fontWeight: 700,
            }}>削除</button>
          )}
          <button type="button" onClick={save} disabled={!f.title.trim() || saving} style={{
            flex: 1, padding: "12px", borderRadius: 12, border: "none", fontSize: 14, fontWeight: 800,
            background: f.title.trim() && !saving ? C.grad : C.line, color: f.title.trim() && !saving ? C.bg : C.sub,
            cursor: f.title.trim() && !saving ? "pointer" : "not-allowed",
          }}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </div>
    </div>
  );
}
