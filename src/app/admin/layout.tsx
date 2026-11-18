import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop editor",
  robots: { index: false, follow: false },
};

/**
 * The editor sits over the shop's root layout as its own scrolling room:
 * the shop's preloader, cursor and back-to-top skip themselves here, and
 * `data-lenis-prevent` keeps the desktop smooth-scroll out of it.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-admin data-lenis-prevent className="fixed inset-0 z-[60] overflow-y-auto bg-ground text-ink">
      {children}
    </div>
  );
}
