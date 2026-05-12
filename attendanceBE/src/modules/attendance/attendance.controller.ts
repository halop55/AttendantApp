import type { Request, Response } from "express";
import { AttendanceService } from "./attendance.service";

export class AttendanceController {
  constructor(
    private readonly service: AttendanceService = new AttendanceService(),
  ) {}

  checkIn = async (req: Request, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }
      console.log("Check-in request body:", req.auth);

      const { email: employeeEmail } = req.auth;
      const { note } = req.body as {
        note?: string;
      };

      if (!employeeEmail) {
        return res.status(400).json({
          success: false,
          message: "employeeEmail is required",
        });
      }

      const data = await this.service.checkIn({ employeeEmail, note });

      return res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      const statusCode =
        (error as Error & { statusCode?: number }).statusCode ?? 500;
      return res.status(statusCode).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  checkOut = async (req: Request, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { email: employeeEmail } = req.auth;
      const { note } = req.body as {
        note?: string;
      };

      if (!employeeEmail) {
        return res.status(400).json({
          success: false,
          message: "employeeEmail is required",
        });
      }

      const data = await this.service.checkOut({ employeeEmail, note });

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      const statusCode =
        (error as Error & { statusCode?: number }).statusCode ?? 500;
      return res.status(statusCode).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  getToday = async (req: Request, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { email: employeeEmail } = req.auth;
      if (!employeeEmail) {
        return res.status(400).json({
          success: false,
          message: "employeeEmail is required",
        });
      }

      const data = await this.service.getTodayByEmail(employeeEmail);

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };
}
