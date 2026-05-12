import express from "express";
import { attendanceRouter } from "./modules/attendance/attendance.route";

export function createApp() {
  const app = express();

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  });

  app.use(express.json());

  const prefix = "/api/v1";

  app.use(`${prefix}/attendance`, attendanceRouter);

  app.get(["/health", `${prefix}/health`], (req, res) => {
    res.status(200).json({
      success: true,
      message: "Attendance API is running",
      service: "attendance-api",
    });
  });

  return app;
}
