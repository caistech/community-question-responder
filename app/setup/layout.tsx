// Top-level /setup wizard — sibling to (dashboard).
// Intentionally minimal — no dashboard chrome, no voice FAB. The voice FAB
// requires setup_complete to render anyway, so it would be a no-op here.

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/40">
        <div className="mx-auto max-w-3xl px-6 py-4 text-sm font-semibold">
          CQR <span className="text-gray-500">/ first-run setup</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
