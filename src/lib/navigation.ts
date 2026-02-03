// src/lib/navigation.ts
import type { Role } from "@/lib/auth";

export type NavItem = {
  label: string;
  href: string;
  roles: Role[];
};

export const NAV_ITEMS: NavItem[] = [
  // ✅ sadece tech görür
  { label: "İşlerim", href: "/jobs", roles: ["tech"] },

  // ✅ işi dağıtanlar görür
  { label: "Dispatch", href: "/dispatch", roles: ["dispatcher", "owner"] },

  { label: "Leads", href: "/leads", roles: ["sales", "owner"] },
  { label: "Admin", href: "/admin", roles: ["owner"] },
];

export function getNavItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((x) => x.roles.includes(role));
}
