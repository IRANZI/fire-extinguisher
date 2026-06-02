export type ExtinguisherStatus = "ACTIVE" | "EXPIRED" | "SERVICED" | "REPLACED";

export interface ExtinguisherInput {
  customerId: string;
  serialNumber: string;
  extinguisherType: string;
  capacityKg: number;
  manufacturer: string;
  purchaseDate: Date;
  expiryDate: Date;
  notes: string;
}
