import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <Image src="/brand/yasmar-seal.png" alt="" width={80} height={80} />
      <h1 className="font-heading text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-ink-500">This page doesn’t exist in the YasMar Pharmacy demo.</p>
      <Link href="/" className="inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-white">
        Back to the app
      </Link>
    </main>
  );
}
