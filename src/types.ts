export interface BagItem {
  itemId: string;
  productId: string;
  title: string;
  variant: string;
  image: string;
  unitPriceInr: number;
  qty: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  pincode?: string;
}

export interface CollectorOrder {
  orderId: string;
  userId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPincode: string;
  paymentMethod: 'UPI_FAM';
  upiVpa: '9311635332@fam';
  utrReference: string;
  totalInr: number;
  itemCount: number;
  itemsSummary: string;
  status: 'pending_verification';
  createdAt?: { seconds: number; nanoseconds: number } | null;
}
