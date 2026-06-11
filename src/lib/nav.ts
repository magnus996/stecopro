import type { UserRole } from '@/db/schema'

export type NavItem = { label: string; href: string; roles: UserRole[] }

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashbord',       href: '/dashboard',     roles: ['operator', 'produksjonsleder', 'admin', 'system_admin'] },
  { label: 'Skiftrapporter', href: '/reports/shifts', roles: ['operator', 'produksjonsleder', 'admin', 'system_admin'] },
  { label: 'Lager',          href: '/inventory',      roles: ['operator', 'produksjonsleder', 'admin', 'system_admin'] },
  { label: 'Analyser',       href: '/reports',        roles: ['produksjonsleder', 'admin', 'system_admin'] },
  { label: 'Anleggsoppsett', href: '/admin/plant',    roles: ['produksjonsleder', 'admin', 'system_admin'] },
  { label: 'Brukere',        href: '/admin/users',    roles: ['admin', 'system_admin'] },
  { label: 'Tenants',        href: '/admin/tenants',  roles: ['system_admin'] },
]

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}
