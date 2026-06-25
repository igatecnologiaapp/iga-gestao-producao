import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Unit =
  | "kg"
  | "g"
  | "litro"
  | "ml"
  | "unidade"
  | "pacote"
  | "caixa"
  | "porção"
  | "outra";

export const UNITS: Unit[] = [
  "kg",
  "g",
  "litro",
  "ml",
  "unidade",
  "pacote",
  "caixa",
  "porção",
  "outra",
];

export interface UnitOfMeasure {
  id: string;
  name: string;
  abbreviation: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
}

export interface Material {
  id: string;
  name: string;
  unit: Unit | null;
  purchasePrice: number | null;
  purchaseQty: number | null;
  category?: string | null;
  notes?: string | null;
}

export interface SheetItem {
  id: string;
  materialId: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  unit: Unit | null;
  salePrice: number | null;
  category?: string | null;
  description?: string | null;
  internalCode?: string | null;
  barcode?: string | null;
  notes?: string | null;
  sheet: SheetItem[];
}

interface DB {
  materials: Material[];
  products: Product[];
  units: UnitOfMeasure[];
}

const initial: DB = { materials: [], products: [], units: [] };

let state: DB = initial;
let hydrated = false;
let hydrating = false;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
const listeners = new Set<() => void>();

function setState(next: DB) {
  state = next;
  listeners.forEach((l) => l());
}

async function loadAll(): Promise<DB> {
  const [matsRes, prodsRes, itemsRes, unitsRes] = await Promise.all([
    supabase.from("materials").select("*").order("name"),
    supabase.from("products").select("*").order("name"),
    supabase.from("sheet_items").select("*"),
    supabase
      .from("units_of_measure")
      .select("*")
      .order("display_order")
      .order("name"),
  ]);
  if (matsRes.error || prodsRes.error || itemsRes.error) {
    return state;
  }
  const materials: Material[] = (matsRes.data ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    unit: (m.unit ?? null) as Unit | null,
    purchasePrice: m.purchase_price == null ? null : Number(m.purchase_price),
    purchaseQty: m.purchase_qty == null ? null : Number(m.purchase_qty),
    category: m.category ?? null,
    notes: m.notes ?? null,
  }));
  const itemsByProduct = new Map<string, SheetItem[]>();
  for (const it of itemsRes.data ?? []) {
    const arr = itemsByProduct.get(it.product_id) ?? [];
    arr.push({ id: it.id, materialId: it.material_id, quantity: Number(it.quantity) });
    itemsByProduct.set(it.product_id, arr);
  }
  const products: Product[] = (prodsRes.data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    unit: (p.unit ?? null) as Unit | null,
    salePrice: p.sale_price == null ? null : Number(p.sale_price),
    category: p.category ?? null,
    description: p.description ?? null,
    internalCode: p.internal_code ?? null,
    barcode: p.barcode ?? null,
    notes: p.notes ?? null,
    sheet: itemsByProduct.get(p.id) ?? [],
  }));
  const units: UnitOfMeasure[] = (unitsRes.data ?? []).map((u: any) => ({
    id: u.id,
    name: u.name,
    abbreviation: u.abbreviation,
    description: u.description ?? null,
    active: u.active !== false,
    displayOrder: Number(u.display_order ?? 0),
  }));
  return { materials, products, units };
}

let reloadScheduled = false;
async function reload() {
  if (reloadScheduled) return;
  reloadScheduled = true;
  await new Promise((r) => setTimeout(r, 50));
  reloadScheduled = false;
  const next = await loadAll();
  setState(next);
}

function startRealtime() {
  if (realtimeChannel) return;
  realtimeChannel = supabase
    .channel("public:fichatec")
    .on("postgres_changes", { event: "*", schema: "public", table: "materials" }, reload)
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, reload)
    .on("postgres_changes", { event: "*", schema: "public", table: "sheet_items" }, reload)
    .on("postgres_changes", { event: "*", schema: "public", table: "units_of_measure" }, reload)
    .subscribe();
}

async function ensureHydrated() {
  if (hydrated || hydrating || typeof window === "undefined") return;
  hydrating = true;
  try {
    const next = await loadAll();
    setState(next);
    hydrated = true;
    startRealtime();
  } finally {
    hydrating = false;
  }
}

export function refreshDB() {
  void reload();
}

function subscribe(l: () => void) {
  void ensureHydrated();
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): DB {
  return state;
}

function getServerSnapshot(): DB {
  return initial;
}

export function useDB() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function toMaterialRow(m: Partial<Omit<Material, "id">>) {
  const row: any = {};
  if (m.name !== undefined) row.name = m.name;
  if (m.unit !== undefined) row.unit = m.unit;
  if (m.purchasePrice !== undefined) row.purchase_price = m.purchasePrice;
  if (m.purchaseQty !== undefined) row.purchase_qty = m.purchaseQty;
  if (m.category !== undefined) row.category = m.category;
  if (m.notes !== undefined) row.notes = m.notes;
  return row;
}

function toProductRow(p: Partial<Omit<Product, "id" | "sheet">>) {
  const row: any = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.unit !== undefined) row.unit = p.unit;
  if (p.salePrice !== undefined) row.sale_price = p.salePrice;
  if (p.category !== undefined) row.category = p.category;
  if (p.description !== undefined) row.description = p.description;
  if (p.internalCode !== undefined) row.internal_code = p.internalCode;
  if (p.barcode !== undefined) row.barcode = p.barcode;
  if (p.notes !== undefined) row.notes = p.notes;
  return row;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export const db = {
  async addMaterial(m: Omit<Material, "id">) {
    const uid = await currentUserId();
    const { error } = await supabase
      .from("materials")
      .insert({ ...toMaterialRow(m), created_by: uid });
    if (error) console.error("addMaterial:", error);
    void reload();
  },
  async updateMaterial(id: string, patch: Partial<Material>) {
    const { error } = await supabase
      .from("materials")
      .update(toMaterialRow(patch))
      .eq("id", id);
    if (error) console.error("updateMaterial:", error);
    void reload();
  },
  async deleteMaterial(id: string) {
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) console.error("deleteMaterial:", error);
    void reload();
  },
  async addProduct(p: Omit<Product, "id" | "sheet"> & { sheet?: SheetItem[] }) {
    const uid = await currentUserId();
    const { error } = await supabase
      .from("products")
      .insert({ ...toProductRow(p), created_by: uid });
    if (error) console.error("addProduct:", error);
    void reload();
  },
  async updateProduct(id: string, patch: Partial<Product>) {
    const { sheet: _ignored, ...rest } = patch as any;
    const { error } = await supabase
      .from("products")
      .update(toProductRow(rest))
      .eq("id", id);
    if (error) console.error("updateProduct:", error);
    void reload();
  },
  async deleteProduct(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) console.error("deleteProduct:", error);
    void reload();
  },
  async addSheetItem(productId: string, item: Omit<SheetItem, "id">) {
    const { error } = await supabase.from("sheet_items").insert({
      product_id: productId,
      material_id: item.materialId,
      quantity: item.quantity,
    });
    if (error) console.error("addSheetItem:", error);
    void reload();
  },
  async updateSheetItem(_productId: string, itemId: string, patch: Partial<SheetItem>) {
    const row: any = {};
    if (patch.materialId !== undefined) row.material_id = patch.materialId;
    if (patch.quantity !== undefined) row.quantity = patch.quantity;
    const { error } = await supabase.from("sheet_items").update(row).eq("id", itemId);
    if (error) console.error("updateSheetItem:", error);
    void reload();
  },
  async removeSheetItem(_productId: string, itemId: string) {
    const { error } = await supabase.from("sheet_items").delete().eq("id", itemId);
    if (error) console.error("removeSheetItem:", error);
    void reload();
  },
};

export function unitCost(m: Material): number {
  if (!m.purchaseQty || m.purchaseQty <= 0) return 0;
  if (m.purchasePrice == null) return 0;
  return m.purchasePrice / m.purchaseQty;
}

export function productCost(p: Product, materials: Material[]): number {
  return p.sheet.reduce((sum, item) => {
    const m = materials.find((x) => x.id === item.materialId);
    if (!m) return sum;
    return sum + unitCost(m) * item.quantity;
  }, 0);
}

export function formatBRL(n: number): string {
  if (!isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatQty(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

export const OPTIONAL_PRODUCT_FIELDS: { key: keyof Product; label: string }[] = [
  { key: "salePrice", label: "Valor de venda" },
  { key: "unit", label: "Unidade de medida" },
  { key: "category", label: "Categoria" },
  { key: "description", label: "Descrição" },
  { key: "internalCode", label: "Código interno" },
  { key: "barcode", label: "Código de barras" },
  { key: "notes", label: "Observações" },
];

export function missingProductFields(p: Product): string[] {
  const missing: string[] = [];
  for (const f of OPTIONAL_PRODUCT_FIELDS) {
    const v = p[f.key];
    if (v === null || v === undefined || v === "") missing.push(f.label);
  }
  if (!p.sheet || p.sheet.length === 0) missing.push("Ficha técnica");
  return missing;
}

export type ProductStatus = "complete" | "partial" | "incomplete";

export function productStatus(p: Product): ProductStatus {
  const missing = missingProductFields(p);
  if (missing.length === 0) return "complete";
  const filled = OPTIONAL_PRODUCT_FIELDS.length + 1 - missing.length;
  if (filled <= 1) return "incomplete";
  return "partial";
}

export function formatBRLOrEmpty(n: number | null | undefined): string {
  if (n === null || n === undefined) return "Não informado";
  return formatBRL(n);
}