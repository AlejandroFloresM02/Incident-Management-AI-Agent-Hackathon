/**
 * Build the Incident Copilot pitch deck.
 *
 * Run from this folder: node build.js
 * Produces: incident-copilot.pptx
 *
 * Design: Vercel/GitHub-inspired application dashboard.
 * White surface, thin borders, soft shadows, purple accent (#9333EA).
 * Top-bar navigation pattern. Inter + JetBrains Mono.
 *
 * Compatibility: tested patterns avoid pptxgenjs's inner-shadow XML bug
 * and use only LibreOffice-Impress-safe features (no gradients, no exotic
 * shapes, conservative shadow params).
 */

const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.3" × 7.5"
pres.title = "Incident Management AI Copilot";
pres.author = "Team 4 — TCS AI Friday Hackathon";

// ========== Design tokens ==========
const C = {
  // base
  surface:      "FFFFFF",
  surfaceMuted: "FAFAFA",
  surfaceBack:  "F4F4F5",

  // borders
  border:       "E4E4E7",
  borderStrong: "D4D4D8",

  // text
  text:         "09090B",
  textSecond:   "27272A",
  textMuted:    "71717A",
  textSubtle:   "A1A1AA",

  // brand (purple)
  primary:      "9333EA",
  primaryLite:  "A855F7",
  primarySoft:  "F3E8FF",
  primaryDeep:  "7E22CE",

  // status
  success:      "10B981",
  successSoft:  "D1FAE5",
  warning:      "F59E0B",
  warningSoft:  "FEF3C7",
  danger:       "EF4444",
  dangerSoft:   "FEE2E2",

  // code
  codeBg:       "18181B",
  codeBgLight:  "27272A",
  codeFg:       "FAFAFA",
  codeMuted:    "A1A1AA",
  codeKeyword:  "C084FC", // purple-400
  codeString:   "86EFAC", // green-300
  codeFunc:     "FCD34D", // amber-300
};

const F = {
  body: "Inter",
  mono: "JetBrains Mono",
};

const SW = 13.3;
const SH = 7.5;
const TOTAL = 11;

// ========== Helpers ==========

// Always create FRESH shadow objects
const cardShadow = () => ({
  type: "outer", color: "000000", blur: 10, offset: 2, angle: 90, opacity: 0.06,
});
const subtleShadow = () => ({
  type: "outer", color: "000000", blur: 4, offset: 1, angle: 90, opacity: 0.04,
});

const setBg = (slide) => { slide.background = { color: C.surface }; };

// Top-bar header (project mark left, breadcrumb + page right, hairline separator)
const addTopBar = (slide, breadcrumb, pageNum) => {
  // Project dot
  slide.addShape(pres.shapes.OVAL, {
    x: 0.5, y: 0.4, w: 0.18, h: 0.18,
    fill: { color: C.primary }, line: { color: C.primary, width: 0 },
  });
  // Project name
  slide.addText("Incident Copilot", {
    x: 0.78, y: 0.32, w: 4, h: 0.34,
    fontSize: 12, color: C.text, bold: true, fontFace: F.body,
    margin: 0, valign: "middle",
  });
  // Right side: breadcrumb + page
  slide.addText(`${breadcrumb}   ·   ${pageNum} / ${TOTAL}`, {
    x: SW - 5.5, y: 0.32, w: 5, h: 0.34,
    fontSize: 10, color: C.textMuted, fontFace: F.mono,
    margin: 0, align: "right", valign: "middle", charSpacing: 2,
  });
  // Hairline separator
  slide.addShape(pres.shapes.LINE, {
    x: 0.5, y: 0.78, w: SW - 1, h: 0,
    line: { color: C.border, width: 0.75 },
  });
};

const addTitle = (slide, text) => {
  slide.addText(text, {
    x: 0.5, y: 1.0, w: 12.3, h: 0.65,
    fontSize: 28, bold: true, color: C.text, fontFace: F.body,
    margin: 0, align: "left", valign: "middle",
  });
};

const addKicker = (slide, text) => {
  slide.addText(text, {
    x: 0.5, y: 1.65, w: 12.3, h: 0.4,
    fontSize: 14, color: C.textMuted, fontFace: F.body,
    margin: 0, align: "left", valign: "middle",
  });
};

// White card with thin border + soft shadow (Vercel style)
const addCard = (slide, x, y, w, h, opts = {}) => {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: opts.fill || C.surface },
    line: { color: opts.borderColor || C.border, width: opts.borderWidth ?? 1 },
    rectRadius: opts.radius ?? 0.12,
    shadow: opts.shadow || cardShadow(),
  });
};

// Pill tag (rounded, colored background, white or dark text)
const addPill = (slide, x, y, w, h, text, opts = {}) => {
  const bg = opts.bg || C.primarySoft;
  const fg = opts.fg || C.primaryDeep;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: bg }, line: { color: bg, width: 0 },
    rectRadius: h / 2,
  });
  slide.addText(text, {
    x, y, w, h,
    fontSize: opts.fontSize ?? 9,
    color: fg, fontFace: F.mono, bold: true,
    align: "center", valign: "middle", margin: 0, charSpacing: 2,
  });
};

// Status dot
const addStatusDot = (slide, x, y, color) => {
  slide.addShape(pres.shapes.OVAL, {
    x, y, w: 0.14, h: 0.14,
    fill: { color }, line: { color, width: 0 },
  });
};

// Footer page indicator (only on title slide — content slides use top bar)
const addBottomMark = (slide) => {
  slide.addText("Team 4   ·   TCS AI Friday Hackathon   ·   May 2026", {
    x: 0, y: 7.05, w: SW, h: 0.3,
    fontSize: 10, color: C.textMuted, fontFace: F.body,
    align: "center", margin: 0,
  });
};

// =====================================================================
// SLIDE 1 — Title
// =====================================================================
{
  const s = pres.addSlide(); setBg(s);

  // Background subtle band on the right (very light purple wash)
  s.addShape(pres.shapes.RECTANGLE, {
    x: 7.5, y: 0, w: 5.8, h: SH,
    fill: { color: C.surfaceMuted }, line: { color: C.surfaceMuted, width: 0 },
  });

  // Project mark (top left)
  s.addShape(pres.shapes.OVAL, {
    x: 0.6, y: 0.6, w: 0.2, h: 0.2,
    fill: { color: C.primary }, line: { color: C.primary, width: 0 },
  });
  s.addText("Incident Copilot", {
    x: 0.9, y: 0.52, w: 4, h: 0.36,
    fontSize: 13, color: C.text, bold: true, fontFace: F.body,
    margin: 0, valign: "middle",
  });

  // Headline
  s.addText("Incident Management", {
    x: 0.6, y: 2.7, w: 7.0, h: 0.9,
    fontSize: 48, bold: true, color: C.text, fontFace: F.body,
    margin: 0, valign: "middle",
  });
  s.addText("AI Copilot", {
    x: 0.6, y: 3.55, w: 7.0, h: 0.9,
    fontSize: 48, bold: true, color: C.primary, fontFace: F.body,
    margin: 0, valign: "middle",
  });

  // Tagline
  s.addText("Local-first AI for on-call engineers", {
    x: 0.6, y: 4.6, w: 7.0, h: 0.4,
    fontSize: 16, color: C.textMuted, fontFace: F.body, margin: 0,
  });

  // Bottom team line
  s.addText("Team 4   ·   TCS AI Friday Hackathon   ·   May 2026", {
    x: 0.6, y: 6.55, w: 7.0, h: 0.35,
    fontSize: 11, color: C.textMuted, fontFace: F.mono, margin: 0, charSpacing: 2,
  });

  // Right-side: dashboard preview card
  const cx = 8.2, cy = 1.7, cw = 4.5, ch = 4.2;
  addCard(s, cx, cy, cw, ch, { radius: 0.16 });

  // Card top: window dots + filename
  ["EF4444", "F59E0B", "10B981"].forEach((dot, i) => {
    s.addShape(pres.shapes.OVAL, {
      x: cx + 0.3 + i * 0.27, y: cy + 0.32, w: 0.16, h: 0.16,
      fill: { color: dot }, line: { color: dot, width: 0 },
    });
  });
  s.addText("incident-copilot.app", {
    x: cx, y: cy + 0.28, w: cw, h: 0.32,
    fontSize: 11, color: C.textMuted, fontFace: F.mono, align: "center", valign: "middle", margin: 0,
  });
  // Separator under header
  s.addShape(pres.shapes.LINE, {
    x: cx + 0.05, y: cy + 0.78, w: cw - 0.1, h: 0,
    line: { color: C.border, width: 0.75 },
  });

  // Status rows
  const rows = [
    { label: "Backend agent",   value: "running",   color: C.success },
    { label: "Vector store",    value: "indexing",  color: C.warning },
    { label: "Frontend",        value: "wiring",    color: C.warning },
    { label: "Models (Ollama)", value: "ready",     color: C.success },
  ];
  rows.forEach((r, i) => {
    const ry = cy + 1.05 + i * 0.6;
    s.addText(r.label, {
      x: cx + 0.35, y: ry, w: cw / 2, h: 0.4,
      fontSize: 12, color: C.text, fontFace: F.body, margin: 0, valign: "middle",
    });
    addStatusDot(s, cx + cw - 1.25, ry + 0.13, r.color);
    s.addText(r.value, {
      x: cx + cw - 1.05, y: ry, w: 0.85, h: 0.4,
      fontSize: 11, color: C.textMuted, fontFace: F.mono, margin: 0, valign: "middle",
    });
  });

  // Card bottom badge
  addPill(s, cx + 0.35, cy + ch - 0.65, 1.5, 0.32, "v0.1.0", {
    bg: C.primarySoft, fg: C.primaryDeep, fontSize: 9,
  });
  s.addText("local · zero-cloud", {
    x: cx + 1.95, y: cy + ch - 0.65, w: cw - 2.3, h: 0.32,
    fontSize: 10, color: C.textSubtle, fontFace: F.mono, margin: 0, valign: "middle",
  });
}

// =====================================================================
// SLIDE 2 — The on-call tax
// =====================================================================
{
  const s = pres.addSlide(); setBg(s);
  addTopBar(s, "PROBLEM", 2);
  addTitle(s, "The on-call tax");
  addKicker(s, "On-call engineers spend 30–60 minutes per ticket re-deriving context that already exists.");

  const cards = [
    { tag: "01", title: "Context fragmentation",
      body: "Logs, dashboards, runbooks, and Slack threads scattered across systems with no single pane of glass." },
    { tag: "02", title: "Pattern blindness",
      body: "\"Didn't we see this last quarter?\" — but no fast way to surface the resolved ticket that already has the fix." },
    { tag: "03", title: "RCA fatigue",
      body: "Engineers skip or rush root-cause analysis. Recurring failure modes go uncaptured and the cycle repeats." },
  ];

  const cardW = 3.95, cardH = 3.6, gap = 0.32;
  const totalW = cards.length * cardW + (cards.length - 1) * gap;
  const startX = (SW - totalW) / 2;
  const cardY = 2.7;

  cards.forEach((c, i) => {
    const x = startX + i * (cardW + gap);
    addCard(s, x, cardY, cardW, cardH);

    // Tag pill
    addPill(s, x + 0.4, cardY + 0.45, 0.7, 0.32, c.tag, {
      bg: C.primarySoft, fg: C.primaryDeep, fontSize: 10,
    });

    // Title
    s.addText(c.title, {
      x: x + 0.4, y: cardY + 1.0, w: cardW - 0.8, h: 0.7,
      fontSize: 20, bold: true, color: C.text, fontFace: F.body, margin: 0,
    });

    // Body
    s.addText(c.body, {
      x: x + 0.4, y: cardY + 1.85, w: cardW - 0.8, h: cardH - 2.05,
      fontSize: 13, color: C.textMuted, fontFace: F.body, margin: 0, valign: "top",
    });
  });
}

// =====================================================================
// SLIDE 3 — System architecture
// =====================================================================
{
  const s = pres.addSlide(); setBg(s);
  addTopBar(s, "ARCHITECTURE", 3);
  addTitle(s, "System at a glance");
  addKicker(s, "One endpoint. Local models. Deterministic agent.");

  // Subtle background panel for the diagram
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 2.45, w: SW - 1, h: 4.5,
    fill: { color: C.surfaceMuted }, line: { color: C.border, width: 1 },
    rectRadius: 0.16,
  });

  const boxes = [
    { id: "front", label: "Frontend",       sub: "React + TypeScript",     x: 0.95, y: 4.10, w: 2.3, h: 1.2 },
    { id: "api",   label: "FastAPI",        sub: "POST /incident/analyze", x: 4.05, y: 4.10, w: 2.5, h: 1.2 },
    { id: "agent", label: "Agent",          sub: "LangGraph DAG",          x: 7.35, y: 4.10, w: 2.4, h: 1.2 },
    { id: "llm",   label: "Ollama",         sub: "Qwen 2.5 Coder",         x: 10.5, y: 2.85, w: 2.3, h: 1.1 },
    { id: "vec",   label: "ChromaDB",       sub: "GTE-Large embeddings",   x: 10.5, y: 5.40, w: 2.3, h: 1.1 },
    { id: "data",  label: "Synthetic data", sub: "JSONL ingest",           x: 7.40, y: 5.85, w: 2.3, h: 0.9 },
  ];

  boxes.forEach((b) => {
    addCard(s, b.x, b.y, b.w, b.h, { radius: 0.10, shadow: subtleShadow() });
    s.addText(b.label, {
      x: b.x + 0.18, y: b.y + 0.16, w: b.w - 0.36, h: 0.42,
      fontSize: 14, bold: true, color: C.text, fontFace: F.body, margin: 0,
    });
    s.addText(b.sub, {
      x: b.x + 0.18, y: b.y + 0.6, w: b.w - 0.36, h: 0.42,
      fontSize: 10, color: C.textMuted, fontFace: F.mono, margin: 0,
    });
  });

  // Connectors (thin purple lines with arrows)
  const connect = (x1, y1, x2, y2) => {
    s.addShape(pres.shapes.LINE, {
      x: x1, y: y1, w: x2 - x1, h: y2 - y1,
      line: { color: C.primary, width: 1.25, endArrowType: "triangle" },
    });
  };

  connect(3.25, 4.70, 4.05, 4.70);   // front → api
  connect(6.55, 4.70, 7.35, 4.70);   // api → agent
  connect(9.75, 4.50, 10.50, 3.45);  // agent → llm
  connect(9.75, 4.95, 10.50, 5.85);  // agent → vec
  connect(8.55, 5.85, 8.55, 5.30);   // data → agent (ingest)
}

// =====================================================================
// SLIDE 4 — The agent graph (parallel + sequential structure)
// =====================================================================
{
  const s = pres.addSlide(); setBg(s);
  addTopBar(s, "DESIGN · AGENT GRAPH", 4);
  addTitle(s, "Why a DAG, not a chain");
  addKicker(s, "Five nodes. Two waves of parallelism. One join. ~50% faster wall-clock.");

  // Diagram panel
  const dx = 0.5, dy = 2.5, dw = SW - 1, dh = 4.3;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: dx, y: dy, w: dw, h: dh,
    fill: { color: C.surfaceMuted }, line: { color: C.border, width: 1 },
    rectRadius: 0.16,
  });

  // ---------- Stage column labels (above the nodes) ----------
  const stages = [
    { x: 2.30, w: 1.95, label: "STAGE 1", sub: "parallel · from START" },
    { x: 5.40, w: 1.95, label: "STAGE 2", sub: "parallel · after retrieve" },
    { x: 9.10, w: 2.10, label: "STAGE 3", sub: "fan-in · waits for all 3" },
  ];
  stages.forEach((st) => {
    s.addText(st.label, {
      x: st.x, y: dy + 0.22, w: st.w, h: 0.3,
      fontSize: 10, color: C.primaryDeep, fontFace: F.mono, bold: true,
      margin: 0, align: "center", charSpacing: 2,
    });
    s.addText(st.sub, {
      x: st.x, y: dy + 0.52, w: st.w, h: 0.28,
      fontSize: 9, color: C.textMuted, fontFace: F.mono,
      margin: 0, align: "center",
    });
  });

  // Stage separators (subtle vertical dashed lines)
  s.addShape(pres.shapes.LINE, {
    x: 4.85, y: dy + 0.28, w: 0, h: dh - 0.95,
    line: { color: C.borderStrong, width: 0.5, dashType: "dash" },
  });
  s.addShape(pres.shapes.LINE, {
    x: 7.95, y: dy + 0.28, w: 0, h: dh - 0.95,
    line: { color: C.borderStrong, width: 0.5, dashType: "dash" },
  });

  // ---------- Node geometry ----------
  const nodeW = 1.7, nodeH = 0.7;
  const yTop    = 3.55; // summarize, suggest
  const yMid    = 4.55; // START, finalize, END
  const yBot    = 5.65; // retrieve, rca

  const startCx = 1.10, endCx = 12.20;
  const summX   = 2.50, sugX  = 5.55, rcaX = 5.55, retrX = 2.50;
  const finX    = 9.30, finW = 1.85;

  // ---------- START / END circles ----------
  const circle = (cx, cy, fill, line, label, labelColor) => {
    s.addShape(pres.shapes.OVAL, {
      x: cx - 0.40, y: cy - 0.40, w: 0.8, h: 0.8,
      fill: { color: fill }, line: { color: line, width: line === fill ? 0 : 1.5 },
    });
    s.addText(label, {
      x: cx - 0.5, y: cy - 0.4, w: 1.0, h: 0.8,
      fontSize: 9, color: labelColor, fontFace: F.mono, bold: true,
      align: "center", valign: "middle", margin: 0, charSpacing: 1,
    });
  };
  circle(startCx, yMid + 0.05, C.primary,  C.primary,     "START", "FFFFFF");
  circle(endCx,   yMid + 0.05, C.surface,  C.primary,     "END",   C.primaryDeep);

  // ---------- Process node helper ----------
  const node = (label, x, y, w = nodeW, h = nodeH) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h,
      fill: { color: C.surface }, line: { color: C.primary, width: 1.25 },
      rectRadius: 0.10, shadow: subtleShadow(),
    });
    s.addText(label, {
      x, y, w, h,
      fontSize: 13, color: C.text, fontFace: F.mono, bold: true,
      align: "center", valign: "middle", margin: 0,
    });
  };

  node("summarize", summX, yTop);
  node("retrieve",  retrX, yBot);
  node("suggest",   sugX,  yTop);
  node("rca",       rcaX,  yBot);
  node("finalize",  finX,  yMid + 0.05 - nodeH / 2, finW);

  // ---------- Connectors ----------
  // Fresh line opts each call (pptxgenjs mutates)
  const arrow = (x1, y1, x2, y2) => {
    s.addShape(pres.shapes.LINE, {
      x: x1, y: y1, w: x2 - x1, h: y2 - y1,
      line: { color: C.primary, width: 1.25, endArrowType: "triangle" },
    });
  };
  const seg = (x1, y1, x2, y2) => {
    s.addShape(pres.shapes.LINE, {
      x: x1, y: y1, w: x2 - x1, h: y2 - y1,
      line: { color: C.primary, width: 1.25 },
    });
  };

  // START → summarize  (diagonal up)
  arrow(startCx + 0.35, yMid - 0.05, summX, yTop + nodeH / 2);
  // START → retrieve (diagonal down)
  arrow(startCx + 0.35, yMid + 0.15, retrX, yBot + nodeH / 2);

  // retrieve → suggest (diagonal up across stages 1→2)
  arrow(retrX + nodeW, yBot + nodeH * 0.4, sugX, yTop + nodeH * 0.6);
  // retrieve → rca (horizontal, same Y)
  arrow(retrX + nodeW, yBot + nodeH / 2, rcaX, yBot + nodeH / 2);

  // summarize → finalize (orthogonal route over the top)
  // Three segments: right, down, then the final segment with the arrow
  const junctionX = 8.45;
  seg(summX + nodeW, yTop + nodeH / 2, junctionX, yTop + nodeH / 2);
  seg(junctionX, yTop + nodeH / 2, junctionX, yMid - nodeH * 0.25);
  arrow(junctionX, yMid - nodeH * 0.25, finX, yMid - nodeH * 0.25);

  // suggest → finalize (diagonal down)
  arrow(sugX + nodeW, yTop + nodeH * 0.7, finX, yMid + 0.05 - nodeH * 0.05);

  // rca → finalize (diagonal up)
  arrow(rcaX + nodeW, yBot + nodeH * 0.4, finX, yMid + nodeH * 0.25);

  // finalize → END
  arrow(finX + finW, yMid + 0.05, endCx - 0.40, yMid + 0.05);

  // ---------- Bottom callout: timing ----------
  const callY = dy + dh - 0.55;
  s.addShape(pres.shapes.LINE, {
    x: dx + 0.4, y: callY - 0.05, w: dw - 0.8, h: 0,
    line: { color: C.border, width: 0.5 },
  });
  s.addText([
    { text: "WALL-CLOCK   ",          options: { color: C.textMuted, fontSize: 10, fontFace: F.mono, charSpacing: 2 } },
    { text: "≈ 15–30 s",               options: { color: C.success,   fontSize: 14, fontFace: F.mono, bold: true } },
    { text: "  with the DAG    ·    ", options: { color: C.textMuted, fontSize: 11, fontFace: F.mono } },
    { text: "≈ 30–60 s",               options: { color: C.danger,    fontSize: 14, fontFace: F.mono, bold: true } },
    { text: "  strict-linear",         options: { color: C.textMuted, fontSize: 11, fontFace: F.mono } },
  ], {
    x: dx + 0.4, y: callY, w: dw - 0.8, h: 0.45,
    align: "center", valign: "middle", margin: 0,
  });
}

// =====================================================================
// SLIDE 5 — Local-first by design
// =====================================================================
{
  const s = pres.addSlide(); setBg(s);
  addTopBar(s, "WHY LOCAL", 5);
  addTitle(s, "Local-first by design");
  addKicker(s, "Privacy + zero per-call cost + offline demo. Every model fits in 16 GB RAM.");

  const cols = [
    { tag: "Privacy", stat: "0",    unit: "bytes leave the laptop", body: "Customer data, internal logs, and stack traces stay local. No cloud LLM, no third-party retention." },
    { tag: "Cost",    stat: "$0",   unit: "per call",                body: "No API limits, no per-token billing, no quota anxiety. Engineers iterate without watching a meter." },
    { tag: "Offline", stat: "100%", unit: "available",               body: "Works on a flight, behind a firewall, or during a cloud-provider outage. The demo doesn't depend on the internet." },
  ];

  const colW = 3.95, colH = 4.0, gap = 0.32;
  const totalW = cols.length * colW + (cols.length - 1) * gap;
  const startX = (SW - totalW) / 2;
  const yTop = 2.6;

  cols.forEach((c, i) => {
    const x = startX + i * (colW + gap);
    addCard(s, x, yTop, colW, colH);

    addPill(s, x + 0.4, yTop + 0.4, 1.4, 0.32, c.tag.toUpperCase(), {
      bg: C.primarySoft, fg: C.primaryDeep, fontSize: 9,
    });

    s.addText(c.stat, {
      x: x + 0.4, y: yTop + 0.95, w: colW - 0.8, h: 1.3,
      fontSize: 60, bold: true, color: C.text, fontFace: F.body, margin: 0,
    });
    s.addText(c.unit, {
      x: x + 0.4, y: yTop + 2.25, w: colW - 0.8, h: 0.3,
      fontSize: 11, color: C.textMuted, fontFace: F.mono, margin: 0, charSpacing: 1,
    });

    s.addText(c.body, {
      x: x + 0.4, y: yTop + 2.7, w: colW - 0.8, h: colH - 2.85,
      fontSize: 12, color: C.textSecond, fontFace: F.body, margin: 0, valign: "top",
    });
  });

  // Stack strip at bottom
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 6.85, w: SW - 1, h: 0.45,
    fill: { color: C.surfaceMuted }, line: { color: C.border, width: 0.75 },
    rectRadius: 0.08,
  });
  s.addText("STACK   Ollama  ·  Qwen 2.5 Coder Instruct (4.7 GB)  ·  GTE-Large (358 MB)  ·  ChromaDB", {
    x: 0.5, y: 6.85, w: SW - 1, h: 0.45,
    fontSize: 10, color: C.textMuted, fontFace: F.mono,
    align: "center", valign: "middle", margin: 0, charSpacing: 1,
  });
}

// =====================================================================
// SLIDE 6 — LangGraph for orchestration
// =====================================================================
{
  const s = pres.addSlide(); setBg(s);
  addTopBar(s, "STACK · ORCHESTRATION", 6);
  addTitle(s, "LangGraph for orchestration");
  addKicker(s, "Typed state, deterministic flow, native parallel branching.");

  // Left: reasons card
  const lx = 0.5, ly = 2.5, lw = 5.7, lh = 4.4;
  addCard(s, lx, ly, lw, lh);

  const reasons = [
    { h: "Typed state",            b: "AgentState as a TypedDict — every node sees the same schema; mypy catches typos before runtime." },
    { h: "Deterministic by design", b: "No ReAct loop. Small local models can drop tool-call format mid-loop and freeze the demo." },
    { h: "Native fan-out / fan-in", b: "add_edge supports list sources for joins. Parallel branches without manual sync code." },
    { h: "Structured output",       b: "with_structured_output(RCA) returns a validated Pydantic object. No JSON regex." },
  ];

  reasons.forEach((r, i) => {
    const ry = ly + 0.4 + i * 1.0;
    // Purple dot bullet
    s.addShape(pres.shapes.OVAL, {
      x: lx + 0.45, y: ry + 0.12, w: 0.16, h: 0.16,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 },
    });
    s.addText(r.h, {
      x: lx + 0.75, y: ry, w: lw - 1.0, h: 0.35,
      fontSize: 14, bold: true, color: C.text, fontFace: F.body, margin: 0,
    });
    s.addText(r.b, {
      x: lx + 0.75, y: ry + 0.38, w: lw - 1.0, h: 0.6,
      fontSize: 11.5, color: C.textMuted, fontFace: F.body, margin: 0, valign: "top",
    });
  });

  // Right: code block (dark)
  const rx = 6.4, ry = 2.5, rw = 6.4, rh = 4.4;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: rx, y: ry, w: rw, h: rh,
    fill: { color: C.codeBg }, line: { color: C.codeBg, width: 0 },
    rectRadius: 0.14, shadow: cardShadow(),
  });

  // Header strip with window dots + filename
  s.addShape(pres.shapes.RECTANGLE, {
    x: rx, y: ry, w: rw, h: 0.5,
    fill: { color: C.codeBgLight }, line: { color: C.codeBgLight, width: 0 },
  });
  ["EF4444", "F59E0B", "10B981"].forEach((dot, i) => {
    s.addShape(pres.shapes.OVAL, {
      x: rx + 0.25 + i * 0.27, y: ry + 0.17, w: 0.16, h: 0.16,
      fill: { color: dot }, line: { color: dot, width: 0 },
    });
  });
  s.addText("agent/graph.py", {
    x: rx, y: ry, w: rw, h: 0.5,
    fontSize: 11, color: C.codeMuted, fontFace: F.mono,
    align: "center", valign: "middle", margin: 0,
  });

  // Code body
  const code = [
    { text: "class ",                                   options: { color: C.codeKeyword } },
    { text: "AgentState",                               options: { color: C.codeFunc } },
    { text: "(TypedDict):\n",                            options: { color: C.codeFg } },
    { text: "    incident: Incident\n",                  options: { color: C.codeFg } },
    { text: "    summary: str\n",                        options: { color: C.codeFg } },
    { text: "    similar_incidents: list[RetrievalResult]\n", options: { color: C.codeFg } },
    { text: "    suggested_steps: list[str]\n",          options: { color: C.codeFg } },
    { text: "    rca: RCA\n",                            options: { color: C.codeFg } },
    { text: "    confidence: float\n",                   options: { color: C.codeFg } },
    { text: "    trace: Annotated[list[TraceStep], add]\n\n", options: { color: C.codeFg } },
    { text: "graph.",                                    options: { color: C.codeFg } },
    { text: "add_edge",                                  options: { color: C.codeFunc } },
    { text: "(START, ",                                  options: { color: C.codeFg } },
    { text: "\"summarize\"",                              options: { color: C.codeString } },
    { text: ")\n",                                       options: { color: C.codeFg } },
    { text: "graph.",                                    options: { color: C.codeFg } },
    { text: "add_edge",                                  options: { color: C.codeFunc } },
    { text: "(START, ",                                  options: { color: C.codeFg } },
    { text: "\"retrieve\"",                               options: { color: C.codeString } },
    { text: ")\n",                                       options: { color: C.codeFg } },
    { text: "graph.",                                    options: { color: C.codeFg } },
    { text: "add_edge",                                  options: { color: C.codeFunc } },
    { text: "(",                                         options: { color: C.codeFg } },
    { text: "[\"summarize\", \"suggest\", \"rca\"]",       options: { color: C.codeString } },
    { text: ", ",                                        options: { color: C.codeFg } },
    { text: "\"finalize\"",                              options: { color: C.codeString } },
    { text: ")",                                         options: { color: C.codeFg } },
  ];
  s.addText(code, {
    x: rx + 0.4, y: ry + 0.7, w: rw - 0.8, h: rh - 0.95,
    fontSize: 12, fontFace: F.mono, margin: 0, valign: "top",
  });
}

// =====================================================================
// SLIDE 7 — ChromaDB
// =====================================================================
{
  const s = pres.addSlide(); setBg(s);
  addTopBar(s, "STACK · STORAGE", 7);
  addTitle(s, "ChromaDB: zero infra, full power");
  addKicker(s, "Persists to a local directory, one-line LangChain integration, scores in [0, 1].");

  // Wrapping card
  const tx = 0.5, ty = 2.5, tw = SW - 1, th = 4.0;
  addCard(s, tx, ty, tw, th, { radius: 0.14 });

  const headerOpts = { fill: { color: C.surfaceMuted }, color: C.text, bold: true, fontFace: F.body, fontSize: 13, align: "center", valign: "middle" };
  const headerOptsAccent = { ...headerOpts, color: C.primaryDeep };
  const cellBase = { color: C.textSecond, fontFace: F.body, fontSize: 12, align: "center", valign: "middle" };
  const labelCell = { color: C.text, fontFace: F.mono, fontSize: 11, align: "left", valign: "middle", bold: true };

  const tableData = [
    [
      { text: "  Criterion",            options: labelCell },
      { text: "ChromaDB",                options: headerOptsAccent },
      { text: "Pinecone",                options: headerOpts },
      { text: "FAISS",                   options: headerOpts },
    ],
    [
      { text: "  Setup",                 options: labelCell },
      { text: "pip install. Done.",      options: cellBase },
      { text: "Account + API key",       options: cellBase },
      { text: "pip install. Done.",      options: cellBase },
    ],
    [
      { text: "  Persistence",           options: labelCell },
      { text: "Local directory",         options: cellBase },
      { text: "Managed cloud",           options: cellBase },
      { text: "Manual file management",  options: cellBase },
    ],
    [
      { text: "  LangChain integration", options: labelCell },
      { text: "First-class",             options: cellBase },
      { text: "First-class",             options: cellBase },
      { text: "First-class",             options: cellBase },
    ],
    [
      { text: "  Local / offline",       options: labelCell },
      { text: "Yes",                     options: cellBase },
      { text: "No (cloud only)",         options: cellBase },
      { text: "Yes",                     options: cellBase },
    ],
    [
      { text: "  Metadata + filtering",  options: labelCell },
      { text: "Built-in",                options: cellBase },
      { text: "Built-in",                options: cellBase },
      { text: "DIY",                     options: cellBase },
    ],
  ];

  s.addTable(tableData, {
    x: tx + 0.3, y: ty + 0.3, w: tw - 0.6, h: th - 0.6,
    colW: [3.0, 3.05, 3.05, 3.05],
    rowH: 0.55,
    border: { type: "solid", pt: 0.5, color: C.border },
    fontFace: F.body,
  });

  s.addText("Decisive for a hackathon: zero infra, no account, no internet dependency for the demo.", {
    x: 0.5, y: 6.7, w: SW - 1, h: 0.35,
    fontSize: 11, color: C.textMuted, fontFace: F.body, margin: 0, align: "center",
  });
}

// =====================================================================
// SLIDE 8 — Synthetic data
// =====================================================================
{
  const s = pres.addSlide(); setBg(s);
  addTopBar(s, "DATA", 8);
  addTitle(s, "Quality of corpus = quality of retrieval");
  addKicker(s, "We don't have real incidents — so we generate breadth without manual enumeration.");

  // Left: pipeline card
  const lx = 0.5, ly = 2.5, lw = 7.0, lh = 4.4;
  addCard(s, lx, ly, lw, lh);

  s.addText("Generation pipeline", {
    x: lx + 0.4, y: ly + 0.35, w: lw - 0.8, h: 0.4,
    fontSize: 16, bold: true, color: C.text, fontFace: F.body, margin: 0,
  });

  const steps = [
    { n: "1", h: "Generate",        b: "LLM seeded with diversity dimensions (service, severity, symptom, time-of-day) — many incidents per dimension combo." },
    { n: "2", h: "Validate",        b: "Schema-check each record against the Incident Pydantic model. Spot-check a sample for plausibility." },
    { n: "3", h: "Embed and index", b: "gte-large via Ollama embeds title + description + tags. ChromaDB persists the index to disk." },
  ];

  steps.forEach((st, i) => {
    const sy = ly + 1.0 + i * 1.05;
    // Step number badge (purple)
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: lx + 0.4, y: sy, w: 0.5, h: 0.5,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 },
      rectRadius: 0.1,
    });
    s.addText(st.n, {
      x: lx + 0.4, y: sy, w: 0.5, h: 0.5,
      fontSize: 16, bold: true, color: "FFFFFF", fontFace: F.body,
      align: "center", valign: "middle", margin: 0,
    });
    s.addText(st.h, {
      x: lx + 1.05, y: sy - 0.05, w: lw - 1.5, h: 0.4,
      fontSize: 14, bold: true, color: C.text, fontFace: F.body, margin: 0,
    });
    s.addText(st.b, {
      x: lx + 1.05, y: sy + 0.32, w: lw - 1.5, h: 0.7,
      fontSize: 11.5, color: C.textMuted, fontFace: F.body, margin: 0, valign: "top",
    });
  });

  // Right: sample card
  const rx = 7.7, ry = 2.5, rw = 5.1, rh = 4.4;
  addCard(s, rx, ry, rw, rh);

  // Header strip
  addPill(s, rx + 0.3, ry + 0.35, 1.6, 0.3, "SAMPLE", {
    bg: C.primarySoft, fg: C.primaryDeep, fontSize: 9,
  });
  addStatusDot(s, rx + 2.05, ry + 0.43, C.danger);
  s.addText("P1", {
    x: rx + 2.25, y: ry + 0.32, w: 0.5, h: 0.34,
    fontSize: 11, color: C.danger, bold: true, fontFace: F.mono,
    margin: 0, valign: "middle",
  });

  s.addText("Payment Service HTTP 504", {
    x: rx + 0.3, y: ry + 0.85, w: rw - 0.6, h: 0.5,
    fontSize: 16, bold: true, color: C.text, fontFace: F.body, margin: 0,
  });

  // Subtle separator
  s.addShape(pres.shapes.LINE, {
    x: rx + 0.3, y: ry + 1.45, w: rw - 0.6, h: 0,
    line: { color: C.border, width: 0.75 },
  });

  const fields = [
    { k: "id",          v: "INC-2026-4821" },
    { k: "service",     v: "payment-service" },
    { k: "tags",        v: "HTTP_504, traffic-spike" },
    { k: "resolution",  v: "Increased timeouts; rolled back release." },
    { k: "rca",         v: "Tight upstream timeouts + DB pool exhausted before autoscaling caught up." },
  ];

  fields.forEach((f, i) => {
    const fy = ry + 1.6 + i * 0.55;
    s.addText(f.k, {
      x: rx + 0.3, y: fy, w: 1.2, h: 0.5,
      fontSize: 10, color: C.primaryDeep, fontFace: F.mono, bold: true, margin: 0, valign: "top",
    });
    s.addText(f.v, {
      x: rx + 1.5, y: fy, w: rw - 1.8, h: 0.5,
      fontSize: 11, color: C.text, fontFace: F.mono, margin: 0, valign: "top",
    });
  });
}

// =====================================================================
// SLIDE 9 — Responsible AI
// =====================================================================
{
  const s = pres.addSlide(); setBg(s);
  addTopBar(s, "RESPONSIBLE AI", 9);
  addTitle(s, "Copilot, not autopilot");
  addKicker(s, "Three layers of responsible-AI affordance — surfaced visibly in the UI.");

  const pillars = [
    { tag: "Grounding",    body: "Every suggested step is derived from a retrieved past incident. Prompts explicitly instruct the model to cite retrievals; ungrounded answers fall back to a generic playbook with lower confidence." },
    { tag: "Transparency", body: "The UI shows similarity scores next to each retrieval, the agent's confidence, and a per-node trace of what ran. Engineers can audit each claim before acting." },
    { tag: "Friction",     body: "A persistent \"AI-generated, verify before acting\" banner. The agent never executes anything — the engineer applies the fix. Confidence under 0.4 surfaces as a red warning." },
  ];

  const colW = 3.95, colH = 4.0, gap = 0.32;
  const totalW = pillars.length * colW + (pillars.length - 1) * gap;
  const startX = (SW - totalW) / 2;
  const yTop = 2.6;

  pillars.forEach((p, i) => {
    const x = startX + i * (colW + gap);
    addCard(s, x, yTop, colW, colH);

    // Numbered tag
    addPill(s, x + 0.4, yTop + 0.4, 0.7, 0.32, `0${i + 1}`, {
      bg: C.primarySoft, fg: C.primaryDeep, fontSize: 10,
    });

    s.addText(p.tag, {
      x: x + 0.4, y: yTop + 0.95, w: colW - 0.8, h: 0.6,
      fontSize: 22, bold: true, color: C.text, fontFace: F.body, margin: 0,
    });

    // Tiny accent under
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.4, y: yTop + 1.6, w: 0.6, h: 0.04,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 },
    });

    s.addText(p.body, {
      x: x + 0.4, y: yTop + 1.85, w: colW - 0.8, h: colH - 2.05,
      fontSize: 12, color: C.textSecond, fontFace: F.body, margin: 0, valign: "top",
    });
  });

  s.addText("The hackathon brief grades responsible AI. These three layers are the answer.", {
    x: 0.5, y: 6.85, w: SW - 1, h: 0.35,
    fontSize: 11, color: C.textMuted, fontFace: F.body, margin: 0, align: "center",
  });
}

// =====================================================================
// SLIDE 10 — Where this goes next
// =====================================================================
{
  const s = pres.addSlide(); setBg(s);
  addTopBar(s, "ROADMAP", 10);
  addTitle(s, "Where this goes next");
  addKicker(s, "What we'd build with another week — infrastructure, models, and agentic RAG.");

  const cols = [
    {
      tag: "Infrastructure",
      items: [
        "Shared GPU instance running vLLM — batched inference, 5–10× throughput",
        "Managed vector store (Pinecone / Weaviate) once corpus exceeds ~1M incidents",
        "Streaming SSE — summary tokens flow while RCA is still computing",
      ],
    },
    {
      tag: "Models",
      items: [
        "Fine-tune the generation model on the synthetic corpus + real resolved tickets",
        "Cross-encoder re-ranker on top of embedding retrieval — boosts top-3 precision",
        "Specialized models per node — keep Qwen for RCA, smaller model for summarize",
      ],
    },
    {
      tag: "Agentic RAG",
      items: [
        "Iterative retrieve → reflect → refine — when retrieval confidence is low, agent rewrites the query",
        "Multi-step decomposition — split incident into symptom / service / time sub-queries",
        "Tool-calling for live signals — current deploy status, error logs, dashboard metrics",
      ],
    },
  ];

  const colW = 4.05, colH = 4.4, gap = 0.27;
  const totalW = cols.length * colW + (cols.length - 1) * gap;
  const startX = (SW - totalW) / 2;
  const yTop = 2.5;

  cols.forEach((c, i) => {
    const x = startX + i * (colW + gap);
    addCard(s, x, yTop, colW, colH);

    addPill(s, x + 0.4, yTop + 0.4, 2.6, 0.34, c.tag.toUpperCase(), {
      bg: C.primarySoft, fg: C.primaryDeep, fontSize: 10,
    });

    c.items.forEach((it, j) => {
      const iy = yTop + 1.05 + j * 1.05;
      // Purple dot
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.4, y: iy + 0.1, w: 0.16, h: 0.16,
        fill: { color: C.primary }, line: { color: C.primary, width: 0 },
      });
      s.addText(it, {
        x: x + 0.7, y: iy, w: colW - 1.0, h: 1.0,
        fontSize: 11.5, color: C.textSecond, fontFace: F.body, margin: 0, valign: "top",
      });
    });
  });
}

// =====================================================================
// SLIDE 11 — Demo
// =====================================================================
{
  const s = pres.addSlide(); setBg(s);

  // Subtle background panel on the right
  s.addShape(pres.shapes.RECTANGLE, {
    x: 7.5, y: 0, w: 5.8, h: SH,
    fill: { color: C.surfaceMuted }, line: { color: C.surfaceMuted, width: 0 },
  });

  // Big "DEMO" word, left-aligned
  s.addText("DEMO", {
    x: 0.5, y: 2.4, w: 7.0, h: 1.6,
    fontSize: 130, bold: true, color: C.text, fontFace: F.body,
    margin: 0, charSpacing: 14, valign: "middle",
  });

  // Underline accent
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 4.1, w: 1.4, h: 0.06,
    fill: { color: C.primary }, line: { color: C.primary, width: 0 },
  });

  s.addText("The copilot, live.", {
    x: 0.5, y: 4.3, w: 7.0, h: 0.5,
    fontSize: 22, color: C.textMuted, fontFace: F.body, margin: 0,
  });

  // URL pill
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 5.3, w: 4.0, h: 0.7,
    fill: { color: C.surface }, line: { color: C.border, width: 1 },
    rectRadius: 0.12, shadow: subtleShadow(),
  });
  addStatusDot(s, 0.8, 5.6, C.success);
  s.addText("localhost:5173", {
    x: 1.05, y: 5.3, w: 3.0, h: 0.7,
    fontSize: 16, color: C.text, fontFace: F.mono, bold: true,
    align: "left", valign: "middle", margin: 0,
  });

  // Right side: mock product card
  const cx = 8.0, cy = 1.6, cw = 4.8, ch = 4.4;
  addCard(s, cx, cy, cw, ch, { radius: 0.16 });

  ["EF4444", "F59E0B", "10B981"].forEach((dot, i) => {
    s.addShape(pres.shapes.OVAL, {
      x: cx + 0.3 + i * 0.27, y: cy + 0.32, w: 0.16, h: 0.16,
      fill: { color: dot }, line: { color: dot, width: 0 },
    });
  });
  s.addText("incident analysis", {
    x: cx, y: cy + 0.28, w: cw, h: 0.32,
    fontSize: 11, color: C.textMuted, fontFace: F.mono, align: "center", valign: "middle", margin: 0,
  });
  s.addShape(pres.shapes.LINE, {
    x: cx + 0.05, y: cy + 0.78, w: cw - 0.1, h: 0,
    line: { color: C.border, width: 0.75 },
  });

  // Output preview rows
  s.addText("SUMMARY", {
    x: cx + 0.35, y: cy + 1.0, w: cw - 0.7, h: 0.3,
    fontSize: 9, color: C.primaryDeep, fontFace: F.mono, bold: true, charSpacing: 2, margin: 0,
  });
  s.addText("payments-api 5xx after deploy v1.18.5", {
    x: cx + 0.35, y: cy + 1.32, w: cw - 0.7, h: 0.4,
    fontSize: 12, color: C.text, fontFace: F.body, margin: 0,
  });

  s.addText("SIMILAR INCIDENTS", {
    x: cx + 0.35, y: cy + 1.85, w: cw - 0.7, h: 0.3,
    fontSize: 9, color: C.primaryDeep, fontFace: F.mono, bold: true, charSpacing: 2, margin: 0,
  });
  ["HIST-0042   0.84", "HIST-0119   0.71"].forEach((line, i) => {
    s.addText(line, {
      x: cx + 0.35, y: cy + 2.18 + i * 0.32, w: cw - 0.7, h: 0.3,
      fontSize: 11, color: C.textSecond, fontFace: F.mono, margin: 0,
    });
  });

  s.addText("CONFIDENCE", {
    x: cx + 0.35, y: cy + 2.95, w: cw - 0.7, h: 0.3,
    fontSize: 9, color: C.primaryDeep, fontFace: F.mono, bold: true, charSpacing: 2, margin: 0,
  });
  // Confidence bar
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: cx + 0.35, y: cy + 3.32, w: cw - 0.7, h: 0.18,
    fill: { color: C.surfaceBack }, line: { color: C.border, width: 0.5 },
    rectRadius: 0.09,
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: cx + 0.35, y: cy + 3.32, w: (cw - 0.7) * 0.62, h: 0.18,
    fill: { color: C.primary }, line: { color: C.primary, width: 0 },
    rectRadius: 0.09,
  });
  s.addText("0.62", {
    x: cx + 0.35, y: cy + 3.6, w: cw - 0.7, h: 0.3,
    fontSize: 11, color: C.textMuted, fontFace: F.mono, margin: 0, align: "right",
  });

  // Bottom team line
  s.addText("Team 4   ·   TCS AI Friday Hackathon   ·   May 2026", {
    x: 0, y: 7.05, w: SW, h: 0.3,
    fontSize: 10, color: C.textMuted, fontFace: F.body,
    align: "center", margin: 0,
  });
}

// =====================================================================
pres.writeFile({ fileName: "incident-copilot.pptx" }).then(() => {
  console.log("✓ wrote incident-copilot.pptx");
});
