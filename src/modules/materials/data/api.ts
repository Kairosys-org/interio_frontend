import { apiCall } from '$network/api';
import { requirePermission } from '$network/guard';
import { PERMISSIONS } from '$shared/domain/permissions';
import type { Uuid } from '$shared/domain/uuid';
import type {
	CreateCollectionInput,
	CreateDecorInput,
	CreateManufacturerInput,
	DecorAttributeInput,
	DecorEdgingInput,
	DecorListParams,
	DecorSupplierInput,
	EdgingInput,
	EdgingListParams,
	SupplierInput,
	SupplierListParams,
	UpdateCollectionInput,
	UpdateDecorInput,
	UpdateManufacturerInput,
	UpdateSupplierInput
} from '../domain/types';
import { getMaterialsRepository } from './repository-provider';

const READ = { latencyMs: 180 } as const;
const WRITE = { latencyMs: 300 } as const;

/**
 * The only surface presentation may call (architecture §1, §3).
 *
 * Reads require `materials.view`; creates require `materials.create`; every
 * update, link, attribute write and primary-supplier change requires
 * `materials.update` (phase-3 §2 permissions).
 */
export const materialsApi = {
	listDecors(params: DecorListParams = {}) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_VIEW);
			return getMaterialsRepository().listDecors(params);
		}, READ);
	},

	getDecor(id: Uuid) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_VIEW);
			return getMaterialsRepository().getDecor(id);
		}, READ);
	},

	createDecor(input: CreateDecorInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_CREATE);
			return getMaterialsRepository().createDecor(input);
		}, WRITE);
	},

	updateDecor(id: Uuid, input: UpdateDecorInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_UPDATE);
			return getMaterialsRepository().updateDecor(id, input);
		}, WRITE);
	},

	listEdgings(params: EdgingListParams = {}) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_VIEW);
			return getMaterialsRepository().listEdgings(params);
		}, READ);
	},

	createEdging(input: EdgingInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_CREATE);
			return getMaterialsRepository().createEdging(input);
		}, WRITE);
	},

	updateEdging(id: Uuid, input: Partial<EdgingInput>) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_UPDATE);
			return getMaterialsRepository().updateEdging(id, input);
		}, WRITE);
	},

	linkEdging(decorId: Uuid, input: DecorEdgingInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_UPDATE);
			return getMaterialsRepository().linkEdging(decorId, input);
		}, WRITE);
	},

	unlinkEdging(decorId: Uuid, edgingId: Uuid) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_UPDATE);
			return getMaterialsRepository().unlinkEdging(decorId, edgingId);
		}, WRITE);
	},

	listSuppliers(params: SupplierListParams = {}) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_VIEW);
			return getMaterialsRepository().listSuppliers(params);
		}, READ);
	},

	getSupplier(id: Uuid) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_VIEW);
			return getMaterialsRepository().getSupplier(id);
		}, READ);
	},

	createSupplier(input: SupplierInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_CREATE);
			return getMaterialsRepository().createSupplier(input);
		}, WRITE);
	},

	updateSupplier(id: Uuid, input: UpdateSupplierInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_UPDATE);
			return getMaterialsRepository().updateSupplier(id, input);
		}, WRITE);
	},

	linkSupplier(decorId: Uuid, input: DecorSupplierInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_UPDATE);
			return getMaterialsRepository().linkSupplier(decorId, input);
		}, WRITE);
	},

	unlinkSupplier(decorId: Uuid, supplierId: Uuid) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_UPDATE);
			return getMaterialsRepository().unlinkSupplier(decorId, supplierId);
		}, WRITE);
	},

	upsertAttribute(decorId: Uuid, input: DecorAttributeInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_UPDATE);
			return getMaterialsRepository().upsertAttribute(decorId, input);
		}, WRITE);
	},

	removeAttribute(decorId: Uuid, attrName: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_UPDATE);
			return getMaterialsRepository().removeAttribute(decorId, attrName);
		}, WRITE);
	},

	listManufacturers() {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_VIEW);
			return getMaterialsRepository().listManufacturers();
		}, READ);
	},

	createManufacturer(input: CreateManufacturerInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_CREATE);
			return getMaterialsRepository().createManufacturer(input);
		}, WRITE);
	},

	updateManufacturer(id: Uuid, input: UpdateManufacturerInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_UPDATE);
			return getMaterialsRepository().updateManufacturer(id, input);
		}, WRITE);
	},

	createCollection(input: CreateCollectionInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_CREATE);
			return getMaterialsRepository().createCollection(input);
		}, WRITE);
	},

	updateCollection(id: Uuid, input: UpdateCollectionInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.MATERIALS_UPDATE);
			return getMaterialsRepository().updateCollection(id, input);
		}, WRITE);
	}
};
