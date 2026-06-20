import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { normalizeBearerToken } from "../utils";

type TokenPayload = {
  userId: number;
};

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = normalizeBearerToken(req.header("Authorization"));
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    req.authUserId = payload.userId;
    next();
  } catch (_err) {
    res.status(401).json({ message: "Invalid token" });
  }
}
