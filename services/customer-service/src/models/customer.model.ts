export interface CustomerInput {
  portalUserId?: string | null;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  nationalId: string;
  companyName: string;
}

export type CustomerUpdate = Partial<Omit<CustomerInput, "portalUserId">>;
