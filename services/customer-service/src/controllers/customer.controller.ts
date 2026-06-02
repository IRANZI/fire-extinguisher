import { Response } from "express";
import { AppError, AuthenticatedRequest } from "@fems/shared";
import {
  archiveCustomer,
  createCustomer,
  getSelf,
  listCustomers,
  saveSelf,
  updateCustomer,
} from "../services/customer.service";
import { customerSchema, customerUpdateSchema, uuidParam } from "../validations/customer.validation";

export const getOwnProfile = async (request: AuthenticatedRequest, response: Response) => {
  response.json({ customer: await getSelf(request.user!.id) });
};

export const saveOwnProfile = async (request: AuthenticatedRequest, response: Response) => {
  const input = customerSchema.omit({ portalUserId: true }).parse(request.body);
  response.json({ customer: await saveSelf(request.user!, input) });
};

export const list = async (request: AuthenticatedRequest, response: Response) => {
  response.json(await listCustomers(request.query));
};

export const create = async (request: AuthenticatedRequest, response: Response) => {
  response.status(201).json({ customer: await createCustomer(request.user!, customerSchema.parse(request.body)) });
};

export const update = async (request: AuthenticatedRequest, response: Response) => {
  const { id } = uuidParam.parse(request.params);
  const input = customerUpdateSchema.parse(request.body);
  if (!Object.keys(input).length) throw new AppError(400, "At least one field is required");
  const customer = await updateCustomer(request.user!, id, input);
  if (!customer) throw new AppError(404, "Customer not found");
  response.json({ customer });
};

export const archive = async (request: AuthenticatedRequest, response: Response) => {
  const { id } = uuidParam.parse(request.params);
  if (!(await archiveCustomer(request.user!, id))) throw new AppError(404, "Customer not found");
  response.status(204).send();
};
