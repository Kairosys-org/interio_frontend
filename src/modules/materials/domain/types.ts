import type { Page } from '$shared/domain/pagination';
import type {
	DecorColourFamily,
	DecorCore,
	DecorMaterialType,
	EdgingMatchType,
	GrainDirection,
	MaterialStatus,
	PremiumTier
} from '$shared/domain/record-states';
import type { Uuid } from '$shared/domain/uuid';

export type {
	DecorColourFamily,
	DecorCore,
	DecorMaterialType,
	EdgingMatchType,
	GrainDirection,
	MaterialStatus,
	PremiumTier
};

/**
 * Materials domain contracts (spec Part 5 §4.31, Part 8 §8).
 *
 * Manufacturer → collection → decor is one level deep. Supplier codes live on
 * the decor link, never on a global supplier product (phase-3 §9.6). No price
 * field is stored here; pricing belongs to costing in Phase 5.
 */

export interface Manufacturer {
	id: Uuid;
	tenantId: Uuid;
	caption: string;
	country: string | null;
	website: string | null;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface MaterialCollection {
	id: Uuid;
	tenantId: Uuid;
	manufacturerId: Uuid;
	caption: string;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface DecorSheetSize {
	length: number;
	width: number;
}

export interface Decor {
	id: Uuid;
	tenantId: Uuid;
	collectionId: Uuid;
	caption: string;
	decorCode: string;
	textureSurface: string | null;
	colourFamily: DecorColourFamily | null;
	materialType: DecorMaterialType;
	core: DecorCore;
	defaultThicknessMm: number;
	sheetSizeMm: DecorSheetSize;
	grainDirection: GrainDirection | null;
	premiumTier: PremiumTier;
	status: MaterialStatus;
	customerVisible: boolean;
	sampleAssetId: Uuid | null;
	createdAt: string;
	updatedAt: string;
}

export interface Edging {
	id: Uuid;
	tenantId: Uuid;
	caption: string;
	edgingCode: string;
	materialType: string;
	thicknessMm: number;
	colourFamily: DecorColourFamily | null;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface Supplier {
	id: Uuid;
	tenantId: Uuid;
	caption: string;
	contact: string | null;
	leadTimeDays: number | null;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface DecorEdgingLink {
	edgingId: Uuid;
	matchType: EdgingMatchType;
	edging: Edging;
}

export interface DecorSupplierLink {
	supplierId: Uuid;
	supplierCode: string;
	isPrimary: boolean;
	altSupplierCode: string | null;
	supplier: Supplier;
}

export interface DecorAttribute {
	id: Uuid;
	decorId: Uuid;
	attrName: string;
	attrValue: string;
	createdAt: string;
	updatedAt: string;
}

export interface DecorDetail {
	decor: Decor;
	manufacturer: Manufacturer;
	collection: MaterialCollection;
	edgings: DecorEdgingLink[];
	suppliers: DecorSupplierLink[];
	attributes: DecorAttribute[];
}

export type DecorSort = 'caption' | 'decorCode' | 'manufacturer' | 'updatedAt';

export interface DecorListParams {
	search?: string;
	manufacturerId?: Uuid | 'all';
	colourFamily?: DecorColourFamily | 'all';
	materialType?: DecorMaterialType | 'all';
	premiumTier?: PremiumTier | 'all';
	status?: MaterialStatus | 'all';
	customerVisible?: 'visible' | 'hidden' | 'all';
	sort?: DecorSort;
	sortDir?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

export interface DecorListRow {
	id: Uuid;
	caption: string;
	decorCode: string;
	manufacturerId: Uuid;
	manufacturerCaption: string;
	collectionId: Uuid;
	collectionCaption: string;
	colourFamily: DecorColourFamily | null;
	materialType: DecorMaterialType;
	premiumTier: PremiumTier;
	status: MaterialStatus;
	customerVisible: boolean;
	updatedAt: string;
}

export interface EdgingListParams {
	search?: string;
	active?: 'active' | 'inactive' | 'all';
	sort?: 'caption' | 'edgingCode' | 'updatedAt';
	sortDir?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

export interface SupplierListParams {
	search?: string;
	active?: 'active' | 'inactive' | 'all';
	sort?: 'caption' | 'leadTimeDays' | 'updatedAt';
	sortDir?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

export interface SupplierLinkedDecor {
	decorId: Uuid;
	caption: string;
	decorCode: string;
	manufacturerCaption: string;
	collectionCaption: string;
	supplierCode: string;
	isPrimary: boolean;
	altSupplierCode: string | null;
}

export interface SupplierDetail {
	supplier: Supplier;
	decors: SupplierLinkedDecor[];
}

export interface ManufacturerCollectionNode {
	collection: MaterialCollection;
	decorCount: number;
}

export interface ManufacturerNode {
	manufacturer: Manufacturer;
	collections: ManufacturerCollectionNode[];
}

export interface DecorDuplicateCandidate {
	id: Uuid;
	caption: string;
	decorCode: string;
	collectionCaption: string;
	createdAt: string;
	matchReasons: string[];
}

export interface DecorCreateResult {
	decor: Decor;
	/** Reported, never auto-merged (R5); empty when the create is distinct. */
	candidates: DecorDuplicateCandidate[];
}

export interface SupplierDuplicateCandidate {
	id: Uuid;
	caption: string;
	contact: string | null;
	createdAt: string;
	matchReasons: string[];
}

export interface SupplierCreateResult {
	supplier: Supplier;
	candidates: SupplierDuplicateCandidate[];
}

export interface CreateManufacturerInput {
	caption: string;
	country?: string | null;
	website?: string | null;
}

export interface UpdateManufacturerInput {
	caption?: string;
	country?: string | null;
	website?: string | null;
	active?: boolean;
}

export interface CreateCollectionInput {
	manufacturerId: Uuid;
	caption: string;
}

export interface UpdateCollectionInput {
	caption?: string;
	active?: boolean;
}

export interface CreateDecorInput {
	collectionId: Uuid;
	caption: string;
	decorCode: string;
	textureSurface?: string | null;
	colourFamily?: DecorColourFamily | null;
	materialType: DecorMaterialType;
	core: DecorCore;
	defaultThicknessMm: number;
	sheetSizeMm: DecorSheetSize;
	grainDirection?: GrainDirection | null;
	premiumTier?: PremiumTier;
	status?: MaterialStatus;
	customerVisible?: boolean;
}

export interface UpdateDecorInput {
	collectionId?: Uuid;
	caption?: string;
	decorCode?: string;
	textureSurface?: string | null;
	colourFamily?: DecorColourFamily | null;
	materialType?: DecorMaterialType;
	core?: DecorCore;
	defaultThicknessMm?: number;
	sheetSizeMm?: DecorSheetSize;
	grainDirection?: GrainDirection | null;
	premiumTier?: PremiumTier;
	status?: MaterialStatus;
	customerVisible?: boolean;
	sampleAssetId?: Uuid | null;
}

export interface EdgingInput {
	caption: string;
	edgingCode: string;
	materialType: string;
	thicknessMm: number;
	colourFamily?: DecorColourFamily | null;
	active?: boolean;
}

export interface SupplierInput {
	caption: string;
	contact?: string | null;
	leadTimeDays?: number | null;
}

export interface UpdateSupplierInput {
	caption?: string;
	contact?: string | null;
	leadTimeDays?: number | null;
	active?: boolean;
}

export interface DecorEdgingInput {
	edgingId: Uuid;
	matchType: EdgingMatchType;
}

export interface DecorSupplierInput {
	supplierId: Uuid;
	supplierCode: string;
	isPrimary: boolean;
	altSupplierCode?: string | null;
}

export interface DecorAttributeInput {
	attrName: string;
	attrValue: string;
}

export type DecorPage = Page<DecorListRow>;
export type EdgingPage = Page<Edging>;
export type SupplierPage = Page<Supplier>;
