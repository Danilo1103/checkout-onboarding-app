export interface ShippingInfo {
  readonly recipient: string;
  readonly phone: string;
  readonly addressLine: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
}

export type DeliveryStatus = 'ASSIGNED';

export interface Delivery extends ShippingInfo {
  readonly id: string;
  readonly transactionId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly status: DeliveryStatus;
  readonly createdAt: string;
}
