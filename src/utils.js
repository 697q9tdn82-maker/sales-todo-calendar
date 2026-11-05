import { JP_HOLIDAYS, PRODUCT_CATEGORIES, CONTACT_CATEGORIES, DAYS_JP } from "./constants";

// ── 日付は全部 "YYYY-MM-DD" 文字列で扱う(日本時間基準・端末のタイムゾーンに依存しない) ──
const toD = (s) => new Date(s + "T00:00:00Z");
const toS = (d) => d.toISOString().slice(0, 10);

export function toJSTDateStr(d) { return toS(new Date(d.getTime() + 9 * 3600 * 1000)); }
export function todayJST() { return toJSTDateStr(new Date()); }
export function addDays(s, n) { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return toS(d); }
export function dowOf(s) { return toD(s).getUTCDay(); }
export function makeDateStr(y, m0, d) { return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
export function fmtMD(s) { const d = toD(s); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DAYS_JP[d.getUTCDay()]})`; }
export function fmtDate(s) { const d = toD(s); return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`; }

// ── 営業日(土日祝を除く) ─────────────────────────────
export function isBizDayStr(s) { const w = dowOf(s); return w !== 0 && w !== 6 && !JP_HOLIDAYS.has(s); }
export function bizInfo(today) {
  const [y, m] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let total = 0, passed = 0;
  for (let d = 1; d <= last; d++) {
    const s = makeDateStr(y, m - 1, d);
    if (!isBizDayStr(s)) continue;
    total++;
    if (s <= today) passed++;
  }
  return { passed, total, remain: total - passed, isBiz: isBizDayStr(today) };
}

// ── 半期(上期4〜9月 / 下期10〜3月)。ボードのデータは半期ごとに保存 ──
export function halfOf(dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  const fy = m >= 4 ? y : y - 1;           // 4月始まりの年度
  const h  = m >= 4 && m <= 9 ? 1 : 2;
  const months = (h === 1 ? [4, 5, 6, 7, 8, 9] : [10, 11, 12, 1, 2, 3]).map((x) => `${x}月`);
  return { id: `${fy}H${h}`, fy, h, months, label: `${fy}年度 ${h === 1 ? "上期（4〜9月）" : "下期（10〜3月）"}` };
}
export function shiftHalf(half, n) {
  // n=±1 で前後の半期
  let { fy, h } = half;
  h += n;
  while (h > 2) { h -= 2; fy++; }
  while (h < 1) { h += 2; fy--; }
  return halfOf(`${h === 1 ? fy : fy}-${h === 1 ? "04" : "10"}-01`);
}

// ── タスク共通 ───────────────────────────────────────
export function catColor(key) { return PRODUCT_CATEGORIES[key]?.color ?? CONTACT_CATEGORIES[key]?.color ?? "#94A3B8"; }
export function getCats(t) { return Array.isArray(t.categories) && t.categories.length > 0 ? t.categories : (t.category ? [t.category] : []); }
export function isDoneTodo(t) { return t.status === "done" || (!t.status && t.done); }
export function todoStatus(t) { return t.status || (t.done ? "done" : "undone"); }
const RANK = { high: 0, medium: 1, low: 2 };
export function byPriority(a, b) {
  return (RANK[a.priority] ?? 2) - (RANK[b.priority] ?? 2)
    || (a.status === "progress" ? -1 : 0) - (b.status === "progress" ? -1 : 0)
    || (a.title || "").localeCompare(b.title || "", "ja");
}

// ── 繰り返しタスクの次回日付 ──────────────────────────
export function nextRepeatDate(s, repeat) {
  if (repeat === "weekly") return addDays(s, 7);
  if (repeat === "bizdaily") {
    let n = addDays(s, 1), guard = 0;
    while (!isBizDayStr(n) && guard++ < 14) n = addDays(n, 1);
    return n;
  }
  if (repeat === "monthly") {
    const d = toD(s), day = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return toS(d);
  }
  return addDays(s, 1);
}

// ── 一言入力の解析(LINE Botと同じルール) ──────────────
// 例) 「明日 山田商事 折り返し」「!鈴木 見積」「!!田中 至急」「金曜 重要 佐藤 提案」
export function parseQuick(text, today) {
  let t = (text || "").trim();
  let priority = "low";
  let date = null;

  const bang = t.match(/^[!！]+|[!！]+$/g);
  if (bang) {
    priority = Math.max(...bang.map((b) => b.length)) >= 2 ? "high" : "medium";
    t = t.replace(/^[!！]+|[!！]+$/g, "").trim();
  }
  if (/緊急/.test(t)) { priority = "high"; t = t.replace(/緊急/g, " "); }
  else if (/重要/.test(t)) { priority = "medium"; t = t.replace(/重要/g, " "); }

  const take = (re, fn) => {
    if (date) return;
    const m = t.match(re);
    if (!m) return;
    const v = fn(m);
    if (!v) return;
    date = v;
    t = t.replace(m[0], " ");
  };
  const now = dowOf(today);
  const [Y, M, D] = today.split("-").map(Number);

  take(/(今日|きょう)/, () => today);
  take(/(明後日|あさって)/, () => addDays(today, 2));
  take(/(明日|あした|あす)/, () => addDays(today, 1));
  take(/(来週)?([月火水木金土日])曜日?/, (m) => {
    const wd = DAYS_JP.indexOf(m[2]);
    if (m[1]) { const toMon = ((8 - now) % 7) || 7; return addDays(today, toMon + ((wd + 6) % 7)); }
    return addDays(today, (wd - now + 7) % 7);
  });
  take(/(\d{1,2})[/／月](\d{1,2})日?/, (m) => {
    const mo = Number(m[1]), da = Number(m[2]);
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    let s = `${Y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
    if (s < today) s = `${Y + 1}-${s.slice(5)}`;
    return s;
  });
  take(/(\d{1,2})日/, (m) => {
    const da = Number(m[1]);
    if (da < 1 || da > 31) return null;
    let y = Y, mo = M;
    if (da < D) { mo += 1; if (mo > 12) { mo = 1; y += 1; } }
    return `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
  });

  const title = t.replace(/[\s、,]+/g, " ").trim();
  return { title, date: date || today, priority };
}
