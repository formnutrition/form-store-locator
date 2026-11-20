import Script from "next/script";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-[1180px] px-3 py-6 md:px-6">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-form-text">Store Locator</h1>
        <a href="/admin" className="text-sm text-form-muted underline">
          Admin
        </a>
      </div>
      <div id="form-store-locator">Loading store locator…</div>
      <Script src="/embed.js" strategy="afterInteractive" />
    </main>
  );
}
