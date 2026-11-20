export default function AdminHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-form-stone bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <a href="/admin" className="text-[28px] leading-none tracking-tight text-form-text">
          form
        </a>
        <div className="flex items-center gap-4 text-sm">
          <a href="/" className="text-form-muted underline">
            View locator
          </a>
          {signedIn ? (
            <form method="post" action="/api/admin/logout">
              <button type="submit" className="text-form-text underline">
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </header>
  );
}
