import type { ProductFilters, ProductSort } from "@/lib/catalog";
import { toMinor } from "@/lib/money";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function firstParam(params: RawSearchParams, key: string): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export function allParams(params: RawSearchParams, key: string): string[] {
  const value = params[key];
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

const SORTS: ProductSort[] = ["newest", "price_asc", "price_desc", "bestselling", "popular"];

export function parseSort(value: string | undefined): ProductSort {
  return SORTS.includes(value as ProductSort) ? (value as ProductSort) : "newest";
}

export function parseShopFilters(params: RawSearchParams, perPage = 12): ProductFilters {
  const min = firstParam(params, "min");
  const max = firstParam(params, "max");
  return {
    query: firstParam(params, "q")?.trim() || undefined,
    flowerType: firstParam(params, "type") || undefined,
    color: firstParam(params, "color") || undefined,
    size: firstParam(params, "size") || undefined,
    minPrice: min ? toMinor(Number(min)) : undefined,
    maxPrice: max ? toMinor(Number(max)) : undefined,
    inStock: firstParam(params, "stock") === "1",
    onSale: firstParam(params, "sale") === "1",
    sort: parseSort(firstParam(params, "sort")),
    page: Math.max(1, Number(firstParam(params, "page") ?? 1) || 1),
    perPage,
  };
}

export function buildQuery(params: RawSearchParams, overrides: Record<string, string | number | undefined | null> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item));
    else if (value) search.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null || value === "") search.delete(key);
    else search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
