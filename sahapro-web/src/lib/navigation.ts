// src/lib/navigation.ts
import type { Role } from "@/lib/auth";

export type NavItem = {
  labelKey: string;   // ✅ i18n key
  href: string;
  roles: Role[];
};

export const NAV_ITEMS: NavItem[] = [
  // ✅ sadece tech görür
  {
    labelKey: "navItems.jobs",
    href: "/jobs",
    roles: ["tech"],
  },

  // ✅ işi dağıtanlar
  {
    labelKey: "navItems.dispatch",
    href: "/dispatch",
    roles: ["dispatcher", "owner"],
  },

  // ✅ satış
  {
    labelKey: "navItems.leads",
    href: "/leads",
    roles: ["sales", "owner"],
  },

  // ✅ owner: kullanıcı yönetimi
  {
    labelKey: "navItems.ownerUsers",
    href: "/owner/users",
    roles: ["owner"],
  },

  // (ileride)
  // {
  //   labelKey: "navItems.admin",
  //   href: "/admin",
  //   roles: ["owner"],
  // },
];

export function getNavItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((x) => x.roles.includes(role));
}
