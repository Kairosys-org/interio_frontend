/**
 * Shared UI barrel (orchestrator-owned, architecture §5).
 *
 * Routes and feature pages import primitives from `$shared/presentation/ui`
 * only. Every entry below is owned by exactly one wave-2 agent; the file list
 * is a contract, so adding a component means adding one line here.
 */

// Primitives A — form, layout and data display.
export { default as Button } from './button/Button.svelte';
export { default as IconButton } from './button/IconButton.svelte';
export { default as TextLink } from './link/TextLink.svelte';
export { default as Input } from './input/Input.svelte';
export { default as Textarea } from './input/Textarea.svelte';
export { default as Select } from './select/Select.svelte';
export { default as Combobox } from './select/Combobox.svelte';
export { default as Checkbox } from './choice/Checkbox.svelte';
export { default as RadioGroup } from './choice/RadioGroup.svelte';
export { default as Switch } from './choice/Switch.svelte';
export { default as Tabs } from './tabs/Tabs.svelte';
export { default as Progress } from './feedback/Progress.svelte';
export { default as Skeleton } from './feedback/Skeleton.svelte';
export { default as Pagination } from './data/Pagination.svelte';
export { default as Breadcrumb } from './navigation/Breadcrumb.svelte';
export { default as Avatar } from './data/Avatar.svelte';
export { default as Accordion } from './disclosure/Accordion.svelte';

// Primitives B — overlays, feedback and access control.
export { default as Dialog } from './overlay/Dialog.svelte';
export { default as Sheet } from './overlay/Sheet.svelte';
export { default as Menu } from './overlay/Menu.svelte';
export { default as Tooltip } from './overlay/Tooltip.svelte';
export { default as Toaster } from './feedback/Toaster.svelte';
export { default as Badge } from './feedback/Badge.svelte';
export { default as EmptyState } from './feedback/EmptyState.svelte';
export { default as StateChip } from './feedback/StateChip.svelte';
export { default as ErrorBoundary } from './feedback/ErrorBoundary.svelte';
export { default as ForbiddenPage } from './feedback/ForbiddenPage.svelte';
export { default as PermissionGate } from './gate/PermissionGate.svelte';

// Records spine — page composition and record-specific display (Phase 1).
export { default as AssignmentPanel } from './records/AssignmentPanel.svelte';
export { default as AuditTrailTab } from './records/AuditTrailTab.svelte';
export { default as ConfirmDialog } from './records/ConfirmDialog.svelte';
export { default as DataTable } from './records/DataTable.svelte';
export { default as DedupReviewModal } from './records/DedupReviewModal.svelte';
export { default as DetailSection } from './records/DetailSection.svelte';
export { default as EntityLink } from './records/EntityLink.svelte';
export { default as FormField } from './records/FormField.svelte';
export { default as GateBanner } from './records/GateBanner.svelte';
export { default as KeyValueGrid } from './records/KeyValueGrid.svelte';
export { default as PageHeader } from './records/PageHeader.svelte';
export { default as SearchInput } from './records/SearchInput.svelte';
export { default as StageIndicator } from './records/StageIndicator.svelte';
export { default as Stepper } from './records/Stepper.svelte';

// Shell — owned by the shell agent.
export { default as AppShell } from './shell/AppShell.svelte';
export { default as TopBar } from './shell/TopBar.svelte';
export { default as SidebarNav } from './shell/SidebarNav.svelte';
