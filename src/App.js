import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore";

import { db } from "./firebase";
import { C, ACTION_CATEGORIES, PIPELINE_ACTIONS, PRODUCT_CATEGORIES, PRODUCTS, REPEATS } from "./constants";
import { todayJST, halfOf, shiftHalf, isDoneTodo, todoStatus, nextRepeatDate } from "./utils";
import TodayTab from "./components/TodayTab";
import CalendarTab from "./components/CalendarTab";
import BoardTab from "./components/BoardTab";
import PipelineTab from "./components/PipelineTab";
import TaskModal from "./components/TaskModal";
import DealModal from "./components/DealModal";
import Pomodoro from "./components/Pomodoro";

const TABS = [["today", "今日", "⚡"], ["calendar", "カレンダー", "📅"], ["board", "目標", "📊"], ["pipeline", "案件", "🔀"]];

// Firestoreのコレクションをリアルタイム購読
function useCollection(name) {
  const [state, setState] = useState({ items: [], loading: true, error: null });
  useEffect(() => onSnapshot(collection(db, name),
    (snap) => setState({ items: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false, error: null }),
    (error) => { console.error(error); setState((s) => ({ ...s, loading: false, error })); }), [name]);
  return state;
}

// 半期のボードデータ(2026年度上期は旧データ sales_board/main を引き継ぐ)
function emptyBoard() {
  return { products: PRODUCTS.map((p) => ({ key: p.key, label: p.label, halfTarget: 0, monthlyTargets: {}, monthlyResults: {} })) };
}
function useBoard(halfId) {
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);
    let legacyUnsub = null;
    const unsub = onSnapshot(doc(db, "sales_board", halfId), (snap) => {
      if (legacyUnsub) { legacyUnsub(); legacyUnsub = null; }
      if (snap.exists()) { setData(snap.data()); return; }
      if (halfId === "2026H1") {
        legacyUnsub = onSnapshot(doc(db, "sales_board", "main"), (s2) => setData(s2.exists() ? s2.data() : emptyBoard()));
      } else setData(emptyBoard());
    }, () => setData(emptyBoard()));
    return () => { unsub(); if (legacyUnsub) legacyUnsub(); };
  }, [halfId]);
  return data;
}

export default function App() {
  const [tab, setTab] = useState("today");

  // 「今日」は1分ごとに更新(開きっぱなしで日付をまたいでもズレない)
  const [today, setToday] = useState(todayJST);
  useEffect(() => {
    const iv = setInterval(() => setToday((p) => { const s = todayJST(); return p === s ? p : s; }), 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  const { items: todos, loading, error } = useCollection("sales_todos");
  const { items: deals } = useCollection("sales_deals");
  const { items: reports } = useCollection("sales_reports");

  const curHalf = halfOf(today);
  const [halfShift, setHalfShift] = useState(0);
  let viewHalf = curHalf;
  for (let i = 0; i < Math.abs(halfShift); i++) viewHalf = shiftHalf(viewHalf, Math.sign(halfShift));
  const curBoard  = useBoard(curHalf.id);
  const viewBoard = useBoard(viewHalf.id);

  const [taskModal, setTaskModal] = useState(null); // { todo } or { date }
  const [dealModal, setDealModal] = useState(null); // { deal } or { stage }

  // ── 期限切れの未完了タスクは今日に繰り越し(元の日付は carriedFrom に残す) ──
  const carried = useRef(new Set());
  useEffect(() => {
    todos.filter((t) => t.date && t.date < today && !isDoneTodo(t)).forEach((t) => {
      if (carried.current.has(t.id)) return;
      carried.current.add(t.id);
      updateDoc(doc(db, "sales_todos", t.id), { date: today, carriedFrom: t.carriedFrom || t.date })
        .catch(() => carried.current.delete(t.id));
    });
  }, [todos, today]);

  // ── タスク操作 ─────────────────────────────────────
  async function createRepeatIfNeeded(todo) {
    if (!todo.repeat || !REPEATS[todo.repeat]) return;
    const base = todo.date && todo.date >= today ? todo.date : today;
    const nd = nextRepeatDate(base, todo.repeat);
    if (todos.some((t) => t.title === todo.title && t.date === nd && t.repeat === todo.repeat && !isDoneTodo(t))) return;
    await addDoc(collection(db, "sales_todos"), {
      title: todo.title, date: nd, priority: todo.priority || "low", categories: todo.categories || [],
      status: "undone", done: false, note: todo.note || "", repeat: todo.repeat, createdAt: new Date().toISOString(),
    });
  }
  const doneFields = (status) => status === "done"
    ? { status, done: true, doneAt: new Date().toISOString() }
    : { status, done: false, doneAt: null };

  async function quickAdd(p) {
    await addDoc(collection(db, "sales_todos"), {
      title: p.title, date: p.date, priority: p.priority, categories: [], status: "undone", done: false,
      note: "", source: "app", createdAt: new Date().toISOString(),
    });
  }
  async function toggleTodo(t) {
    const next = isDoneTodo(t) ? "undone" : "done";
    await updateDoc(doc(db, "sales_todos", t.id), doneFields(next));
    if (next === "done") await createRepeatIfNeeded(t);
  }
  async function saveTodo(f, todo) {
    const { status, ...rest } = f;
    if (todo) {
      const prev = todoStatus(todo);
      await updateDoc(doc(db, "sales_todos", todo.id), { ...rest, ...(prev !== status ? doneFields(status) : {}) });
      if (prev !== "done" && status === "done") await createRepeatIfNeeded({ ...todo, ...rest });
      return;
    }
    await addDoc(collection(db, "sales_todos"), { ...rest, ...doneFields(status), source: "app", createdAt: new Date().toISOString() });
    // 初回接触・提案・クロージングを選んだら案件にも登録
    const pipe = f.categories.find((k) => PIPELINE_ACTIONS.includes(k));
    if (pipe) {
      const stage = ACTION_CATEGORIES[pipe].pipelineStage;
      const company = f.title.replace(/\s*(初回|提案|クロージング|アポ|訪問|面談|電話|TEL|折り返し).*$/, "").trim() || f.title;
      if (!deals.some((d) => d.company === company && d.stage === stage)) {
        await addDoc(collection(db, "sales_deals"), {
          company, products: f.categories.filter((k) => PRODUCT_CATEGORIES[k]), amount: "", person: "", note: "",
          stage, nextAction: "", fromTask: true, createdAt: new Date().toISOString(),
        });
      }
    }
  }
  const deleteTodo = (t) => deleteDoc(doc(db, "sales_todos", t.id));
  async function deleteDone() {
    const list = todos.filter(isDoneTodo);
    if (!list.length || !window.confirm(`完了したタスク ${list.length}件を削除しますか？`)) return;
    await Promise.all(list.map((t) => deleteDoc(doc(db, "sales_todos", t.id))));
  }

  // ── 報告書 ─────────────────────────────────────────
  const addReport = (name) => addDoc(collection(db, "sales_reports"), { date: today, name, createdAt: new Date().toISOString() });
  const deleteReport = (id) => deleteDoc(doc(db, "sales_reports", id));

  // ── 案件 ───────────────────────────────────────────
  async function saveDeal(f, deal) {
    if (deal) await updateDoc(doc(db, "sales_deals", deal.id), f);
    else await addDoc(collection(db, "sales_deals"), { ...f, createdAt: new Date().toISOString() });
    // 次回アクション日を設定/変更したらフォロータスクを自動作成
    if (f.nextAction && f.nextAction !== (deal?.nextAction || "")) {
      const title = `${f.company} フォロー`;
      if (!todos.some((t) => t.title === title && t.date === f.nextAction)) {
        await addDoc(collection(db, "sales_todos"), {
          title, date: f.nextAction, priority: "medium", categories: ["followup"], status: "undone", done: false,
          note: "案件から自動作成", createdAt: new Date().toISOString(),
        });
      }
    }
  }
  const deleteDeal = (d) => deleteDoc(doc(db, "sales_deals", d.id));
  const moveDeal = (d, stage) => updateDoc(doc(db, "sales_deals", d.id), { stage });

  // ════════════════════════════════════════════════════
  if (error) return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ color: C.red, fontWeight: 800 }}>データベースに接続できません</div>
      <div style={{ fontSize: 12, color: C.sub, maxWidth: 460, wordBreak: "break-all" }}>{error.code} {error.message}</div>
      <button onClick={() => window.location.reload()} style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: C.grad, color: C.bg, fontWeight: 700, cursor: "pointer" }}>再読み込み</button>
    </div>
  );
  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.sub, fontSize: 13 }}>読み込み中...</div>
  );

  const openTask = (todo) => setTaskModal({ todo });
  const fab = tab === "pipeline" ? () => setDealModal({ stage: "contact" }) : tab === "board" ? null : () => setTaskModal({ date: today });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Noto Sans JP','Hiragino Sans',sans-serif" }}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        .bottomNav { display:none }
        @media (max-width:640px){
          .topTabs { display:none !important }
          .bottomNav { display:flex !important; position:fixed; bottom:0; left:0; right:0; z-index:250;
            background:${C.panel2}; border-top:1px solid ${C.line}; padding:6px 8px calc(6px + env(safe-area-inset-bottom)); }
          .fab { bottom:84px !important }
        }
      `}</style>

      {/* ── ヘッダー ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: C.panel2 + "f2", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.line}`, padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 760, margin: "0 auto" }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⚡</div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>ToDoリスト</div>
          <div style={{ marginLeft: "auto" }}><Pomodoro /></div>
          <div className="topTabs" style={{ display: "flex", gap: 5 }}>
            {TABS.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                padding: "6px 12px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: tab === k ? C.grad : C.chip, color: tab === k ? C.bg : C.sub,
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 12px 150px" }}>
        {tab === "today" && (
          <TodayTab today={today} todos={todos} reports={reports} board={curBoard}
            onQuickAdd={quickAdd} onToggle={toggleTodo} onOpen={openTask}
            onAddReport={addReport} onDeleteReport={deleteReport} onDeleteDone={deleteDone}
            onExport={() => import("./excel").then((m) => m.exportToExcel(todos, reports))} />
        )}
        {tab === "calendar" && (
          <CalendarTab today={today} todos={todos} onToggle={toggleTodo} onOpen={openTask} onAddOn={(d) => setTaskModal({ date: d })} />
        )}
        {tab === "board" && (
          <BoardTab today={today} half={viewHalf} isCurrentHalf={viewHalf.id === curHalf.id} boardData={viewBoard}
            onShiftHalf={(n) => setHalfShift((s) => s + n)}
            saveBoardData={(d) => setDoc(doc(db, "sales_board", viewHalf.id), d)} />
        )}
        {tab === "pipeline" && (
          <PipelineTab deals={deals} todayStr={today}
            openAddDeal={(stage) => setDealModal({ stage })} openEditDeal={(deal) => setDealModal({ deal })} moveDeal={moveDeal} />
        )}
      </div>

      {/* ── スマホ用下部ナビ ── */}
      <div className="bottomNav">
        {TABS.map(([k, l, icon]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 2, padding: "4px 0", color: tab === k ? C.gold : C.dim,
          }}>
            <span style={{ fontSize: 18 }}>{icon}</span><span style={{ fontSize: 10, fontWeight: 700 }}>{l}</span>
          </button>
        ))}
      </div>

      {fab && (
        <button className="fab" onClick={fab} aria-label="追加" style={{
          position: "fixed", bottom: 24, right: 20, width: 54, height: 54, borderRadius: "50%", border: "none", cursor: "pointer",
          background: C.grad, color: C.bg, fontSize: 28, fontWeight: 700, boxShadow: "0 4px 20px #FF8C0050", zIndex: 200,
        }}>+</button>
      )}

      {taskModal && (
        <TaskModal key={taskModal.todo?.id || "new"} todo={taskModal.todo} defaultDate={taskModal.date} today={today}
          onClose={() => setTaskModal(null)} onSave={saveTodo} onDelete={deleteTodo} />
      )}
      {dealModal && (
        <DealModal deal={dealModal.deal} defaultStage={dealModal.stage}
          onClose={() => setDealModal(null)} onSave={saveDeal} onDelete={deleteDeal} />
      )}
    </div>
  );
}
