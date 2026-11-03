"use client";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";

/** Narrows the hub list to one category. */
export function CategoryFilter({ value }: { value: string }) {
  const router = useRouter();
  return (
    <select
      aria-label="Category"
      value={value}
      onChange={e => router.push(e.target.value ? `/hubs?tab=all&cat=${e.target.value}` : "/hubs?tab=all")}
      style={{ height: 38, padding: "0 38px 0 12px", border: "1px solid var(--outline)", borderRadius: 4, background: "var(--surface)", maxWidth: 220 }}
    >
      <option value="">All categories</option>
      {CATEGORIES.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
    </select>
  );
}
