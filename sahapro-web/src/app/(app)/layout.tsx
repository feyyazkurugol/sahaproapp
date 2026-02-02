import RequireAuth from "@/components/RequireAuth";
import AppMenu from "@/components/AppMenu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen">
        <aside className="w-56 border-r p-4">
          <AppMenu />
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </RequireAuth>
  );
}
