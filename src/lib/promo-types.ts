export type PromoType = "Diskon Ongkir" | "Diskon Nominal" | "Diskon %";
export type PromoStatus = "active" | "inactive";
export interface PromoDTO { id:number; kode:string; nama:string; tipe:PromoType; deskripsi:string; nilaiDiskon:number; minimalBelanja:number; maksimalDiskon:number|null; tanggalMulai:string; tanggalBerakhir:string; batasKuota:number; jumlahDigunakan:number; syaratKetentuan:string[]; isActive:boolean; createdAt:string; }
export interface CreatePromoInput { kode:string; nama:string; tipe:PromoType; deskripsi?:string; nilaiDiskon:number; minimalBelanja?:number; maksimalDiskon?:number|null; tanggalMulai:string; tanggalBerakhir:string; batasKuota:number; syaratKetentuan?:string[]; isActive?:boolean; }
export type UpdatePromoInput = Partial<CreatePromoInput>;
export interface PromoListResponse { items:PromoDTO[]; pagination:{page:number;pageSize:number;total:number;totalPages:number}; }
export type PromoErrorCode = "VALIDATION_ERROR"|"NOT_FOUND"|"DUPLICATE_CODE"|"UNAUTHORIZED"|"INTERNAL_ERROR";
export interface BulkPromoResult { success:number; failures:Array<{row:number;kode:string;message:string}>; }

// ---------------------------------------------------------------------------
// Validasi voucher (dipakai form pesanan & transaksi)
// ---------------------------------------------------------------------------

/** Hasil validasi kode promo aktif untuk dipakai di transaksi pesanan. */
export interface PromoValidationResult {
  valid: boolean;
  message: string;
  promo?: {
    id: number;
    kode: string;
    nama: string;
    tipe: PromoType;
    nilaiDiskon: number;
    minimalBelanja: number;
    maksimalDiskon: number | null;
    jumlahDigunakan: number;
    batasKuota: number;
    diskonAmount: number;   // dihitung terhadap subtotal yang dikirim
  };
}
