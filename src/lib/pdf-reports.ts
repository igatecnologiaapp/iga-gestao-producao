import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  type Material,
  type Product,
  type UnitOfMeasure,
  unitCost,
  productCost,
  formatBRL,
  formatBRLOrEmpty,
  formatQty,
} from "@/lib/store";

const COMPANY = "Empório Tutti Gula";
const SYSTEM = "Gestão de Produção";

function fmtDateTime(d = new Date()): string {
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function orNI(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "Não informado";
  return String(v);
}

function formatUnit(
  abbr: string | null | undefined,
  units: UnitOfMeasure[] = [],
): string {
  if (!abbr || abbr === "") return "Não informado";
  const match = units.find(
    (u) => u.abbreviation.toLowerCase() === abbr.toLowerCase(),
  );
  if (!match) return `${abbr} (legada)`;
  const suffix = match.active ? "" : " (inativa)";
  // "Nome (sigla)" — if name equals abbreviation, just show the abbreviation
  if (match.name.toLowerCase() === match.abbreviation.toLowerCase()) {
    return `${match.abbreviation}${suffix}`;
  }
  return `${match.name} (${match.abbreviation})${suffix}`;
}

function formatQtyWithUnit(
  qty: number,
  abbr: string | null | undefined,
): string {
  const a = abbr && abbr !== "" ? abbr : "";
  return `${formatQty(qty)}${a ? ` ${a}` : ""}`.trim();
}

function addHeaderFooter(doc: jsPDF, title: string) {
  const pageCount = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(COMPANY, 40, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(SYSTEM, 40, 44);
    doc.text(`Emitido em ${fmtDateTime()}`, pageW - 40, 30, { align: "right" });
    doc.text(title, pageW - 40, 44, { align: "right" });
    doc.setDrawColor(200);
    doc.line(40, 52, pageW - 40, 52);
    // Footer
    doc.setFontSize(9);
    doc.setTextColor(140);
    doc.text(`Página ${i} de ${pageCount}`, pageW - 40, pageH - 20, { align: "right" });
    doc.text(COMPANY, 40, pageH - 20);
  }
}

function save(doc: jsPDF, name: string) {
  addHeaderFooter(doc, doc.getNumberOfPages() > 0 ? (doc as any).__title ?? "" : "");
  doc.save(name);
}

function startDoc(title: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  (doc as any).__title = title;
  return doc;
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30);
  doc.text(text, 40, y);
  return y + 18;
}

function kv(doc: jsPDF, label: string, value: string, x: number, y: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(label, x, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text(value, x, y + 14);
}

export function exportGeneralReport(
  products: Product[],
  materials: Material[],
  units: UnitOfMeasure[] = [],
) {
  if (products.length === 0) {
    alert("Não há produtos cadastrados para exportar.");
    return;
  }
  const title = "Relatório Geral de Custos e Margens";
  const doc = startDoc(title);

  let y = 80;
  y = sectionTitle(doc, title, y);

  const rows = products.map((p) => {
    const cost = productCost(p, materials);
    const hasSale = p.salePrice != null && p.salePrice > 0;
    const sale = p.salePrice ?? 0;
    const profit = hasSale ? sale - cost : null;
    const margin = hasSale ? ((sale - cost) / sale) * 100 : null;
    const costPct = hasSale ? (cost / sale) * 100 : null;
    return { p, cost, hasSale, sale, profit, margin, costPct };
  });

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalSale = rows.reduce((s, r) => s + (r.p.salePrice ?? 0), 0);
  const totalProfit = totalSale - totalCost;
  const avgMargin = totalSale > 0 ? (totalProfit / totalSale) * 100 : 0;

  // Summary KVs
  y += 6;
  const col = [40, 190, 340, 490];
  kv(doc, "Produtos cadastrados", String(products.length), col[0], y);
  kv(doc, "Matérias-primas", String(materials.length), col[1], y);
  kv(doc, "Custo total", formatBRL(totalCost), col[2], y);
  kv(doc, "Venda total", formatBRL(totalSale), col[3], y);
  y += 40;
  kv(doc, "Lucro bruto total", formatBRL(totalProfit), col[0], y);
  kv(doc, "Margem média", `${avgMargin.toFixed(1)}%`, col[1], y);
  y += 30;

  autoTable(doc, {
    startY: y,
    head: [["Produto", "Unid.", "Categoria", "Custo real", "Venda", "Lucro", "Margem %", "Custo/Venda %"]],
    body: rows.map((r) => [
      r.p.name,
      formatUnit(r.p.unit, units),
      orNI(r.p.category ?? null),
      formatBRL(r.cost),
      formatBRLOrEmpty(r.p.salePrice),
      r.profit == null ? "Não informado" : formatBRL(r.profit),
      r.margin == null ? "Não informado" : `${r.margin.toFixed(1)}%`,
      r.costPct == null ? "Não informado" : `${r.costPct.toFixed(1)}%`,
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [40, 40, 60], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    margin: { left: 40, right: 40, top: 70, bottom: 40 },
  });

  save(doc, `relatorio-geral-${Date.now()}.pdf`);
}

export function exportMaterialsReport(
  materials: Material[],
  units: UnitOfMeasure[] = [],
) {
  if (materials.length === 0) {
    alert("Não há matérias-primas cadastradas para exportar.");
    return;
  }
  const title = "Relatório de Matérias-Primas";
  const doc = startDoc(title);
  let y = 80;
  y = sectionTitle(doc, title, y);
  y += 6;
  kv(doc, "Total de matérias-primas", String(materials.length), 40, y);
  y += 30;

  autoTable(doc, {
    startY: y,
    head: [["Matéria-prima", "Unid.", "Categoria", "Preço compra", "Qtd. comprada", "Custo unitário", "Observações"]],
    body: materials.map((m) => [
      m.name,
      formatUnit(m.unit, units),
      orNI(m.category ?? null),
      m.purchasePrice == null ? "Não informado" : formatBRL(m.purchasePrice),
      m.purchaseQty == null
        ? "Não informado"
        : formatQtyWithUnit(m.purchaseQty, m.unit),
      formatBRL(unitCost(m)),
      orNI(m.notes ?? null),
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [40, 40, 60], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    margin: { left: 40, right: 40, top: 70, bottom: 40 },
  });

  save(doc, `materias-primas-${Date.now()}.pdf`);
}

export function exportProductSheet(
  product: Product,
  materials: Material[],
  units: UnitOfMeasure[] = [],
) {
  const title = "Ficha Técnica do Produto";
  const doc = startDoc(title);
  let y = 80;
  y = sectionTitle(doc, product.name, y);

  const cost = productCost(product, materials);
  const hasSale = product.salePrice != null && product.salePrice > 0;
  const sale = product.salePrice ?? 0;
  const profit = hasSale ? sale - cost : null;
  const margin = hasSale ? ((sale - cost) / sale) * 100 : null;
  const costPct = hasSale ? (cost / sale) * 100 : null;

  // Info block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  const info: [string, string][] = [
    ["Unidade", formatUnit(product.unit, units)],
    ["Categoria", orNI(product.category ?? null)],
    ["Código interno", orNI(product.internalCode ?? null)],
    ["Código de barras", orNI(product.barcode ?? null)],
  ];
  info.forEach(([k, v], i) => {
    const x = 40 + (i % 2) * 270;
    const yy = y + Math.floor(i / 2) * 30;
    kv(doc, k, v, x, yy);
  });
  y += 70;

  if (product.description) {
    kv(doc, "Descrição", product.description, 40, y);
    y += 34;
  }
  if (product.notes) {
    kv(doc, "Observações", product.notes, 40, y);
    y += 34;
  }

  // Financial summary
  const col = [40, 190, 340, 490];
  kv(doc, "Valor de venda", hasSale ? formatBRL(sale) : "Não informado", col[0], y);
  kv(doc, "Custo total real", formatBRL(cost), col[1], y);
  kv(doc, "Lucro bruto", profit == null ? "Não informado" : formatBRL(profit), col[2], y);
  kv(doc, "Margem bruta", margin == null ? "Não informado" : `${margin.toFixed(1)}%`, col[3], y);
  y += 40;
  kv(doc, "Custo sobre venda", costPct == null ? "Não informado" : `${costPct.toFixed(1)}%`, col[0], y);
  y += 36;

  y = sectionTitle(doc, "Composição", y);

  if (product.sheet.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text("Nenhuma matéria-prima cadastrada na ficha técnica.", 40, y + 10);
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Matéria-prima", "Unid.", "Qtd. utilizada", "Custo unitário", "Custo na ficha", "% do custo"]],
      body: product.sheet.map((item) => {
        const m = materials.find((x) => x.id === item.materialId);
        if (!m) {
          return ["(removido)", "—", formatQty(item.quantity), "—", "—", "—"];
        }
        const u = unitCost(m);
        const itemCost = u * item.quantity;
        const share = cost > 0 ? (itemCost / cost) * 100 : 0;
        return [
          m.name,
          formatUnit(m.unit, units),
          formatQtyWithUnit(item.quantity, m.unit),
          `${formatBRL(u)}${m.unit ? ` /${m.unit}` : ""}`,
          formatBRL(itemCost),
          `${share.toFixed(1)}%`,
        ];
      }),
      foot: [["", "", "", "Total", formatBRL(cost), "100%"]],
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [40, 40, 60], textColor: 255 },
      footStyles: { fillColor: [230, 230, 240], textColor: 30, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      margin: { left: 40, right: 40, top: 70, bottom: 40 },
    });
  }

  const safeName = product.name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
  save(doc, `ficha-${safeName}-${Date.now()}.pdf`);
}