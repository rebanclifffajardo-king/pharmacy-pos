/**
 * Domain types for the YasMar Pharmacy POS demo.
 *
 * These mirror the tables a future Supabase schema would hold (one interface ≈ one table).
 * All money values are Philippine pesos (PHP) stored as numbers rounded to 2 decimals.
 * Timestamps are ISO-8601 UTC strings; calendar dates (expiry, received) are `YYYY-MM-DD`
 * interpreted in the Asia/Manila timezone.
 */

export type ID = string;
export type ISODateTime = string;
/** Calendar date `YYYY-MM-DD` (Asia/Manila). */
export type DateKey = string;

// ---------------------------------------------------------------------------
// Users & roles
// ---------------------------------------------------------------------------

export type Role = "admin" | "pharmacist" | "cashier" | "inventory" | "manager";

export type UserStatus = "active" | "inactive" | "invited";

export interface User {
  id: ID;
  name: string;
  initials: string;
  email: string;
  role: Role;
  status: UserStatus;
  /** Demo-only PIN used for simulated authorizations. Never a real credential. */
  pin: string;
  prcLicense?: string;
  phone?: string;
  createdAt: ISODateTime;
  lastLoginAt?: ISODateTime;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface Category {
  id: ID;
  name: string;
  /** Hex colour used for charts and tiles. */
  color: string;
}

export interface Supplier {
  id: ID;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  tin?: string;
  paymentTerms: string;
  leadTimeDays: number;
  status: "active" | "inactive";
  notes?: string;
  createdAt: ISODateTime;
}

export type DosageForm =
  | "Tablet"
  | "Capsule"
  | "Softgel"
  | "Syrup"
  | "Suspension"
  | "Drops"
  | "Sachet"
  | "Inhaler"
  | "Nebule"
  | "Solution"
  | "Ointment"
  | "Cream"
  | "Lozenge"
  | "Spray"
  | "Device";

export type MedicineStatus = "active" | "inactive";

export interface Medicine {
  id: ID;
  sku: string;
  barcode: string;
  genericName: string;
  brandName: string;
  categoryId: ID;
  dosageForm: DosageForm;
  strength: string;
  /** Human packaging description, e.g. "Box of 100 (10 × 10)". */
  packaging: string;
  /** Base selling unit noun, e.g. "tab", "cap", "bottle". Stock is counted in this unit. */
  unit: string;
  /** Units per box (used for "Box" pack selection and purchase orders). */
  packSize: number;
  /** Units per strip/blister, when sold by strip. */
  stripSize?: number;
  /** Acquisition cost per base unit (PHP). */
  costPrice: number;
  /** Selling price per base unit, VAT-inclusive (PHP). */
  sellingPrice: number;
  /** Reorder level — at or below this many saleable units the medicine is "low stock". */
  minStock: number;
  /** Suggested reorder quantity in base units. */
  reorderQty: number;
  supplierId: ID;
  manufacturer: string;
  rxRequired: boolean;
  status: MedicineStatus;
  /** Shelf location label. */
  location: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type BatchStatus = "saleable" | "quarantined" | "recalled" | "written_off";

export interface Batch {
  id: ID;
  medicineId: ID;
  batchNo: string;
  expiryDate: DateKey;
  manufactureDate?: DateKey;
  receivedDate: DateKey;
  supplierId: ID;
  initialQty: number;
  /** Remaining units in this batch. Never negative. */
  quantity: number;
  unitCost: number;
  location: string;
  status: BatchStatus;
  purchaseOrderId?: ID;
}

// ---------------------------------------------------------------------------
// Inventory movements & audit
// ---------------------------------------------------------------------------

export type MovementType =
  | "sale"
  | "refund_restock"
  | "void_restock"
  | "stock_in"
  | "stock_out"
  | "adjustment"
  | "po_receipt"
  | "write_off"
  | "quarantine"
  | "release";

export interface StockMovement {
  id: ID;
  medicineId: ID;
  batchId?: ID;
  batchNo?: string;
  type: MovementType;
  /** Signed change in saleable units (negative = out). Quarantine moves are recorded as negative. */
  qty: number;
  /** Saleable units for the medicine after the movement (undefined for imported history). */
  balanceAfter?: number;
  reference?: string;
  reason?: string;
  userId: ID;
  userName: string;
  authorizedById?: ID;
  authorizedByName?: string;
  createdAt: ISODateTime;
}

export type ActivityKind =
  | "sale"
  | "refund"
  | "void"
  | "inventory"
  | "purchase"
  | "supplier"
  | "user"
  | "settings"
  | "auth"
  | "print"
  | "system";

export type Tone = "info" | "success" | "warning" | "danger" | "neutral";

export interface ActivityLog {
  id: ID;
  kind: ActivityKind;
  message: string;
  userId: ID;
  userName: string;
  tone: Tone;
  reference?: string;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export type PaymentMethod = "cash" | "qrph" | "card";

export type DiscountType = "none" | "senior" | "pwd" | "manual";

export interface DiscountInput {
  type: DiscountType;
  /** Manual discount as a percentage of the subtotal (0–100). */
  manualPercent?: number;
  /** Manual discount as a fixed peso amount (alternative to percent). */
  manualAmount?: number;
  /** OSCA / PWD ID number recorded for SC/PWD discounts. */
  idNumber?: string;
  customerName?: string;
  /** User who approved a manual discount. */
  approvedById?: ID;
}

export interface BatchAllocation {
  batchId: ID;
  batchNo: string;
  expiryDate: DateKey;
  qty: number;
}

export interface SaleLine {
  id: ID;
  medicineId: ID;
  /** Snapshot: brand + strength at time of sale. */
  name: string;
  genericName: string;
  unit: string;
  /** Pack label sold, e.g. "Tablet", "Strip ×10", "Box ×100". */
  packLabel: string;
  /** Base units per pack sold. */
  packMultiplier: number;
  /** Quantity in packs. */
  qty: number;
  /** Total base units (qty × packMultiplier). */
  baseQty: number;
  /** Price per base unit (VAT-inclusive). */
  unitPrice: number;
  /** Gross line total before transaction-level discount. */
  lineTotal: number;
  /** Cost per base unit (weighted from allocated batches). */
  unitCost: number;
  rxRequired: boolean;
  allocations: BatchAllocation[];
  /** Base units already refunded. */
  refundedQty: number;
}

export interface PaymentRecord {
  method: PaymentMethod;
  amountDue: number;
  tendered?: number;
  change?: number;
  /** Provider reference (QR Ph) — simulated in Demo Mode. */
  reference?: string;
  /** Card approval code — simulated in Demo Mode. */
  approvalCode?: string;
  cardLast4?: string;
  simulated: boolean;
}

export interface RxVerification {
  pharmacistId: ID;
  pharmacistName: string;
  prescriber: string;
  prcLicense: string;
  rxDate: string;
  verifiedAt: ISODateTime;
}

export type TransactionStatus = "completed" | "partially_refunded" | "refunded" | "voided";

export interface SaleTransaction {
  id: ID;
  receiptNo: string;
  idempotencyKey: string;
  createdAt: ISODateTime;
  cashierId: ID;
  cashierName: string;
  branch: string;
  lines: SaleLine[];
  subtotal: number;
  discountType: DiscountType;
  /** Rate applied, e.g. 0.2 for SC/PWD. */
  discountRate: number;
  /** Peso value of the discount itself (excludes VAT exemption). */
  discountAmount: number;
  /** VAT removed for VAT-exempt SC/PWD sales. */
  lessVat: number;
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  total: number;
  payment: PaymentRecord;
  status: TransactionStatus;
  discountIdNumber?: string;
  customerName?: string;
  rxVerification?: RxVerification;
  printCount: number;
  lastPrintedAt?: ISODateTime;
  refundedAmount: number;
  refundIds: ID[];
  voidedAt?: ISODateTime;
  voidedById?: ID;
  voidedByName?: string;
  voidReason?: string;
}

export interface RefundLine {
  saleLineId: ID;
  medicineId: ID;
  name: string;
  /** Base units refunded. */
  qty: number;
  amount: number;
  restock: boolean;
  restockBatchId?: ID;
  restockBatchNo?: string;
}

export interface Refund {
  id: ID;
  refundNo: string;
  transactionId: ID;
  receiptNo: string;
  createdAt: ISODateTime;
  lines: RefundLine[];
  amount: number;
  reason: string;
  method: PaymentMethod;
  processedById: ID;
  processedByName: string;
  authorizedById: ID;
  authorizedByName: string;
}

export interface HeldSaleLine {
  medicineId: ID;
  packMultiplier: number;
  packLabel: string;
  qty: number;
}

export interface HeldSale {
  id: ID;
  label: string;
  createdAt: ISODateTime;
  cashierId: ID;
  lines: HeldSaleLine[];
  discount: DiscountInput;
}

// ---------------------------------------------------------------------------
// Purchasing
// ---------------------------------------------------------------------------

export type PurchaseOrderStatus = "draft" | "ordered" | "partially_received" | "received" | "cancelled";

export interface PurchaseOrderLine {
  id: ID;
  medicineId: ID;
  name: string;
  /** Units per pack ordered (usually the medicine's packSize). */
  packSize: number;
  /** Quantity ordered in packs. */
  qty: number;
  /** Cost per pack. */
  unitCost: number;
  /** Packs received so far. */
  receivedQty: number;
}

export interface PurchaseOrderReceiptLine {
  lineId: ID;
  qty: number;
  batchNo: string;
  expiryDate: DateKey;
  batchId: ID;
}

export interface PurchaseOrderReceipt {
  id: ID;
  receivedAt: ISODateTime;
  receivedById: ID;
  receivedByName: string;
  lines: PurchaseOrderReceiptLine[];
}

export interface PurchaseOrder {
  id: ID;
  poNumber: string;
  supplierId: ID;
  status: PurchaseOrderStatus;
  createdAt: ISODateTime;
  createdById: ID;
  createdByName: string;
  orderedAt?: ISODateTime;
  expectedDate?: DateKey;
  receivedAt?: ISODateTime;
  cancelledAt?: ISODateTime;
  notes?: string;
  lines: PurchaseOrderLine[];
  receipts: PurchaseOrderReceipt[];
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface PharmacyProfile {
  name: string;
  branch: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  tin: string;
  businessPermit: string;
  /** FDA License to Operate number. */
  ltoNumber: string;
  /** BIR permit / accreditation placeholder. */
  birPermit: string;
  /** Machine / terminal serial placeholder. */
  serialNo: string;
  /** Data URL of a custom uploaded logo, or null for the brand default. */
  logoDataUrl: string | null;
}

export interface PosSettings {
  currency: "PHP";
  timezone: "Asia/Manila";
  vatRate: number;
  pricesVatInclusive: boolean;
  seniorDiscountRate: number;
  pwdDiscountRate: number;
  /** When true, SC/PWD sales remove VAT before applying the discount (demo rule). */
  scPwdVatExempt: boolean;
  maxManualDiscountPercent: number;
  manualDiscountRequiresApproval: boolean;
  expiryWarningDays: number;
  receiptPrefix: string;
  receiptPadding: number;
  nextReceiptNo: number;
  refundPrefix: string;
  nextRefundNo: number;
  poPrefix: string;
  nextPoNo: number;
  counterName: string;
}

export type PrinterConnection = "browser" | "escpos-bridge";

export interface PrinterSettings {
  model: string;
  paperWidthMm: 58 | 80;
  charsPerLine: 32 | 42 | 48;
  fontSizePx: number;
  sideMarginMm: number;
  showLogo: boolean;
  footerMessage: string;
  footerMessage2: string;
  connection: PrinterConnection;
  autoPrintAfterSale: boolean;
}

export interface Settings {
  pharmacy: PharmacyProfile;
  pos: PosSettings;
  printer: PrinterSettings;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

export interface DemoDatabase {
  schemaVersion: number;
  seededAt: ISODateTime;
  categories: Category[];
  suppliers: Supplier[];
  medicines: Medicine[];
  batches: Batch[];
  transactions: SaleTransaction[];
  refunds: Refund[];
  purchaseOrders: PurchaseOrder[];
  users: User[];
  movements: StockMovement[];
  activity: ActivityLog[];
  heldSales: HeldSale[];
  settings: Settings;
}

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

export type StockStatus = "in" | "low" | "out" | "expiring" | "expired" | "inactive";

export interface StockInfo {
  medicineId: ID;
  /** Units in saleable, unexpired batches. */
  saleable: number;
  /** Units in batches that are past expiry, quarantined or recalled. */
  blocked: number;
  expiredUnits: number;
  nearestExpiry?: DateKey;
  nearestBatchNo?: string;
  /** Days until the nearest saleable batch expires. */
  daysToExpiry?: number;
  isLow: boolean;
  isOut: boolean;
  isExpiring: boolean;
  hasExpired: boolean;
  status: StockStatus;
  /** Saleable stock valued at batch cost. */
  valueAtCost: number;
}

/** Result shape returned by every store action that mutates data. */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };
