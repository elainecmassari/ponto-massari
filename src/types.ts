export type UserRole = "admin" | "employee";

export type SystemUser = {
  id: string;
  name: string;
  email: string;
  pin: string;
  role: UserRole;
  employeeId?: string;
};

export type Employee = {
  id: string;
  name: string;
  document: string;
  position: string;
  department: string;
  admissionDate: string;
  expectedDailyMinutes: number;
  active: boolean;
};

export type PunchField = "clockIn" | "lunchOut" | "lunchIn" | "clockOut";

export type PunchAction = {
  field: PunchField;
  label: string;
};

export type TimeRecord = {
  id: string;
  employeeId: string;
  date: string;
  clockIn?: string;
  lunchOut?: string;
  lunchIn?: string;
  clockOut?: string;
  notes?: string;
  adjustedBy?: string;
};

export type ReportRow = {
  record: TimeRecord;
  employee: Employee;
  workedMinutes: number;
  lunchMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  missingMarks: string[];
};

export type EmployeeForm = {
  name: string;
  document: string;
  position: string;
  department: string;
  admissionDate: string;
  expectedHours: string;
};
