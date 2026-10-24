import type { Uuid } from '$shared/domain/uuid';
import type {
	CreateCollectionInput,
	CreateDecorInput,
	CreateManufacturerInput,
	Decor,
	DecorAttribute,
	DecorAttributeInput,
	DecorCreateResult,
	DecorDetail,
	DecorEdgingInput,
	DecorEdgingLink,
	DecorListParams,
	DecorPage,
	DecorSupplierInput,
	DecorSupplierLink,
	Edging,
	EdgingInput,
	EdgingListParams,
	EdgingPage,
	Manufacturer,
	ManufacturerNode,
	MaterialCollection,
	Supplier,
	SupplierCreateResult,
	SupplierDetail,
	SupplierInput,
	SupplierListParams,
	SupplierPage,
	UpdateCollectionInput,
	UpdateDecorInput,
	UpdateManufacturerInput,
	UpdateSupplierInput
} from '../domain/types';

/**
 * Materials repository contract (architecture §4.3).
 *
 * Mutations are audited by the adapter. `linkEdging` / `linkSupplier` /
 * `upsertAttribute` are join-row writes, not record deletes, so removing a
 * link is allowed; decor/supplier/edging records themselves are only
 * deactivated.
 */
export interface MaterialsRepository {
	listDecors(params: DecorListParams): Promise<DecorPage>;
	getDecor(id: Uuid): Promise<DecorDetail>;
	createDecor(input: CreateDecorInput): Promise<DecorCreateResult>;
	updateDecor(id: Uuid, input: UpdateDecorInput): Promise<Decor>;

	listEdgings(params: EdgingListParams): Promise<EdgingPage>;
	createEdging(input: EdgingInput): Promise<Edging>;
	updateEdging(id: Uuid, input: Partial<EdgingInput>): Promise<Edging>;

	linkEdging(decorId: Uuid, input: DecorEdgingInput): Promise<DecorEdgingLink>;
	unlinkEdging(decorId: Uuid, edgingId: Uuid): Promise<void>;

	listSuppliers(params: SupplierListParams): Promise<SupplierPage>;
	getSupplier(id: Uuid): Promise<SupplierDetail>;
	createSupplier(input: SupplierInput): Promise<SupplierCreateResult>;
	updateSupplier(id: Uuid, input: UpdateSupplierInput): Promise<Supplier>;

	linkSupplier(decorId: Uuid, input: DecorSupplierInput): Promise<DecorSupplierLink>;
	unlinkSupplier(decorId: Uuid, supplierId: Uuid): Promise<void>;

	upsertAttribute(decorId: Uuid, input: DecorAttributeInput): Promise<DecorAttribute>;
	removeAttribute(decorId: Uuid, attrName: string): Promise<void>;

	listManufacturers(): Promise<ManufacturerNode[]>;
	createManufacturer(input: CreateManufacturerInput): Promise<Manufacturer>;
	updateManufacturer(id: Uuid, input: UpdateManufacturerInput): Promise<Manufacturer>;
	createCollection(input: CreateCollectionInput): Promise<MaterialCollection>;
	updateCollection(id: Uuid, input: UpdateCollectionInput): Promise<MaterialCollection>;
}
