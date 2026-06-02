import jwt from "jsonwebtoken";
import { getJwtSecret } from "@fems/shared";
import { TokenUser } from "../models/user.model";

export const signToken = (user: TokenUser) =>
  jwt.sign(user, getJwtSecret(), {
    expiresIn: "8h",
  });
