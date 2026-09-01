"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api-client";
import {
  listAllActiveKategori,
  listAllActiveMerk,
  listAllActiveSatuan,
} from "@/lib/product-api";
import type { KategoriDTO, MerkDTO, SatuanDTO } from "@/lib/product-types";

/**
 * Loads active reference rows once for dropdowns (Produk form, Stok, dll).
 * Stable identity between renders: loading once with an empty dependency
 * list, then exposes `reload` for after-CRUD refreshes.
 */
export function useReferenceLists() {
  const [satuanList, setSatuanList] = useState<SatuanDTO[]>([]);
  const [merkList, setMerkList] = useState<MerkDTO[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Independent requests in parallel — never chained.
      const [satuan, merk, kategori] = await Promise.all([
        listAllActiveSatuan(),
        listAllActiveMerk(),
        listAllActiveKategori(),
      ]);
      setSatuanList(satuan.items);
      setMerkList(merk.items);
      setKategoriList(kategori.items);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Gagal memuat data referensi.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { satuanList, merkList, kategoriList, loading, error, reload: load };
}
