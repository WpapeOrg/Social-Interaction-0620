import { NextFunction, Request, Response } from "express";
import { config } from "../config";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header("x-admin-key");
  if (!apiKey || apiKey !== config.adminApiKey) {
    res.status(401).json({ message: "Unauthorized admin" });
    return;
  }
  next();
}
