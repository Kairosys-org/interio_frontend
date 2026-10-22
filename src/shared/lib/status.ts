/**
 * The single state -> category map consumed by `StateChip` (DESIGN Appendix B).
 *
 * Key convention: `${entity}.${state}`. Column-qualified entities keep their
 * appendix names verbatim (`unit.engineering_status`, `part.status`,
 * `part.remake_status`). Unknown keys fall back to `neutral`; a status must
 * never lose its chip because a new state was added to a domain type.
 */

export type StateCategory = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'muted';

export const STATE_CATEGORIES: Record<string, StateCategory> = {
	// customer / property
	'customer.active': 'neutral',
	'customer.pending_review': 'warning',
	'customer.archived': 'muted',
	'customer.cancelled': 'muted',
	'property.active': 'neutral',
	'property.pending_review': 'warning',
	'property.archived': 'muted',
	'property.cancelled': 'muted',

	// project
	'project.active': 'success',
	'project.on_hold': 'warning',
	'project.completed': 'neutral',
	'project.cancelled': 'muted',

	// survey
	'survey.draft': 'neutral',
	'survey.in_progress': 'info',
	'survey.submitted': 'warning',
	'survey.verified': 'success',
	'survey.rejected': 'danger',
	'survey.cancelled': 'muted',

	// design
	'design.active': 'neutral',
	'design.archived': 'muted',

	// design_version
	'design_version.draft': 'neutral',
	'design_version.issued': 'info',
	'design_version.approved': 'success',
	'design_version.rejected': 'danger',
	'design_version.superseded': 'muted',
	'design_version.archived': 'muted',

	// quote
	'quote.active': 'neutral',
	'quote.archived': 'muted',

	// quote_version
	'quote_version.draft': 'neutral',
	'quote_version.issued': 'info',
	'quote_version.approved': 'success',
	'quote_version.rejected': 'danger',
	'quote_version.expired': 'warning',
	'quote_version.withdrawn': 'muted',
	'quote_version.superseded': 'muted',
	'quote_version.archived': 'muted',

	// sales_order
	'sales_order.open': 'info',
	'sales_order.completed': 'success',
	'sales_order.cancelled': 'muted',

	// job
	'job.created': 'neutral',
	'job.engineering': 'info',
	'job.procuring': 'info',
	'job.released_to_production': 'info',
	'job.in_production': 'info',
	'job.ready_for_install': 'warning',
	'job.installing': 'info',
	'job.completed': 'success',
	'job.closed': 'neutral',
	'job.on_hold': 'warning',
	'job.cancelled': 'muted',

	// unit.engineering_status
	'unit.engineering_status.pending': 'neutral',
	'unit.engineering_status.engineered': 'success',
	'unit.engineering_status.superseded': 'muted',

	// part.status
	'part.status.pending_validation': 'neutral',
	'part.status.held': 'danger',
	'part.status.released': 'info',
	'part.status.cutting': 'info',
	'part.status.cut': 'info',
	'part.status.edge_banding': 'info',
	'part.status.boring': 'info',
	'part.status.assembly': 'info',
	'part.status.quality_control': 'warning',
	'part.status.complete': 'info',
	'part.status.ready_for_installation': 'success',
	'part.status.installed': 'success',
	'part.status.scrapped': 'danger',

	// part.remake_status
	'part.remake_status.none': 'neutral',
	'part.remake_status.requested': 'warning',
	'part.remake_status.approved': 'info',
	'part.remake_status.in_production': 'info',
	'part.remake_status.complete': 'success',
	'part.remake_status.rejected': 'danger',

	// remake_request
	'remake_request.requested': 'warning',
	'remake_request.approved': 'info',
	'remake_request.rejected': 'danger',
	'remake_request.complete': 'success',
	'remake_request.cancelled': 'muted',

	// export_run
	'export_run.preview': 'neutral',
	'export_run.production': 'info',
	'export_run.failed': 'danger',

	// installation
	'installation.ready_to_install': 'info',
	'installation.install_booked': 'info',
	'installation.delivered': 'info',
	'installation.installation': 'info',
	'installation.snagging': 'warning',
	'installation.customer_sign_off': 'warning',
	'installation.complete': 'success',
	'installation.cancelled': 'muted',

	// snag_item
	'snag_item.open': 'danger',
	'snag_item.in_progress': 'info',
	'snag_item.resolved': 'success',
	'snag_item.waived': 'muted',

	// aftercare_request
	'aftercare_request.open': 'warning',
	'aftercare_request.assigned': 'info',
	'aftercare_request.in_progress': 'info',
	'aftercare_request.resolved': 'success',
	'aftercare_request.closed': 'neutral',
	'aftercare_request.cancelled': 'muted',

	// payment
	'payment.pending': 'warning',
	'payment.paid': 'success',
	'payment.cancelled': 'muted',
	'payment.refunded': 'muted',

	// asset.upload_state
	'asset.pending': 'neutral',
	'asset.uploading': 'info',
	'asset.complete': 'success',
	'asset.failed': 'danger',

	// app_user
	'app_user.active': 'success',
	'app_user.suspended': 'warning',
	'app_user.disabled': 'muted',

	// import_batch
	'import_batch.staged': 'info',
	'import_batch.committed': 'success',
	'import_batch.cancelled': 'muted'
};

const STATE_CATEGORY_VALUES: ReadonlySet<string> = new Set<StateCategory>([
	'neutral',
	'info',
	'warning',
	'success',
	'danger',
	'muted'
]);

/** Labels that sentence-casing alone would get wrong. */
const STATE_LABEL_OVERRIDES: Readonly<Record<string, string>> = {
	qc: 'Quality control'
};

/** Sentence-case label for any machine state; never ALL CAPS. */
export function stateLabel(state: string): string {
	const normalised = state
		.trim()
		.replace(/[\s-]+/g, '_')
		.toLowerCase();
	if (normalised.length === 0) return '';

	const override = STATE_LABEL_OVERRIDES[normalised];
	if (override) return override;

	const words = normalised.split('_').filter((word) => word.length > 0);
	return words
		.map((word, index) => (index === 0 ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
		.join(' ');
}

/** Category for a canonical state; unknown entity/state pairs are `neutral`. */
export function stateCategory(entity: string, state: string): StateCategory {
	return STATE_CATEGORIES[`${entity}.${state}`] ?? 'neutral';
}

export function isStateCategory(value: string): value is StateCategory {
	return STATE_CATEGORY_VALUES.has(value);
}
