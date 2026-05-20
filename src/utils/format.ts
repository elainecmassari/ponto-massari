import { Employee, ReportRow, TimeRecord } from "../types";

const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function todayIso(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function currentMonthIso(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function currentTime(date = new Date()): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function formatDayName(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return dayLabels[new Date(year, month - 1, day).getDay()];
}

export function monthLabel(monthIso: string): string {
  const [year, month] = monthIso.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function timeToMinutes(time?: string): number | null {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const total = Math.abs(minutes);
  return `${sign}${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function decimalHoursToMinutes(value: string): number {
  const normalized = value.replace(",", ".").trim();
  const hours = Number(normalized);
  return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : 480;
}

export function calculateWorkedMinutes(record: TimeRecord): number {
  const clockIn = timeToMinutes(record.clockIn);
  const clockOut = timeToMinutes(record.clockOut);
  if (clockIn === null || clockOut === null || clockOut <= clockIn) return 0;

  const lunchOut = timeToMinutes(record.lunchOut);
  const lunchIn = timeToMinutes(record.lunchIn);
  const lunch = lunchOut !== null && lunchIn !== null && lunchIn > lunchOut ? lunchIn - lunchOut : 0;
  return Math.max(0, clockOut - clockIn - lunch);
}

export function calculateLunchMinutes(record: TimeRecord): number {
  const lunchOut = timeToMinutes(record.lunchOut);
  const lunchIn = timeToMinutes(record.lunchIn);
  return lunchOut !== null && lunchIn !== null && lunchIn > lunchOut ? lunchIn - lunchOut : 0;
}

export function missingMarks(record: TimeRecord): string[] {
  return [
    ["Entrada", record.clockIn],
    ["Saida almoco", record.lunchOut],
    ["Volta almoco", record.lunchIn],
    ["Saida", record.clockOut]
  ]
    .filter(([, value]) => !value)
    .map(([label]) => label);
}

export function buildReportRows(records: TimeRecord[], employees: Employee[], monthIso: string, employeeId = "all"): ReportRow[] {
  return records
    .filter((record) => record.date.startsWith(monthIso))
    .filter((record) => employeeId === "all" || record.employeeId === employeeId)
    .map((record) => {
      const employee = employees.find((item) => item.id === record.employeeId);
      if (!employee) return null;
      const workedMinutes = calculateWorkedMinutes(record);
      const lunchMinutes = calculateLunchMinutes(record);
      return {
        record,
        employee,
        workedMinutes,
        lunchMinutes,
        expectedMinutes: employee.expectedDailyMinutes,
        balanceMinutes: workedMinutes - employee.expectedDailyMinutes,
        missingMarks: missingMarks(record)
      };
    })
    .filter((row): row is ReportRow => Boolean(row))
    .sort((a, b) => `${a.record.date}-${a.employee.name}`.localeCompare(`${b.record.date}-${b.employee.name}`));
}

export function reportToCsv(rows: ReportRow[]): string {
  const header = ["Data", "Funcionario", "Entrada", "Saida almoco", "Volta almoco", "Saida", "Almoco", "Trabalhado", "Saldo", "Pendencias"];
  const lines = rows.map((row) =>
    [
      formatDate(row.record.date),
      row.employee.name,
      row.record.clockIn ?? "",
      row.record.lunchOut ?? "",
      row.record.lunchIn ?? "",
      row.record.clockOut ?? "",
      minutesToTime(row.lunchMinutes),
      minutesToTime(row.workedMinutes),
      minutesToTime(row.balanceMinutes),
      row.missingMarks.join(" | ")
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(";")
  );
  return [header.join(";"), ...lines].join("\n");
}
