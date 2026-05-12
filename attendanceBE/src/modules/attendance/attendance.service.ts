import { AttendanceRepository } from "./attendance.repository";

export type CheckInInput = {
  employeeEmail: string;
  note?: string;
  checkInAt?: Date;
};

export type CheckOutInput = {
  employeeEmail: string;
  note?: string;
  checkOutAt?: Date;
};

export class AttendanceService {
  constructor(
    private readonly repo: AttendanceRepository = new AttendanceRepository(),
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async getTodayByEmail(employeeEmail: string) {
    const normalized = this.normalizeEmail(employeeEmail);
    return this.repo.findTodayByEmail(normalized);
  }

  async checkIn(input: CheckInInput) {
    const employeeEmail = this.normalizeEmail(input.employeeEmail);

    const existedToday = await this.repo.findTodayByEmail(employeeEmail);
    if (existedToday?.checkin_at) {
      const err = new Error("Employee already checked in today");
      (err as Error & { statusCode?: number }).statusCode = 409;
      throw err;
    }

    return this.repo.createCheckIn({
      employeeEmail,
      note: input.note,
      checkInAt: input.checkInAt,
    });
  }

  async checkOut(input: CheckOutInput) {
    const employeeEmail = this.normalizeEmail(input.employeeEmail);

    const checkedOut = await this.repo.checkOutLatestOpenLog({
      employeeEmail,
      note: input.note,
      checkOutAt: input.checkOutAt,
    });

    if (!checkedOut) {
      const err = new Error("No open check-in found for checkout");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    return checkedOut;
  }

  async getCurrentOpenLog(employeeEmail: string) {
    const normalized = this.normalizeEmail(employeeEmail);
    return this.repo.findOpenLogByEmail(normalized);
  }
}
