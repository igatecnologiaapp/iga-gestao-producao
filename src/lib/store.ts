import { useSyncExternalStore } from "react";

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

export interface Material {
  id: string;
  name: string;
  unit: Unit;
  purchasePrice: number;
  purchaseQty: number;
}

export interface SheetItem {
  id: string;
  materialId: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  unit: Unit;
  salePrice: number;
  sheet: SheetItem[];
}

interface DB {
  materials: Material[];
  products: Product[];
}

const KEY = "fichatec-db-v1";
const initial: DB = { materials: [], products: [] };

function read(): DB {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    return JSON.parse(raw) as DB;
  } catch {
    return initial;
  }
}

let state: DB = initial;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated() {
  if (!hydrated && typeof window !== "undefined") {
    state = read();
    hydrated = true;
  }
}

function write(next: DB) {
  state = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  ensureHydrated();
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): DB {
  ensureHydrated();
  return state;
}

function getServerSnapshot(): DB {
  return initial;
}

export function useDB() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const db = {
  addMaterial(m: Omit<Material, "id">) {
    write({ ...state, materials: [...state.materials, { ...m, id: uid() }] });
  },
  updateMaterial(id: string, patch: Partial<Material>) {
    write({
      ...state,
      materials: state.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  },
  deleteMaterial(id: string) {
    write({
      ...state,
      materials: state.materials.filter((m) => m.id !== id),
      products: state.products.map((p) => ({
        ...p,
        sheet: p.sheet.filter((s) => s.materialId !== id),
      })),
    });
  },
  addProduct(p: Omit<Product, "id" | "sheet"> & { sheet?: SheetItem[] }) {
    write({
      ...state,
      products: [...state.products, { ...p, sheet: p.sheet ?? [], id: uid() }],
    });
  },
  updateProduct(id: string, patch: Partial<Product>) {
    write({
      ...state,
      products: state.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  },
  deleteProduct(id: string) {
    write({ ...state, products: state.products.filter((p) => p.id !== id) });
  },
  addSheetItem(productId: string, item: Omit<SheetItem, "id">) {
    write({
      ...state,
      products: state.products.map((p) =>
        p.id === productId ? { ...p, sheet: [...p.sheet, { ...item, id: uid() }] } : p,
      ),
    });
  },
  updateSheetItem(productId: string, itemId: string, patch: Partial<SheetItem>) {
    write({
      ...state,
      products: state.products.map((p) =>
        p.id === productId
          ? {
              ...p,
              sheet: p.sheet.map((s) => (s.id === itemId ? { ...s, ...patch } : s)),
            }
          : p,
      ),
    });
  },
  removeSheetItem(productId: string, itemId: string) {
    write({
      ...state,
      products: state.products.map((p) =>
        p.id === productId ? { ...p, sheet: p.sheet.filter((s) => s.id !== itemId) } : p,
      ),
    });
  },
};

export function unitCost(m: Material): number {
  if (!m.purchaseQty || m.purchaseQty <= 0) return 0;
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