<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { ApiErrorCode } from '$network/errors';
	import type { DedupCandidateRef } from '$shared/domain/dedup';
	import type { ProjectType } from '$shared/domain/record-states';
	import { Breadcrumb, Button, PageHeader, Stepper } from '$shared/presentation/ui';
	import { projectsApi } from '../../data/api';
	import type { AssignableSurveyor, Project, ProjectDedupConflict } from '../../domain/types';
	import { fieldErrorsFrom, newProjectWizardSchema } from '../../domain/validations';
	import ProjectDedupReview from '../components/ProjectDedupReview.svelte';
	import ProjectWizardCustomerStep from '../components/ProjectWizardCustomerStep.svelte';
	import ProjectWizardDetailsStep from '../components/ProjectWizardDetailsStep.svelte';
	import ProjectWizardPropertyStep from '../components/ProjectWizardPropertyStep.svelte';
	import ProjectWizardReviewStep from '../components/ProjectWizardReviewStep.svelte';
	import ProjectWizardSurveyorsStep from '../components/ProjectWizardSurveyorsStep.svelte';
	import {
		PROJECT_WIZARD_STEPS,
		REVIEW_STEP,
		type CustomerChoice,
		type PropertyChoice
	} from '../wizard-types';

	const steps = PROJECT_WIZARD_STEPS.map((step) => ({ ...step }));

	const captionSchema = newProjectWizardSchema.shape.caption;
	const typeSchema = newProjectWizardSchema.shape.projectType;
	const surveyorsSchema = newProjectWizardSchema.shape.surveyorIds;

	let step = $state(0);
	let maxStep = $state(0);

	let selectedCustomer = $state<CustomerChoice | null>(null);
	let selectedProperty = $state<PropertyChoice | null>(null);
	let caption = $state('');
	let projectType = $state<ProjectType>('kitchen');
	let selectedSurveyorIds = $state<string[]>([]);

	let errors = $state<Record<string, string>>({});
	let submitting = $state(false);
	let submitError = $state<string | null>(null);

	let surveyorPool = $state<AssignableSurveyor[]>([]);
	let surveyorsLoading = $state(true);
	let surveyorsError = $state<string | null>(null);
	let surveyorsBlocked = $state<string | null>(null);
	let surveyorRequestSequence = 0;

	let dedupOpen = $state(false);
	let dedupHeldId = $state<string | null>(null);
	let dedupCandidates = $state<DedupCandidateRef[]>([]);

	const currentStep = $derived(steps[step]);
	const projectsHref = resolve('/projects');
	const selectedSurveyorNames = $derived(
		selectedSurveyorIds.map(
			(id) => surveyorPool.find((surveyor) => surveyor.id === id)?.displayName ?? 'Unknown surveyor'
		)
	);
	const surveyorsUnavailable = $derived(
		surveyorsBlocked !== null || (!surveyorsLoading && surveyorPool.length === 0)
	);

	$effect(() => {
		void loadSurveyorPool();
	});

	/**
	 * The only endpoint that lists Surveyor-role users is keyed by a project.
	 * Ask the first listed project once; the mock returns the tenant-wide active
	 * pool. A tenant with no project therefore cannot open this wizard — the
	 * reported backend gap, surfaced as a blocking message rather than a guess.
	 */
	async function loadSurveyorPool(): Promise<void> {
		const sequence = ++surveyorRequestSequence;
		surveyorsLoading = true;
		surveyorsError = null;
		surveyorsBlocked = null;

		try {
			const firstPage = await projectsApi.list({ page: 1, pageSize: 1 });
			const firstProject = firstPage.items[0];
			if (!firstProject) {
				if (sequence !== surveyorRequestSequence) return;
				surveyorPool = [];
				surveyorsBlocked =
					'Surveyors cannot be loaded until this workspace has at least one project.';
				return;
			}

			const pool = await projectsApi.assignableSurveyors(firstProject.id);
			if (sequence !== surveyorRequestSequence) return;

			// `assigned` is relative to the probe project, not this new one.
			surveyorPool = pool;
			selectedSurveyorIds = selectedSurveyorIds.filter((id) =>
				pool.some((surveyor) => surveyor.id === id)
			);
		} catch (caught) {
			if (sequence !== surveyorRequestSequence) return;
			surveyorPool = [];
			surveyorsError = isApiError(caught)
				? caught.message
				: 'We could not load surveyors. Try again.';
		} finally {
			if (sequence === surveyorRequestSequence) surveyorsLoading = false;
		}
	}

	function clearErrors(...keys: string[]): void {
		const next = { ...errors };
		for (const key of keys) delete next[key];
		errors = next;
	}

	function validateStep(index: number): boolean {
		if (index === 0) {
			if (!selectedCustomer) {
				errors = { customerId: 'Choose a customer.' };
				return false;
			}
			errors = {};
			return true;
		}

		if (index === 1) {
			if (!selectedProperty) {
				errors = { propertyId: 'Choose a property.' };
				return false;
			}
			errors = {};
			return true;
		}

		if (index === 2) {
			const next: Record<string, string> = {};
			const parsedCaption = captionSchema.safeParse(caption);
			if (!parsedCaption.success) {
				next.caption = parsedCaption.error.issues[0]?.message ?? 'Enter a project caption.';
			}
			const parsedType = typeSchema.safeParse(projectType);
			if (!parsedType.success) {
				next.projectType = parsedType.error.issues[0]?.message ?? 'Choose a project type.';
			}
			errors = next;
			return Object.keys(next).length === 0;
		}

		if (index === 3) {
			const parsed = surveyorsSchema.safeParse(selectedSurveyorIds);
			if (!parsed.success) {
				errors = {
					surveyorIds: parsed.error.issues[0]?.message ?? 'Assign at least one surveyor.'
				};
				return false;
			}
			errors = {};
			return true;
		}

		return validateAll();
	}

	function validateAll(): boolean {
		const parsed = newProjectWizardSchema.safeParse({
			customerId: selectedCustomer?.id ?? '',
			propertyId: selectedProperty?.id ?? '',
			caption,
			projectType,
			surveyorIds: selectedSurveyorIds
		});
		if (parsed.success) {
			errors = {};
			return true;
		}
		errors = fieldErrorsFrom(parsed.error);
		return false;
	}

	function firstInvalidStep(): number {
		if (errors.customerId) return 0;
		if (errors.propertyId) return 1;
		if (errors.caption || errors.projectType) return 2;
		if (errors.surveyorIds) return 3;
		return REVIEW_STEP;
	}

	function handleContinue(): void {
		submitError = null;
		if (!validateStep(step)) return;
		if (step < REVIEW_STEP) {
			step += 1;
			maxStep = Math.max(maxStep, step);
		} else {
			void submit();
		}
	}

	function handleBack(): void {
		submitError = null;
		if (step === 0) {
			void goto(projectsHref);
			return;
		}
		step -= 1;
	}

	function handleJump(index: number): void {
		if (index > maxStep) return;
		errors = {};
		step = index;
	}

	function handleCustomer(choice: CustomerChoice | null): void {
		const changed = choice?.id !== selectedCustomer?.id;
		selectedCustomer = choice;
		clearErrors('customerId');
		if (changed) {
			selectedProperty = null;
			clearErrors('propertyId');
		}
	}

	function handleProperty(choice: PropertyChoice | null): void {
		selectedProperty = choice;
		clearErrors('propertyId');
	}

	function handleCaption(value: string): void {
		caption = value;
		clearErrors('caption');
	}

	function handleType(value: ProjectType): void {
		projectType = value;
		clearErrors('projectType');
	}

	function handleSurveyorToggle(id: string, checked: boolean): void {
		selectedSurveyorIds = checked
			? [...new Set([...selectedSurveyorIds, id])]
			: selectedSurveyorIds.filter((value) => value !== id);
		clearErrors('surveyorIds');
	}

	function isProjectDedupConflict(value: unknown): value is ProjectDedupConflict {
		if (typeof value !== 'object' || value === null) return false;
		const details = value as Partial<ProjectDedupConflict>;
		return (
			details.entityType === 'project' &&
			typeof details.heldId === 'string' &&
			Array.isArray(details.candidates)
		);
	}

	async function submit(): Promise<void> {
		submitError = null;
		if (!validateAll()) {
			step = firstInvalidStep();
			return;
		}

		submitting = true;
		try {
			const project = await projectsApi.create({
				customerId: selectedCustomer?.id ?? '',
				propertyId: selectedProperty?.id ?? '',
				caption,
				projectType,
				surveyorIds: selectedSurveyorIds
			});
			toast.success(`Project ${project.reference} created.`);
			await goto(resolve(`/projects/${project.id}`));
		} catch (caught) {
			if (
				isApiError(caught) &&
				caught.code === ApiErrorCode.CONFLICT &&
				isProjectDedupConflict(caught.details)
			) {
				dedupHeldId = caught.details.heldId;
				dedupCandidates = caught.details.candidates;
				dedupOpen = true;
			} else {
				submitError = isApiError(caught)
					? caught.message
					: 'We could not create this project. Try again.';
			}
		} finally {
			submitting = false;
		}
	}

	function handleReviewed(project: Project): void {
		dedupOpen = false;
		const destination = project.dedupOfId ?? project.id;
		void goto(resolve(`/projects/${destination}`));
	}
</script>

<svelte:head>
	<title>New project · Interio</title>
</svelte:head>

<Breadcrumb
	items={[{ label: 'Projects', href: projectsHref }, { label: 'New project' }]}
	class="pb-4"
/>

<PageHeader
	title="New project"
	description="Choose the customer and property, name the project, then assign at least one surveyor."
/>

<div class="mt-8 flex max-w-content-form flex-col gap-6">
	<Stepper {steps} current={step} onstep={handleJump} />

	<section aria-labelledby="wizard-step-heading" class="flex flex-col gap-4">
		<div class="flex flex-col gap-1">
			<p class="text-footnote text-ink-secondary">
				Step {step + 1} of {steps.length}
			</p>
			<h2 id="wizard-step-heading" class="text-title-2 text-ink">{currentStep.label}</h2>
			<p class="text-callout text-ink-secondary">{currentStep.description}</p>
		</div>

		{#if step === 0}
			<ProjectWizardCustomerStep
				selected={selectedCustomer}
				onselect={handleCustomer}
				error={errors.customerId}
			/>
		{:else if step === 1}
			<ProjectWizardPropertyStep
				customer={selectedCustomer}
				selected={selectedProperty}
				onselect={handleProperty}
				error={errors.propertyId}
			/>
		{:else if step === 2}
			<ProjectWizardDetailsStep
				{caption}
				{projectType}
				captionError={errors.caption}
				typeError={errors.projectType}
				oncaption={handleCaption}
				ontype={handleType}
			/>
		{:else if step === 3}
			<ProjectWizardSurveyorsStep
				surveyors={surveyorPool}
				selectedIds={selectedSurveyorIds}
				loading={surveyorsLoading}
				error={surveyorsError}
				blockedReason={surveyorsBlocked}
				ontoggle={handleSurveyorToggle}
				onretry={() => void loadSurveyorPool()}
				selectionError={errors.surveyorIds}
			/>
		{:else}
			<ProjectWizardReviewStep
				customer={selectedCustomer}
				property={selectedProperty}
				{caption}
				{projectType}
				surveyors={selectedSurveyorNames}
				onjump={handleJump}
			/>
		{/if}
	</section>

	{#if submitError}
		<p
			role="alert"
			class="rounded-md border border-critical bg-critical-soft p-4 text-callout text-critical-ink"
		>
			{submitError}
		</p>
	{/if}

	<div
		class="form-actions flex flex-col-reverse gap-3 border-t border-hairline bg-canvas pt-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<Button variant="secondary" onclick={handleBack}>
			{step === 0 ? 'Cancel' : 'Back'}
		</Button>

		<div class="flex flex-col gap-2 sm:items-end">
			<Button
				variant="primary"
				loading={submitting}
				loadingLabel="Creating…"
				disabled={step === 3 && surveyorsUnavailable}
				onclick={handleContinue}
			>
				{step === REVIEW_STEP ? 'Create project' : 'Continue'}
			</Button>
			{#if step === 3 && surveyorsUnavailable}
				<p class="text-footnote text-ink-tertiary">
					Assign a surveyor once the workspace has one available.
				</p>
			{/if}
		</div>
	</div>
</div>

<ProjectDedupReview
	bind:open={dedupOpen}
	heldId={dedupHeldId}
	candidates={dedupCandidates}
	onReviewed={handleReviewed}
/>

<style>
	/* Mobile: the action bar stays above the safe area (DESIGN §10.2). */
	.form-actions {
		position: sticky;
		bottom: 0;
		padding-block-end: env(safe-area-inset-bottom);
	}

	@media (width >= 40rem) {
		.form-actions {
			position: static;
		}
	}
</style>
