import { Role } from "@fems/shared";

export interface TokenUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface CreateUserInput extends SignupInput {
  role: Role;
}
