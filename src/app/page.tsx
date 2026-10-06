import Image from "next/image";

export const metadata = {
  title: "Sudirja",
  description:
    "Sistem toko sedang dirawat agar pencatatan stok, katalog, dan pesanan kembali lebih rapi.",
};

/**
 * Homepage: desain "Etalase Hangat" ditampilkan sebagai gambar fullscreen.
 * Backoffice tetap dapat diakses melalui /backoffice-sudirja/login.
 */
export default function Home() {
  return (
    <main className="relative w-screen h-dvh overflow-hidden bg-white">
      <Image
        src="/etalase-hangat.png"
        alt="Sudirja — website maintenance, kami sedang merapikan rak digital"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
    </main>
  );
}
