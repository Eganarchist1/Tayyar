export type ThemeMode = "midnight" | "fajr";

export type DashboardStat = {
  label: string;
  value: string | number;
  delta?: number;
};

export type HeroLocation = {
  heroId: string;
  lat: number;
  lng: number;
  status?: string;
  updatedAt?: string;
};

export type CustomerAddress = {
  id: string;
  phone: string;
  name?: string | null;
  lat: number;
  lng: number;
  branchId?: string;
  branchName?: string | null;
  branchNameAr?: string | null;
  addressLabel?: string | null;
  usageCount?: number;
  lastUsedAt?: string;
};

export type CustomerListRow = {
  id: string;
  phone: string;
  name?: string | null;
  merchant: {
    id: string;
    name: string;
    nameAr?: string | null;
  };
  totalOrders: number;
  addressCount: number;
  lastAddress?: string | null;
  lastOrderAt?: string | null;
  createdAt: string;
};

export type CustomerRecentOrder = {
  id: string;
  orderNumber: string;
  status: string;
  requestedAt: string;
  deliveryAddress?: string | null;
  branch: {
    id: string;
    name: string;
    nameAr?: string | null;
  };
};

export type CustomerDetail = {
  id: string;
  phone: string;
  name?: string | null;
  totalOrders: number;
  lastAddress?: string | null;
  createdAt: string;
  updatedAt: string;
  merchant: {
    id: string;
    name: string;
    nameAr?: string | null;
  };
  duplicateCandidates?: DuplicateCustomerCandidate[];
  auditTrail?: AuditEventRecord[];
  addresses: CustomerAddress[];
  recentOrders: CustomerRecentOrder[];
};

export type CustomerUpdatePayload = {
  name?: string | null;
  phone?: string;
  addresses?: Array<{
    id?: string;
    branchId: string;
    name?: string | null;
    addressLabel: string;
    lat: number;
    lng: number;
    remove?: boolean;
  }>;
};

export type GeocodeCandidate = {
  id: string;
  label: string;
  secondaryLabel?: string | null;
  lat: number;
  lng: number;
  confidence: "high" | "medium" | "low" | "fallback";
  source: "mapbox" | "fallback";
};

export type MerchantCustomerContext = {
  customer: {
    phone: string;
    name?: string | null;
    totalOrders: number;
    lastAddress?: string | null;
    lastOrderAt?: string | null;
  };
  addresses: CustomerAddress[];
  recentOrders: CustomerRecentOrder[];
  locationRequest: CustomerLocationRequest | null;
};

export type MerchantOrderDraft = {
  branchId: string;
  zoneId: string;
  customerPhone: string;
  customerName?: string;
  customerAddressId?: string;
  deliveryLat: number;
  deliveryLng: number;
  deliveryAddress?: string;
  pickupLat: number;
  pickupLng: number;
  collectionAmount?: number;
  paymentMode?: "COLLECT_ON_DELIVERY" | "PREPAID";
  saveConfirmedAddress?: boolean;
  notes?: string;
};

export type CustomerLocationRequest = {
  id: string;
  requestToken: string;
  customerPhone: string;
  customerName?: string | null;
  status: "PENDING" | "RESOLVED" | "EXPIRED" | "FAILED";
  whatsappMessageId?: string | null;
  resolvedLat?: number | null;
  resolvedLng?: number | null;
  resolvedAddressLabel?: string | null;
  expiresAt: string;
  resolvedAt?: string | null;
  createdAt: string;
  branch: {
    id: string;
    name: string;
    nameAr?: string | null;
    whatsappNumber?: string | null;
  };
};

export type MerchantOrderStatusHistory = {
  id: string;
  status: string;
  note?: string | null;
  createdAt: string;
};

export type MerchantOrderDetail = {
  id: string;
  trackingId: string;
  orderNumber: string;
  status: string;
  requestedAt: string;
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
  deliveryAddress?: string | null;
  deliveryLat: number;
  deliveryLng: number;
  deliveryFee?: number | null;
  collectionAmount?: number | null;
  paymentMode?: "COLLECT_ON_DELIVERY" | "PREPAID";
  customerPhone: string;
  customerName?: string | null;
  notes?: string | null;
  branch: {
    id: string;
    name: string;
    nameAr?: string | null;
    address: string;
  };
  zone: {
    id: string;
    name: string;
    nameAr?: string | null;
    city?: string | null;
    baseFee?: number | null;
  };
  hero?: {
    id: string;
    status?: string | null;
    user?: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
    zone?: {
      id: string;
      name: string;
      nameAr?: string | null;
    } | null;
  } | null;
  customerAddress?: {
    id: string;
    addressLabel?: string | null;
    lat: number;
    lng: number;
  } | null;
  statusHistory: MerchantOrderStatusHistory[];
};

export type MerchantSummary = {
  id: string;
  name: string;
  nameAr?: string | null;
};

export type AdminMerchantDetail = {
  id: string;
  name: string;
  nameAr?: string | null;
  logoUrl?: string | null;
  walletBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    language?: string | null;
  };
  stats: {
    branches: number;
    customers: number;
    orders: number;
    activeBranches: number;
  };
  alerts?: OperationalAlertItem[];
  auditTrail?: AuditEventRecord[];
  branches: Array<{
    id: string;
    name: string;
    nameAr?: string | null;
    address: string;
    phone?: string | null;
    whatsappNumber?: string | null;
    isActive: boolean;
    orderCount: number;
    customerCount: number;
  }>;
  recentOrders: CustomerRecentOrder[];
};

export type AdminBranchDetail = {
  id: string;
  name: string;
  nameAr?: string | null;
  address: string;
  lat: number;
  lng: number;
  phone?: string | null;
  whatsappNumber?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  merchant: {
    id: string;
    name: string;
    nameAr?: string | null;
  };
  manager?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  stats: {
    orders: number;
    customers: number;
    activeHeroAssignments: number;
  };
  alerts?: OperationalAlertItem[];
  auditTrail?: AuditEventRecord[];
  recentOrders: CustomerRecentOrder[];
};

export type DuplicateCustomerCandidate = {
  id: string;
  phone: string;
  name?: string | null;
  merchant: {
    id: string;
    name: string;
    nameAr?: string | null;
  };
  lastAddress?: string | null;
  totalOrders: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
};

export type OperationalAlertItem = {
  id: string;
  kind: string;
  severity: "low" | "medium" | "high" | string;
  status: string;
  titleCode: string;
  messageCode: string;
  entityType?: string | null;
  entityId?: string | null;
  actionHref?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
};

export type AuditEventRecord = {
  id: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary?: Record<string, unknown> | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  createdAt: string;
};

export type HeroStatus =
  | "ONLINE"
  | "OFFLINE"
  | "ON_DELIVERY"
  | "ON_BREAK";
