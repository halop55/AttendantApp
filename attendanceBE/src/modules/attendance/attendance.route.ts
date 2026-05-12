import { Router } from "express";
import { AttendanceController } from "./attendance.controller";
import { verifyAccessToken } from "../../shared/middleware/jwt.middleware";

const router = Router();
const controller = new AttendanceController();

router.use(verifyAccessToken([]));

router.post("/check-in", controller.checkIn);
router.post("/check-out", controller.checkOut);
router.get("/today", controller.getToday);

export { router as attendanceRouter };
