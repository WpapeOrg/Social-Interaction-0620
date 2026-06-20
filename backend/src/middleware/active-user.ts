import { NextFunction, Request, Response } from "express";
import { RowDataPacket } from "mysql2";
import { pool } from "../db";

export async function requireActiveUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.authUserId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT status FROM users WHERE id = ? LIMIT 1",
    [req.authUserId]
  );
  if (!rows[0]) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  if (rows[0].status !== "active") {
    res.status(403).json({ message: "Account is banned" });
    return;
  }

  next();
}
