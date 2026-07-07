import { JP_HOLIDAYS, PRODUCT_CATEGORIES, CONTACT_CATEGORIES } from "./constants";

// ── 日付ユーティリティ ────────────────────────────────
export function makeDateStr(y,m,d) { return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }

export function isHoliday(y,m,d) {
  const s = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  return JP_HOLIDAYS.has(s);
}
export function isBizDay(y,m,d) {
  const dow = new Date(y,m-1,d).getDay();
  return dow!==0 && dow!==6 && !isHoliday(y,m,d);
}
export function isBizDayStr(str) {
  const [y,m,d] = str.split("-").map(Number);
  return isBizDay(y,m,d);
}
export function getBizDaysInMonth(y,m) {
  const total = new Date(y,m,0).getDate();
  let c=0;
  for(let d=1;d<=total;d++) if(isBizDay(y,m,d)) c++;
  return c;
}
export function getBizDaysPassed(y,m) {
  const today0 = new Date();
  const last = (today0.getFullYear()===y&&today0.getMonth()+1===m) ? today0.getDate() : new Date(y,m,0).getDate();
  let c=0;
  for(let d=1;d<=last;d++) if(isBizDay(y,m,d)) c++;
  return c;
}

export function toJSTDateStr(d) {
  const jst = new Date(d.getTime() + 9*60*60*1000);
  return jst.toISOString().slice(0,10);
}
export function addDays(str,n) { const d=new Date(str); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
export function fmtDate(str) { const d=new Date(str); return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`; }
export function catColor(key) { return PRODUCT_CATEGORIES[key]?.color ?? CONTACT_CATEGORIES[key]?.color ?? "#94A3B8"; }

// カテゴリ配列の取得(旧categoryフィールドとの互換)
export function getCats(t) {
  return Array.isArray(t.categories)&&t.categories.length>0 ? t.categories : (t.category?[t.category]:[]);
}

// タスクが済かどうか(旧doneフィールドとの互換)
export function isDoneTodo(t) { return t.status==="done" || (!t.status && t.done); }
export function todoStatus(t) { return t.status || (t.done ? "done" : "undone"); }

// ── 繰り返しタスクの次回日付 ──────────────────────────
export function nextRepeatDate(dateStr, repeat) {
  if (repeat==="daily")  return addDays(dateStr,1);
  if (repeat==="weekly") return addDays(dateStr,7);
  if (repeat==="bizdaily") {
    let s = addDays(dateStr,1);
    let guard = 0;
    while(!isBizDayStr(s) && guard++<14) s = addDays(s,1);
    return s;
  }
  if (repeat==="monthly") {
    const d = new Date(dateStr);
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth()+1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day,last));
    return d.toISOString().slice(0,10);
  }
  return addDays(dateStr,1);
}
