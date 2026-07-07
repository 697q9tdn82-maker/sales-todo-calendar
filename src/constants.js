// ── 共通定数 ──────────────────────────────────────────

export const PRIORITIES = {
  high:   { label: "緊急", color: "#FF4444", bg: "#FF444418" },
  medium: { label: "重要", color: "#FF9500", bg: "#FF950018" },
  low:    { label: "通常", color: "#34C759", bg: "#34C75918" },
};

export const STATUSES = {
  undone:   { label: "未",    color: "#94A3B8", bg: "#94A3B818", icon: "○" },
  progress: { label: "着手中", color: "#FBBF24", bg: "#FBBF2418", icon: "◑" },
  done:     { label: "済",    color: "#34C759", bg: "#34C75918", icon: "✓" },
};

export const ACTION_CATEGORIES = {
  contact:  { label: "初回接触", icon: "🤝", pipelineStage: "contact"  },
  proposal: { label: "提案",    icon: "📋", pipelineStage: "proposal" },
  closing:  { label: "クロージング", icon: "🎯", pipelineStage: "closing" },
  followup: { label: "フォロー", icon: "📞" },
  admin:    { label: "管理",    icon: "🗂️" },
};
// パイプライン連動するアクションキー
export const PIPELINE_ACTIONS = ["contact","proposal","closing"];

export const PRODUCT_CATEGORIES = {
  membership: { label: "加盟料",   icon: "🏅", color: "#A78BFA" },
  news:       { label: "ニュース", icon: "📰", color: "#60A5FA" },
  cos:        { label: "COS",     icon: "💼", color: "#34D399" },
  att:        { label: "ATT",     icon: "📡", color: "#FBBF24" },
  net:        { label: "NET",     icon: "🌐", color: "#F87171" },
  ticket:     { label: "チケット", icon: "🎟️", color: "#FB923C" },
};

export const CONTACT_CATEGORIES = {
  tel_office: { label: "事務所電話", icon: "☎️", color: "#818CF8" },
  tel_mobile: { label: "携帯電話",   icon: "📱", color: "#34D399" },
  email:      { label: "メール",     icon: "✉️", color: "#60A5FA" },
  line:       { label: "LINE",       icon: "💬", color: "#4ADE80" },
  other:      { label: "その他",     icon: "💡", color: "#94A3B8" },
};

export const ALL_CATEGORIES = { ...ACTION_CATEGORIES, ...PRODUCT_CATEGORIES, ...CONTACT_CATEGORIES };
export const DAYS_JP   = ["日","月","火","水","木","金","土"];
export const MONTHS_JP = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

// ── 繰り返し設定 ──────────────────────────────────────
export const REPEATS = {
  "":         { label: "なし" },
  daily:      { label: "毎日" },
  bizdaily:   { label: "毎営業日" },
  weekly:     { label: "毎週" },
  monthly:    { label: "毎月" },
};

// ── タスクテンプレート(初期値) ────────────────────────
export const DEFAULT_TEMPLATES = [
  { name: "TELアポ",    title: "TELアポ架電",   categories: ["contact","tel_office"],  priority: "medium" },
  { name: "提案書",     title: "提案書作成",     categories: ["proposal"],              priority: "high" },
  { name: "フォロー",   title: "フォロー電話",   categories: ["followup","tel_mobile"], priority: "medium" },
  { name: "日報",       title: "日報作成",       categories: ["admin"],                 priority: "low" },
];

// ── 案件パイプライン ──────────────────────────────────
export const STAGES = [
  { key:"contact",  label:"初回接触", color:"#60A5FA" },
  { key:"proposal", label:"提案",    color:"#FBBF24" },
  { key:"closing",  label:"クロージング", color:"#F87171" },
  { key:"won",      label:"成約",    color:"#34D399" },
];

// ── ボード(目標管理) ─────────────────────────────────
export const PRODUCTS = [
  { key:"membership", label:"加盟料",  color:"#A78BFA" },
  { key:"cosmos",     label:"COSMOS", color:"#34D399" },
  { key:"news",       label:"ニュース", color:"#60A5FA" },
];
export const PROD_COLORS = { membership:"#A78BFA", cosmos:"#34D399", news:"#60A5FA" };
export const HALF_MONTHS = ["4月","5月","6月","7月","8月","9月"]; // 上期デフォルト
export const MILESTONES = {
  membership: [{day:5,pct:45},{day:10,pct:65},{day:15,pct:100}],
  news:       [{day:5,pct:85},{day:15,pct:100}],
};

// ── 日本祝日データ ────────────────────────────────────
export const JP_HOLIDAYS = new Set([
  // 2025年
  "2025-01-01","2025-01-13","2025-02-11","2025-02-23","2025-02-24",
  "2025-03-20","2025-04-29","2025-05-03","2025-05-04","2025-05-05",
  "2025-05-06","2025-07-21","2025-08-11","2025-09-15","2025-09-22",
  "2025-09-23","2025-10-13","2025-11-03","2025-11-23","2025-11-24",
  "2025-12-23",
  // 2026年
  "2026-01-01","2026-01-12","2026-02-11","2026-02-23","2026-03-20",
  "2026-04-29","2026-05-03","2026-05-04","2026-05-05","2026-05-06",
  "2026-07-20","2026-08-11","2026-09-21","2026-09-22","2026-09-23",
  "2026-10-12","2026-11-03","2026-11-23",
  // 2027年
  "2027-01-01","2027-01-11","2027-02-11","2027-02-23","2027-03-22",
  "2027-04-29","2027-05-03","2027-05-04","2027-05-05","2027-07-19",
  "2027-08-11","2027-09-20","2027-09-23","2027-10-11","2027-11-03",
  "2027-11-23",
]);
