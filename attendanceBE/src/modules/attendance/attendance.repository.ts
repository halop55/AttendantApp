import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type AttendanceLogRow = {
  id: number;
  checkin_at: string | null;
  checkout_at: string | null;
  note: string | null;
  employee_email: string;
};

type CreateCheckInInput = {
  employeeEmail: string;
  note?: string;
  checkInAt?: Date;
};

type CheckOutInput = {
  employeeEmail: string;
  note?: string;
  checkOutAt?: Date;
};

const TABLE = "attendance_logs";

function toUtcDayBounds(date: Date) {
  const start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export class AttendanceRepository {
  constructor(private readonly db: SupabaseClient = supabase) {}

  async findTodayByEmail(employeeEmail: string, now: Date = new Date()) {
    const { startIso, endIso } = toUtcDayBounds(now);

    const { data, error } = await this.db
      .from(TABLE)
      .select("*")
      .eq("employee_email", employeeEmail)
      .gte("checkin_at", startIso)
      .lte("checkin_at", endIso)
      .order("checkin_at", { ascending: false })
      .limit(1)
      .maybeSingle<AttendanceLogRow>();

    if (error) throw new Error(`findTodayByEmail failed: ${error.message}`);
    return data;
  }

  async findOpenLogByEmail(employeeEmail: string) {
    const { data, error } = await this.db
      .from(TABLE)
      .select("*")
      .eq("employee_email", employeeEmail)
      .is("checkout_at", null)
      .order("checkin_at", { ascending: false })
      .limit(1)
      .maybeSingle<AttendanceLogRow>();

    if (error) throw new Error(`findOpenLogByEmail failed: ${error.message}`);
    return data;
  }

  async createCheckIn(input: CreateCheckInInput) {
    const payload = {
      employee_email: input.employeeEmail,
      note: input.note ?? null,
      checkin_at: (input.checkInAt ?? new Date()).toISOString(),
    };

    const { data, error } = await this.db
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single<AttendanceLogRow>();

    if (error) throw new Error(`createCheckIn failed: ${error.message}`);
    return data;
  }

  async updateCheckOutById(
    id: number,
    input: Omit<CheckOutInput, "employeeEmail">,
  ) {
    const payload = {
      checkout_at: (input.checkOutAt ?? new Date()).toISOString(),
      note: input.note ?? null,
    };

    const { data, error } = await this.db
      .from(TABLE)
      .update(payload)
      .eq("id", id)
      .select("*")
      .single<AttendanceLogRow>();

    if (error) throw new Error(`updateCheckOutById failed: ${error.message}`);
    return data;
  }

  async checkOutLatestOpenLog(input: CheckOutInput) {
    const openLog = await this.findOpenLogByEmail(input.employeeEmail);
    if (!openLog) return null;

    return this.updateCheckOutById(openLog.id, {
      checkOutAt: input.checkOutAt,
      note: input.note,
    });
  }
}
