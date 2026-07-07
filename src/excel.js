import XLSX from "xlsx-js-style";
import { ACTION_CATEGORIES, PRODUCT_CATEGORIES, CONTACT_CATEGORIES, PRIORITIES, STATUSES, DAYS_JP } from "./constants";
import { toJSTDateStr, getCats, todoStatus } from "./utils";

// ── Excel出力（今西さん提出用） ────────────────────────
// xlsx-js-style を使用しているため、セルの塗りつぶし・罫線・フォントが実際に反映される
export function exportToExcel(todos, reportItems) {
  // ── データ生成 ──────────────────────────────────────
  const headers = ["日付", "曜日", "タスク内容", "営業アクション", "商品区分", "連絡手段", "緊急度", "完了"];
  const rows = [...todos]
    .filter(t => { const s = todoStatus(t); return s==="undone"||s==="progress"; })
    .sort((a,b) => a.date.localeCompare(b.date))
    .map(t => {
      const d    = new Date(t.date);
      const cats = getCats(t);
      const actions  = cats.filter(k=>ACTION_CATEGORIES[k]).map(k=>ACTION_CATEGORIES[k].label).join("・");
      const products = cats.filter(k=>PRODUCT_CATEGORIES[k]).map(k=>PRODUCT_CATEGORIES[k].label).join("・");
      const contacts = cats.filter(k=>CONTACT_CATEGORIES[k]).map(k=>CONTACT_CATEGORIES[k].label).join("・");
      return [
        t.date,
        DAYS_JP[d.getDay()] + "曜日",
        t.title,
        actions,
        products,
        contacts,
        (PRIORITIES[t.priority]||PRIORITIES.medium).label,
        (STATUSES[todoStatus(t)]||STATUSES.undone).label,
      ];
    });

  // ── スタイル定義 ────────────────────────────────────
  const titleFill = { patternType: "solid", fgColor: { rgb: "BDD7EE" } };
  const titleFont = { bold: true, color: { rgb: "1F3864" } };
  const titleBorder = {
    top:    { style: "thin", color: { rgb: "9DC3E6" } },
    bottom: { style: "thin", color: { rgb: "9DC3E6" } },
    left:   { style: "thin", color: { rgb: "9DC3E6" } },
    right:  { style: "thin", color: { rgb: "9DC3E6" } },
  };
  const dataBorder = {
    top:    { style: "thin", color: { rgb: "D9D9D9" } },
    bottom: { style: "thin", color: { rgb: "D9D9D9" } },
    left:   { style: "thin", color: { rgb: "D9D9D9" } },
    right:  { style: "thin", color: { rgb: "D9D9D9" } },
  };

  // ── 1シートにまとめる（上:報告書 / 空行 / 下:タスク一覧） ──
  const todayReport = (reportItems||[]).filter(r=>r.date===toJSTDateStr(new Date()));
  const repHeaderRow = ["本日提出報告書"];
  const repDataRows  = todayReport.length>0
    ? todayReport.map(r=>["・"+r.name])
    : [["（本日の報告書なし）"]];
  const emptyRow     = [""];
  const combined     = [
    repHeaderRow,
    ...repDataRows,
    emptyRow,
    headers,
    ...rows,
  ];
  const wsCombined = XLSX.utils.aoa_to_sheet(combined);

  // 列幅
  wsCombined["!cols"] = [
    { wch: 12 }, { wch: 8 }, { wch: 36 },
    { wch: 16 }, { wch: 14 }, { wch: 14 },
    { wch: 8  }, { wch: 8 },
  ];

  // 全行の高さ
  wsCombined["!rows"] = combined.map(()=>({ hpt: 18 }));

  // 報告書タイトル行スタイル（行0）
  const repTitleCell = XLSX.utils.encode_cell({ r:0, c:0 });
  if (wsCombined[repTitleCell]) wsCombined[repTitleCell].s = { fill:titleFill, font:titleFont, border:titleBorder, alignment:{ horizontal:"center", vertical:"center" } };

  // タスク一覧タイトル行スタイル
  const taskHeaderRow = repDataRows.length + 2; // 報告書ヘッダー + データ行 + 空行
  headers.forEach((_,i)=>{
    const cell = XLSX.utils.encode_cell({ r:taskHeaderRow, c:i });
    if (!wsCombined[cell]) return;
    wsCombined[cell].s = { fill:titleFill, font:titleFont, border:titleBorder, alignment:{ horizontal:"center", vertical:"center" } };
  });

  // タスクデータ行ボーダー
  rows.forEach((_,ri)=>{
    headers.forEach((_,ci)=>{
      const cell = XLSX.utils.encode_cell({ r:taskHeaderRow+1+ri, c:ci });
      if (!wsCombined[cell]) wsCombined[cell] = { t:"s", v:"" };
      wsCombined[cell].s = { border:dataBorder, alignment:{ vertical:"center" } };
    });
  });

  // ── ワークブック出力 ────────────────────────────────
  const wb  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsCombined, "提出用");
  const now = toJSTDateStr(new Date());
  XLSX.writeFile(wb, "タスク一覧_" + now.replace(/-/g,"") + ".xlsx");
}
