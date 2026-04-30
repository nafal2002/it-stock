export const KATEGORI = [
  { value: "cctv", label: "CCTV & Security", prefix: "CCTV", color: "#3B82F6" },
  { value: "peripheral", label: "Peripheral", prefix: "PER", color: "#10B981" },
  { value: "storage", label: "Storage / RAM", prefix: "STR", color: "#F59E0B" },
  { value: "networking", label: "Networking", prefix: "NET", color: "#8B5CF6" },
  { value: "printer", label: "Printer / Toner", prefix: "PRT", color: "#EC4899" },
  { value: "sparepart", label: "Sparepart PC/Laptop", prefix: "SPR", color: "#06B6D4" },
  { value: "tools", label: "Tools Teknisi", prefix: "TOL", color: "#F97316" },
  { value: "other", label: "Lain-lain", prefix: "ITM", color: "#6B7280" },
] as const;

export const KONDISI = [
  { value: "baru", label: "Baru" },
  { value: "bekas", label: "Bekas" },
  { value: "rusak", label: "Rusak" },
  { value: "perbaikan", label: "Perbaikan" },
] as const;

export type Kategori = typeof KATEGORI[number]["value"];
export type Kondisi = typeof KONDISI[number]["value"];
