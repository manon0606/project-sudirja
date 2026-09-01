import "server-only";
import { execute, query, withTransaction } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import type { CreatePromoInput, PromoDTO, PromoListResponse, PromoType, PromoValidationResult, UpdatePromoInput } from "@/lib/promo-types";

interface PromoRow extends RowDataPacket { id:number; kode:string; nama:string; tipe:PromoType; deskripsi:string|null; nilai_diskon:string|number; minimal_belanja:string|number; maksimal_diskon:string|number|null; tanggal_mulai:Date|string; tanggal_berakhir:Date|string; batas_kuota:number; jumlah_digunakan:number; syarat_ketentuan:unknown; is_active:number; created_at:Date|string; }
const TYPES: PromoType[] = ["Diskon Ongkir", "Diskon Nominal", "Diskon %"];
const iso = (value: Date|string) => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const parseTerms = (value: unknown): string[] => { if (value == null) return []; let parsed: unknown = value; if (typeof value === "string") { try { parsed = JSON.parse(value); } catch { return []; } } return Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string") ? parsed : []; };
function toDTO(row: PromoRow): PromoDTO { return { id:row.id, kode:row.kode, nama:row.nama, tipe:row.tipe, deskripsi:row.deskripsi ?? "", nilaiDiskon:Number(row.nilai_diskon), minimalBelanja:Number(row.minimal_belanja), maksimalDiskon:row.maksimal_diskon === null ? null : Number(row.maksimal_diskon), tanggalMulai:iso(row.tanggal_mulai), tanggalBerakhir:iso(row.tanggal_berakhir), batasKuota:row.batas_kuota, jumlahDigunakan:row.jumlah_digunakan, syaratKetentuan:parseTerms(row.syarat_ketentuan), isActive:row.is_active === 1, createdAt:iso(row.created_at) }; }
export function validate(body: unknown, partial = false): { ok:true; data:CreatePromoInput } | { ok:false; details:Record<string,string> } { const input = (body ?? {}) as Record<string,unknown>; const details:Record<string,string> = {}; const text = (key:string) => typeof input[key] === "string" ? (input[key] as string).trim() : ""; if (!partial || input.kode !== undefined) { const value=text("kode"); if (!/^[A-Za-z0-9_-]{2,50}$/.test(value)) details.kode="Kode 2-50 karakter (huruf, angka, _ atau -)."; } if (!partial || input.nama !== undefined) { const value=text("nama"); if (!value || value.length > 200) details.nama="Nama wajib diisi (maksimal 200 karakter)."; } if (!partial || input.tipe !== undefined) { if (!TYPES.includes(input.tipe as PromoType)) details.tipe="Tipe promo tidak valid."; } for (const key of ["nilaiDiskon","minimalBelanja","batasKuota"]) { if (!partial || input[key] !== undefined) { if (key === "minimalBelanja" && input[key] === undefined) continue; const number=Number(input[key]); const invalid=!Number.isFinite(number) || (key !== "minimalBelanja" && number <= 0) || (key === "minimalBelanja" && number < 0) || (key === "batasKuota" && (!Number.isInteger(number) || number < 1)); if (invalid) details[key]="Nilai tidak valid."; } } for (const key of ["tanggalMulai","tanggalBerakhir"]) { if (!partial || input[key] !== undefined) { if (typeof input[key] !== "string" || Number.isNaN(Date.parse(input[key] as string))) details[key]="Tanggal tidak valid."; } } if (input.maksimalDiskon !== undefined && input.maksimalDiskon !== null && (!Number.isFinite(Number(input.maksimalDiskon)) || Number(input.maksimalDiskon) < 0)) details.maksimalDiskon="Maksimal diskon tidak valid."; if (input.syaratKetentuan !== undefined && (!Array.isArray(input.syaratKetentuan) || !(input.syaratKetentuan as unknown[]).every((item) => typeof item === "string"))) details.syaratKetentuan="Syarat harus berupa array teks."; if (input.isActive !== undefined && typeof input.isActive !== "boolean") details.isActive="Status harus boolean."; if (Object.keys(details).length) return { ok:false, details }; return { ok:true, data:input as unknown as CreatePromoInput }; }
const SELECT = "SELECT id,kode,nama,tipe,deskripsi,nilai_diskon,minimal_belanja,maksimal_diskon,tanggal_mulai,tanggal_berakhir,batas_kuota,jumlah_digunakan,syarat_ketentuan,is_active,created_at FROM promo";
export function parseListParams(q:URLSearchParams) { return { page:Math.max(1,Number(q.get("page"))||1), pageSize:Math.min(100,Math.max(1,Number(q.get("pageSize"))||10)), search:(q.get("search")??"").trim().slice(0,100), tipe:q.get("tipe")??"", sortBy:q.get("sortBy")??"created_at", sortOrder:q.get("sortOrder")==="asc" ? "ASC" as const : "DESC" as const }; }
export async function listPromos(params:ReturnType<typeof parseListParams>):Promise<PromoListResponse> { const where:string[]=[]; const args:unknown[]=[]; if(params.search){where.push("(kode LIKE ? OR nama LIKE ? OR id = ?)");args.push(`%${params.search}%`,`%${params.search}%`,Number(params.search)||0);} if(TYPES.includes(params.tipe as PromoType)){where.push("tipe = ?");args.push(params.tipe);} const whereSql=where.length?` WHERE ${where.join(" AND ")}`:""; const count=await query<RowDataPacket[]>(`SELECT COUNT(*) total FROM promo${whereSql}`,args); const total=Number(count.rows[0]?.total??0); const sort=["id","kode","nama","tipe","created_at"].includes(params.sortBy)?params.sortBy:"created_at"; const rows=await query<PromoRow[]>(`${SELECT}${whereSql} ORDER BY ${sort} ${params.sortOrder}, id ${params.sortOrder} LIMIT ? OFFSET ?`,[...args,params.pageSize,(params.page-1)*params.pageSize]); return {items:rows.rows.map(toDTO),pagination:{page:params.page,pageSize:params.pageSize,total,totalPages:Math.max(1,Math.ceil(total/params.pageSize))}}; }
export async function getPromo(id:number) { const result=await query<PromoRow[]>(`${SELECT} WHERE id=? LIMIT 1`,[id]); return result.rows[0] ? toDTO(result.rows[0]) : null; }
const values = (input:CreatePromoInput) => [input.kode,input.nama,input.tipe,input.deskripsi??"",input.nilaiDiskon,input.minimalBelanja??0,input.maksimalDiskon??null,new Date(input.tanggalMulai),new Date(input.tanggalBerakhir),input.batasKuota,JSON.stringify(input.syaratKetentuan??[]),input.isActive === false ? 0 : 1];
export async function createPromo(input:CreatePromoInput) { const result=await execute("INSERT INTO promo (kode,nama,tipe,deskripsi,nilai_diskon,minimal_belanja,maksimal_diskon,tanggal_mulai,tanggal_berakhir,batas_kuota,syarat_ketentuan,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",values(input)); return getPromo(result.insertId); }
export async function updatePromo(id:number,input:UpdatePromoInput) { const current=await getPromo(id); if(!current)return null; const merged={...current,...input} as CreatePromoInput; await execute("UPDATE promo SET kode=?,nama=?,tipe=?,deskripsi=?,nilai_diskon=?,minimal_belanja=?,maksimal_diskon=?,tanggal_mulai=?,tanggal_berakhir=?,batas_kuota=?,syarat_ketentuan=?,is_active=? WHERE id=?",[...values(merged),id]); return getPromo(id); }
export async function deletePromo(id:number) { return (await execute("DELETE FROM promo WHERE id=?", [id])).affectedRows > 0; }

export async function bulkCreatePromos(rows:CreatePromoInput[]) { return withTransaction(async (connection) => { let success=0; const failures:Array<{row:number;kode:string;message:string}>=[]; for(let index=0;index<rows.length;index++){const parsed=validate(rows[index]); const raw=rows[index] as unknown as Record<string,unknown>; if(!parsed.ok){failures.push({row:index+1,kode:String(raw.kode??""),message:Object.values(parsed.details)[0]});continue;} try { await connection.execute("INSERT INTO promo (kode,nama,tipe,deskripsi,nilai_diskon,minimal_belanja,maksimal_diskon,tanggal_mulai,tanggal_berakhir,batas_kuota,syarat_ketentuan,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",values(parsed.data)); success++; } catch(error) { const code=typeof error === "object" && error !== null && "code" in error ? String((error as {code:unknown}).code) : ""; failures.push({row:index+1,kode:parsed.data.kode,message:code === "ER_DUP_ENTRY" ? "Kode promo sudah digunakan." : "Gagal menyimpan promo."}); } } return {success,failures}; }); }

// ---------------------------------------------------------------------------
// Validasi & pemakaian voucher promo di transaksi pesanan
// ---------------------------------------------------------------------------

/**
 * Validasi kode promo aktif terhadap subtotal belanja. Dipakai oleh:
 *  1. route GET /promo/validate (form buat pesanan, preview diskon)
 *  2. createPesananTx (memastikan voucher valid saat transaksi dibuat)
 *
 * Aturan:
 *  - kode harus ada, is_active = 1
 *  - periode berlaku (tanggal_mulai <= now <= tanggal_berakhir)
 *  - kuota belum habis (jumlah_digunakan < batas_kuota)
 *  - subtotal >= minimal_belanja
 *  - perhitungan diskon:
 *      Diskon %        → floor(subtotal * nilai/100), dibatasi maksimal_diskon
 *      Diskon Nominal  → nilai (flat), dibatasi maksimal_diskon (opsional)
 *      Diskon Ongkir   → nilai (flat) — dianggap potongan ongkir pada total
 */
export async function validatePromoVoucher(
  kode: string,
  subtotal: number,
): Promise<PromoValidationResult> {
  const code = kode.trim().toUpperCase();
  if (!code) return { valid: false, message: "Kode voucher kosong." };

  const result = await query<PromoRow[]>(
    `${SELECT} WHERE kode = ? LIMIT 1`,
    [code],
  );
  const row = result.rows[0];
  if (!row) return { valid: false, message: "Kode voucher tidak ditemukan." };
  if (row.is_active !== 1) return { valid: false, message: "Voucher sedang nonaktif." };

  const now = new Date();
  const mulai = new Date(row.tanggal_mulai);
  const berakhir = new Date(row.tanggal_berakhir);
  if (now < mulai) return { valid: false, message: "Voucher belum berlaku." };
  if (now > berakhir) return { valid: false, message: "Voucher sudah kedaluwarsa." };

  const batasKuota = Number(row.batas_kuota);
  const jumlahDigunakan = Number(row.jumlah_digunakan);
  if (batasKuota > 0 && jumlahDigunakan >= batasKuota) {
    return { valid: false, message: "Kuota voucher sudah habis." };
  }

  const minimal = Number(row.minimal_belanja);
  if (subtotal < minimal) {
    return {
      valid: false,
      message: `Minimal belanja Rp ${minimal.toLocaleString('id-ID')} untuk memakai voucher ini.`,
    };
  }

  const promo: PromoValidationResult["promo"] = {
    id: row.id,
    kode: row.kode,
    nama: row.nama,
    tipe: row.tipe,
    nilaiDiskon: Number(row.nilai_diskon),
    minimalBelanja: minimal,
    maksimalDiskon: row.maksimal_diskon === null ? null : Number(row.maksimal_diskon),
    jumlahDigunakan,
    batasKuota,
    diskonAmount: 0,
  };
  promo.diskonAmount = computePromoDiskon(promo.tipe, promo.nilaiDiskon, promo.maksimalDiskon, subtotal);

  return { valid: true, message: "Voucher berlaku.", promo };
}

/** Hitung nominal diskon berdasarkan tipe promo & subtotal. */
export function computePromoDiskon(
  tipe: PromoType,
  nilaiDiskon: number,
  maksimalDiskon: number | null,
  subtotal: number,
): number {
  if (tipe === "Diskon %") {
    const amount = Math.floor((subtotal * nilaiDiskon) / 100);
    return maksimalDiskon != null ? Math.min(amount, maksimalDiskon) : amount;
  }
  // Diskon Nominal & Diskon Ongkir → potongan flat
  return maksimalDiskon != null ? Math.min(nilaiDiskon, maksimalDiskon) : nilaiDiskon;
}

/** Tandai voucher terpakai (jumlah_digunakan + 1). */
export async function incrementPromoUsage(promoId: number): Promise<void> {
  await execute(
    "UPDATE promo SET jumlah_digunakan = jumlah_digunakan + 1 WHERE id = ?",
    [promoId],
  );
}
