import AdminHeader from "@/components/AdminHeader";

const errors: Record<string, string> = {
  password: "That password isn't right.",
  rate: "Too many tries. Wait a few minutes and try again.",
  setup: "Admin sign-in isn't set up yet. Add ADMIN_PASSWORD and AUTH_SECRET on the server.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const message = params.error ? errors[params.error] : "";
  const next = params.next?.startsWith("/admin") ? params.next : "/admin";

  return (
    <>
      <AdminHeader signedIn={false} />
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-semibold">Store locator admin</h1>
        <p className="mt-2 text-form-muted">Sign in to add or edit stockists.</p>
        <form method="post" action="/api/admin/login" className="mt-8 space-y-4 bg-white p-6 shadow-sm">
          <input type="hidden" name="next" value={next} />
          <label className="block text-sm" htmlFor="password">
            Password
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="mt-1 w-full border border-form-stone px-3 py-2"
            />
          </label>
          {message ? <p className="text-sm text-red-800">{message}</p> : null}
          <button type="submit" className="w-full bg-form-gold px-4 py-3 font-semibold text-form-text">
            Sign in
          </button>
        </form>
      </main>
    </>
  );
}
