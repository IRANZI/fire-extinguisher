import { Response } from "express";
import { AuthenticatedRequest } from "@fems/shared";
import { createUser, getMe, listUsers, login, signup } from "../services/auth.service";
import { createUserSchema, loginSchema, signupSchema } from "../validations/auth.validation";
import { signToken } from "../utils/jwt";

export const signupCustomer = async (request: AuthenticatedRequest, response: Response) => {
  const user = await signup(signupSchema.parse(request.body));
  request.log.info({ userId: user.id }, "customer account created");
  response.status(201).json({ user, token: signToken(user) });
};

export const loginUser = async (request: AuthenticatedRequest, response: Response) => {
  const input = loginSchema.parse(request.body);
  const user = await login(input.email, input.password);
  request.log.info({ userId: user.id, role: user.role }, "user signed in");
  response.json({ user, token: signToken(user) });
};

export const currentUser = async (request: AuthenticatedRequest, response: Response) => {
  response.json({ user: await getMe(request.user!.id) });
};

export const users = async (request: AuthenticatedRequest, response: Response) => {
  response.json(await listUsers(request.query));
};

export const addUser = async (request: AuthenticatedRequest, response: Response) => {
  const input = createUserSchema.parse(request.body);
  const user = await createUser(request.user!, input);
  request.log.info({ actorId: request.user!.id, userId: user.id, role: input.role }, "user account created");
  response.status(201).json({ user });
};
