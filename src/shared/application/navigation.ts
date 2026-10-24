import {
	Activity,
	BookOpen,
	Box,
	Building,
	ChartColumn,
	ClipboardCheck,
	ClipboardList,
	CreditCard,
	Download,
	Factory,
	FileText,
	FolderKanban,
	Hammer,
	Layers,
	LayoutDashboard,
	LifeBuoy,
	Lock,
	MapPin,
	Pen,
	RotateCcw,
	Ruler,
	Settings,
	Shield,
	ShoppingCart,
	Truck,
	Upload,
	User,
	Users
} from '@lucide/svelte';
import type { Component } from 'svelte';
import { PERMISSIONS } from '$shared/domain/permissions';
import { hasPermission } from '$shared/domain/permissions';

export interface NavItem {
	label: string;
	href: string;
	icon: Component;
	/** Permission code required to see the item; null = any authenticated user. */
	permission: string | null;
	/**
	 * False until the route exists. Phase 0 ships the shell only, so future
	 * phases flip their item to true without restructuring navigation.
	 */
	available: boolean;
}

export interface NavSection {
	id: string;
	label: string;
	items: NavItem[];
}

function item(
	label: string,
	href: string,
	icon: Component,
	permission: string | null = null,
	available = false
): NavItem {
	return { label, href, icon, permission, available };
}

/**
 * Canonical web sidebar tree — spec Part 11 §3 exactly. Items are filtered by
 * availability and permission; sections with nothing left are hidden.
 */
export const NAV_SECTIONS: readonly NavSection[] = Object.freeze([
	{
		id: 'home',
		label: 'Home',
		items: [
			item('Dashboard', '/dashboard', LayoutDashboard, null, true),
			item('Activity', '/activity', Activity, PERMISSIONS.AUDIT_VIEW)
		]
	},
	{
		id: 'sales',
		label: 'Sales',
		items: [
			item('Customers', '/customers', Users, PERMISSIONS.CUSTOMER_VIEW, true),
			item('Properties', '/properties', Building, PERMISSIONS.PROPERTY_VIEW, true),
			item('Projects', '/projects', FolderKanban, PERMISSIONS.PROJECT_VIEW, true),
			item('Dedup queue', '/dedup-queue', ClipboardList, PERMISSIONS.CUSTOMER_VIEW, true),
			item('Quotes', '/quotes', FileText, PERMISSIONS.QUOTE_VIEW),
			item('Approvals', '/approvals', ClipboardCheck, PERMISSIONS.APPROVAL_VIEW),
			item('Orders', '/orders', ShoppingCart, PERMISSIONS.SALES_ORDER_VIEW)
		]
	},
	{
		id: 'survey',
		label: 'Survey',
		items: [item('Surveys', '/surveys', Ruler, PERMISSIONS.SURVEY_VIEW, true)]
	},
	{
		id: 'design',
		label: 'Design',
		items: [item('Designs', '/designs', Pen, PERMISSIONS.DESIGN_VIEW)]
	},
	{
		id: 'catalogue',
		label: 'Catalogue',
		items: [
			item('Cabinets', '/catalogue/cabinets', Box, PERMISSIONS.CABINET_VIEW, true),
			item('Component rules', '/catalogue/rules', Layers, PERMISSIONS.CABINET_VIEW, true)
		]
	},
	{
		id: 'materials',
		label: 'Materials',
		items: [
			item('Decor', '/materials/decor', Box, PERMISSIONS.MATERIALS_VIEW, true),
			item('Edging', '/materials/edging', Layers, PERMISSIONS.MATERIALS_VIEW, true),
			item('Suppliers', '/materials/suppliers', Truck, PERMISSIONS.MATERIALS_VIEW, true),
			item('Manufacturers', '/materials/manufacturers', Factory, PERMISSIONS.MATERIALS_VIEW, true)
		]
	},
	{
		id: 'production',
		label: 'Production',
		items: [
			item('Jobs', '/jobs', Factory, PERMISSIONS.JOB_VIEW),
			item('Workshop board', '/workshop', Hammer, PERMISSIONS.PART_VIEW),
			item('Remakes', '/remakes', RotateCcw, PERMISSIONS.REMAKE_VIEW),
			item('Export mapping', '/exports/mapping', Download, PERMISSIONS.EXPORT_VIEW)
		]
	},
	{
		id: 'purchasing',
		label: 'Purchasing',
		items: [item('Procurement', '/purchasing', CreditCard, PERMISSIONS.JOB_COST_VIEW)]
	},
	{
		id: 'site',
		label: 'Site',
		items: [
			item('Installations', '/installations', MapPin, PERMISSIONS.INSTALLATION_VIEW),
			item('Snags', '/snags', ClipboardList, PERMISSIONS.SNAG_VIEW)
		]
	},
	{
		id: 'aftercare',
		label: 'Aftercare',
		items: [item('Requests', '/aftercare', LifeBuoy, PERMISSIONS.AFTERCARE_VIEW)]
	},
	{
		id: 'finance',
		label: 'Finance',
		items: [
			item('Payments', '/payments', CreditCard, PERMISSIONS.PAYMENT_VIEW),
			item('Reports', '/reports', ChartColumn, null)
		]
	},
	{
		id: 'admin',
		label: 'Admin',
		items: [
			item('Users', '/admin/users', Users, PERMISSIONS.USER_VIEW),
			item('Roles', '/admin/roles', Shield, PERMISSIONS.ROLE_VIEW),
			item('Permissions', '/admin/permissions', BookOpen, PERMISSIONS.ROLE_VIEW),
			item('Audit log', '/admin/audit', ClipboardList, PERMISSIONS.AUDIT_VIEW),
			item('Settings', '/admin/settings', Settings, PERMISSIONS.SETTING_VIEW),
			item('Deletion requests', '/admin/deletion-requests', Lock, PERMISSIONS.RECORD_DELETE_REQUEST)
		]
	},
	{
		id: 'account',
		label: 'Account',
		items: [
			item('Profile', '/account/profile', User, null),
			item('Security', '/account/security', Lock, null)
		]
	},
	{
		id: 'data',
		label: 'Data',
		items: [
			item('Import batches', '/imports', Upload, PERMISSIONS.IMPORT_VIEW, true),
			item('Export centre', '/exports', Download, null)
		]
	}
]);

/** UX-only filter. The server denies anything the user cannot actually do. */
export function isNavItemVisible(itemToCheck: NavItem, permissions: readonly string[]): boolean {
	if (!itemToCheck.available) return false;
	return itemToCheck.permission === null || hasPermission(permissions, itemToCheck.permission);
}

export function visibleSections(
	sections: readonly NavSection[],
	permissions: readonly string[]
): NavSection[] {
	return sections
		.map((section) => ({
			...section,
			items: section.items.filter((entry) => isNavItemVisible(entry, permissions))
		}))
		.filter((section) => section.items.length > 0);
}
