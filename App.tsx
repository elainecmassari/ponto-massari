import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { isSupabaseConfigured } from "./src/lib/supabase";
import { Employee, EmployeeForm, PunchAction, ReportRow, SystemUser, TimeRecord } from "./src/types";
import {
  buildReportRows,
  currentMonthIso,
  currentTime,
  decimalHoursToMinutes,
  formatDate,
  formatDayName,
  minutesToTime,
  monthLabel,
  reportToCsv,
  timeToMinutes,
  todayIso
} from "./src/utils/format";

type AdminTab = "Painel" | "Relatorios" | "Funcionarios" | "Ajustes";
type EmployeeTab = "Ponto" | "Meu mes";
type AppTab = AdminTab | EmployeeTab;

type AdjustmentForm = {
  employeeId: string;
  date: string;
  clockIn: string;
  lunchOut: string;
  lunchIn: string;
  clockOut: string;
  notes: string;
};

type Tone = "blue" | "green" | "amber" | "red";

const adminTabs: AdminTab[] = ["Painel", "Relatorios", "Funcionarios", "Ajustes"];
const employeeTabs: EmployeeTab[] = ["Ponto", "Meu mes"];

const punchActions: PunchAction[] = [
  { field: "clockIn", label: "Entrada" },
  { field: "lunchOut", label: "Saida almoco" },
  { field: "lunchIn", label: "Volta almoco" },
  { field: "clockOut", label: "Saida" }
];

function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return todayIso(date);
}

const seedEmployees: Employee[] = [
  {
    id: "emp-1",
    name: "Maria Oliveira",
    document: "123.456.789-00",
    position: "Auxiliar administrativo",
    department: "Financeiro",
    admissionDate: "2024-03-04",
    expectedDailyMinutes: 480,
    active: true
  },
  {
    id: "emp-2",
    name: "Ana Santos",
    document: "987.654.321-00",
    position: "Atendente",
    department: "Recepcao",
    admissionDate: "2023-09-11",
    expectedDailyMinutes: 480,
    active: true
  },
  {
    id: "emp-3",
    name: "Joao Lima",
    document: "456.987.123-00",
    position: "Operador",
    department: "Oficina",
    admissionDate: "2025-01-20",
    expectedDailyMinutes: 440,
    active: true
  }
];

const seedUsers: SystemUser[] = [
  { id: "user-admin", name: "Administrador", email: "admin@massari.com.br", pin: "1234", role: "admin" },
  { id: "user-maria", name: "Maria Oliveira", email: "maria@massari.com.br", pin: "1111", role: "employee", employeeId: "emp-1" },
  { id: "user-ana", name: "Ana Santos", email: "ana@massari.com.br", pin: "2222", role: "employee", employeeId: "emp-2" }
];

const seedRecords: TimeRecord[] = [
  {
    id: "rec-today-1",
    employeeId: "emp-1",
    date: todayIso(),
    clockIn: "08:02",
    lunchOut: "12:05"
  },
  {
    id: "rec-yesterday-1",
    employeeId: "emp-1",
    date: dateOffset(-1),
    clockIn: "08:01",
    lunchOut: "12:00",
    lunchIn: "13:02",
    clockOut: "17:08"
  },
  {
    id: "rec-yesterday-2",
    employeeId: "emp-2",
    date: dateOffset(-1),
    clockIn: "07:55",
    lunchOut: "11:58",
    lunchIn: "13:00",
    clockOut: "16:57"
  },
  {
    id: "rec-week-1",
    employeeId: "emp-3",
    date: dateOffset(-2),
    clockIn: "08:13",
    lunchOut: "12:12",
    lunchIn: "13:18",
    clockOut: "17:24",
    notes: "Ajuste autorizado pelo admin."
  }
];

const emptyEmployeeForm = (): EmployeeForm => ({
  name: "",
  document: "",
  position: "",
  department: "",
  admissionDate: todayIso(),
  expectedHours: "8"
});

const emptyAdjustmentForm = (employeeId: string): AdjustmentForm => ({
  employeeId,
  date: todayIso(),
  clockIn: "",
  lunchOut: "",
  lunchIn: "",
  clockOut: "",
  notes: ""
});

export default function App() {
  const [users, setUsers] = useState<SystemUser[]>(seedUsers);
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [tab, setTab] = useState<AppTab>("Painel");
  const [loginEmail, setLoginEmail] = useState("admin@massari.com.br");
  const [loginPin, setLoginPin] = useState("1234");
  const [employees, setEmployees] = useState<Employee[]>(seedEmployees);
  const [records, setRecords] = useState<TimeRecord[]>(seedRecords);
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(() => emptyEmployeeForm());
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIso());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");
  const [csvPreview, setCsvPreview] = useState("");
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>(() => emptyAdjustmentForm(seedEmployees[0].id));

  const currentEmployee = currentUser?.employeeId ? employees.find((employee) => employee.id === currentUser.employeeId) : undefined;
  const isAdmin = currentUser?.role === "admin";
  const visibleTabs = isAdmin ? adminTabs : employeeTabs;

  const reportRows = useMemo(() => {
    const employeeFilter = isAdmin ? selectedEmployeeId : currentEmployee?.id ?? "all";
    return buildReportRows(records, employees, selectedMonth, employeeFilter);
  }, [currentEmployee?.id, employees, isAdmin, records, selectedEmployeeId, selectedMonth]);

  const monthlyRowsAllEmployees = useMemo(() => buildReportRows(records, employees, currentMonthIso(), "all"), [employees, records]);

  function handleLogin() {
    const user = users.find((item) => item.email.toLowerCase() === loginEmail.trim().toLowerCase() && item.pin === loginPin.trim());
    if (!user) {
      Alert.alert("Login nao encontrado", "Confira o email e o PIN.");
      return;
    }
    setCurrentUser(user);
    setTab(user.role === "admin" ? "Painel" : "Ponto");
  }

  function quickLogin(user: SystemUser) {
    setLoginEmail(user.email);
    setLoginPin(user.pin);
    setCurrentUser(user);
    setTab(user.role === "admin" ? "Painel" : "Ponto");
  }

  function logout() {
    setCurrentUser(null);
    setTab("Painel");
  }

  function registerPunch() {
    if (!currentEmployee) return;
    const existing = records.find((record) => record.employeeId === currentEmployee.id && record.date === todayIso());
    const nextAction = getNextAction(existing);

    if (!nextAction) {
      Alert.alert("Jornada completa", "Os quatro pontos de hoje ja foram registrados.");
      return;
    }

    const now = currentTime();
    setRecords((current) => {
      const currentRecord = current.find((record) => record.employeeId === currentEmployee.id && record.date === todayIso());
      if (!currentRecord) {
        return [
          {
            id: `rec-${Date.now()}`,
            employeeId: currentEmployee.id,
            date: todayIso(),
            [nextAction.field]: now
          },
          ...current
        ];
      }

      return current.map((record) => (record.id === currentRecord.id ? { ...record, [nextAction.field]: now } : record));
    });

    Alert.alert("Ponto registrado", `${nextAction.label} as ${now}.`);
  }

  function saveEmployee() {
    if (!employeeForm.name.trim() || !employeeForm.document.trim() || !employeeForm.position.trim()) {
      Alert.alert("Dados obrigatorios", "Informe nome, documento e cargo.");
      return;
    }

    const employeeId = `emp-${Date.now()}`;
    const pin = employeeForm.document.replace(/\D/g, "").slice(-4) || "1234";
    const email = buildEmployeeEmail(employeeForm.name);
    const employee: Employee = {
      id: employeeId,
      name: employeeForm.name.trim(),
      document: employeeForm.document.trim(),
      position: employeeForm.position.trim(),
      department: employeeForm.department.trim() || "Geral",
      admissionDate: employeeForm.admissionDate || todayIso(),
      expectedDailyMinutes: decimalHoursToMinutes(employeeForm.expectedHours),
      active: true
    };

    setEmployees((current) => [employee, ...current]);
    setUsers((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        name: employee.name,
        email,
        pin,
        role: "employee",
        employeeId
      }
    ]);
    setEmployeeForm(emptyEmployeeForm());
    Alert.alert("Funcionario cadastrado", `Login: ${email}\nPIN: ${pin}`);
  }

  function toggleEmployeeStatus(employeeId: string) {
    setEmployees((current) => current.map((employee) => (employee.id === employeeId ? { ...employee, active: !employee.active } : employee)));
  }

  function saveAdjustment() {
    if (!isAdmin || !adjustmentForm.employeeId || !adjustmentForm.date) return;
    const invalidField = [adjustmentForm.clockIn, adjustmentForm.lunchOut, adjustmentForm.lunchIn, adjustmentForm.clockOut].find((value) => value && timeToMinutes(value) === null);
    if (invalidField) {
      Alert.alert("Horario invalido", "Use o formato HH:MM, por exemplo 08:00.");
      return;
    }

    const existing = records.find((record) => record.employeeId === adjustmentForm.employeeId && record.date === adjustmentForm.date);
    const adjusted: TimeRecord = {
      id: existing?.id ?? `rec-${Date.now()}`,
      employeeId: adjustmentForm.employeeId,
      date: adjustmentForm.date,
      clockIn: adjustmentForm.clockIn || undefined,
      lunchOut: adjustmentForm.lunchOut || undefined,
      lunchIn: adjustmentForm.lunchIn || undefined,
      clockOut: adjustmentForm.clockOut || undefined,
      notes: adjustmentForm.notes || undefined,
      adjustedBy: currentUser?.name
    };

    setRecords((current) => [adjusted, ...current.filter((record) => record.id !== adjusted.id)]);
    Alert.alert("Registro salvo", "O ajuste do ponto foi atualizado.");
  }

  function loadAdjustment(employeeId = adjustmentForm.employeeId, date = adjustmentForm.date) {
    const existing = records.find((record) => record.employeeId === employeeId && record.date === date);
    setAdjustmentForm({
      employeeId,
      date,
      clockIn: existing?.clockIn ?? "",
      lunchOut: existing?.lunchOut ?? "",
      lunchIn: existing?.lunchIn ?? "",
      clockOut: existing?.clockOut ?? "",
      notes: existing?.notes ?? ""
    });
  }

  function generateCsv() {
    setCsvPreview(reportToCsv(reportRows));
  }

  if (!currentUser) {
    return (
      <LoginScreen
        users={users}
        email={loginEmail}
        pin={loginPin}
        setEmail={setLoginEmail}
        setPin={setLoginPin}
        onLogin={handleLogin}
        onQuickLogin={quickLogin}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text style={styles.brand}>Ponto Massari</Text>
          <Text style={styles.subtitle}>{currentUser.role === "admin" ? "Administrador" : currentEmployee?.name ?? currentUser.name}</Text>
        </View>
        <View style={styles.headerActions}>
          <View style={[styles.badge, isSupabaseConfigured ? styles.badgeOnline : styles.badgeDemo]}>
            <Text style={styles.badgeText}>{isSupabaseConfigured ? "Supabase" : "Demo local"}</Text>
          </View>
          <IconButton icon="log-out-outline" label="Sair" onPress={logout} />
        </View>
      </View>

      <TabBar items={visibleTabs} selected={tab} onSelect={setTab} />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {isAdmin && tab === "Painel" && (
          <DashboardView employees={employees} records={records} rows={monthlyRowsAllEmployees} onOpenReports={() => setTab("Relatorios")} />
        )}
        {isAdmin && tab === "Relatorios" && (
          <ReportView
            rows={reportRows}
            employees={employees}
            month={selectedMonth}
            selectedEmployeeId={selectedEmployeeId}
            csvPreview={csvPreview}
            showEmployeeFilter
            title="Relatorio mensal"
            onMonthChange={setSelectedMonth}
            onEmployeeChange={setSelectedEmployeeId}
            onGenerateCsv={generateCsv}
          />
        )}
        {isAdmin && tab === "Funcionarios" && (
          <EmployeesView
            employees={employees}
            users={users}
            form={employeeForm}
            setForm={setEmployeeForm}
            onSave={saveEmployee}
            onToggleStatus={toggleEmployeeStatus}
          />
        )}
        {isAdmin && tab === "Ajustes" && (
          <AdjustmentsView
            employees={employees}
            records={records}
            form={adjustmentForm}
            setForm={setAdjustmentForm}
            onSave={saveAdjustment}
            onLoad={loadAdjustment}
          />
        )}
        {!isAdmin && tab === "Ponto" && currentEmployee && <PunchView employee={currentEmployee} records={records} onRegister={registerPunch} />}
        {!isAdmin && tab === "Meu mes" && currentEmployee && (
          <ReportView
            rows={reportRows}
            employees={employees}
            month={selectedMonth}
            selectedEmployeeId={currentEmployee.id}
            csvPreview={csvPreview}
            title="Meu mes"
            onMonthChange={setSelectedMonth}
            onEmployeeChange={setSelectedEmployeeId}
            onGenerateCsv={generateCsv}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LoginScreen(props: {
  users: SystemUser[];
  email: string;
  pin: string;
  setEmail: (value: string) => void;
  setPin: (value: string) => void;
  onLogin: () => void;
  onQuickLogin: (user: SystemUser) => void;
}) {
  const demoUsers = props.users.filter((user) => user.role === "admin" || user.employeeId).slice(0, 3);
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.loginWrap}>
        <View style={styles.loginTop}>
          <View style={styles.logoMark}>
            <Ionicons name="time-outline" size={30} color="#ffffff" />
          </View>
          <View>
            <Text style={styles.brand}>Ponto Massari</Text>
            <Text style={styles.subtitle}>Controle de entrada, saida e almoco.</Text>
          </View>
        </View>

        <View style={styles.loginPanel}>
          <SectionTitle title="Acesso" />
          <Input label="Email" value={props.email} onChangeText={props.setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Input label="PIN" value={props.pin} onChangeText={props.setPin} keyboardType="numeric" secureTextEntry />
          <Button label="Entrar" icon="log-in-outline" onPress={props.onLogin} />
        </View>

        <SectionTitle title="Perfis de teste" />
        {demoUsers.map((user) => (
          <Pressable key={user.id} style={styles.userOption} onPress={() => props.onQuickLogin(user)}>
            <View style={styles.userIcon}>
              <Ionicons name={user.role === "admin" ? "shield-checkmark-outline" : "person-outline"} size={20} color="#0f172a" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{user.name}</Text>
              <Text style={styles.muted}>{user.email} | PIN {user.pin}</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={20} color="#64748b" />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function DashboardView({ employees, records, rows, onOpenReports }: { employees: Employee[]; records: TimeRecord[]; rows: ReportRow[]; onOpenReports: () => void }) {
  const today = todayIso();
  const todayRecords = records.filter((record) => record.date === today);
  const activeEmployees = employees.filter((employee) => employee.active);
  const presentToday = new Set(todayRecords.filter((record) => record.clockIn).map((record) => record.employeeId)).size;
  const onLunch = todayRecords.filter((record) => record.lunchOut && !record.lunchIn).length;
  const pendingExit = todayRecords.filter((record) => record.clockIn && !record.clockOut).length;
  const monthBalance = rows.reduce((sum, row) => sum + row.balanceMinutes, 0);

  return (
    <View>
      <SectionTitle title="Painel de hoje" />
      <View style={styles.grid}>
        <MetricCard label="Ativos" value={String(activeEmployees.length)} icon="people-outline" tone="blue" />
        <MetricCard label="Presentes" value={String(presentToday)} icon="checkmark-circle-outline" tone="green" />
        <MetricCard label="Em almoco" value={String(onLunch)} icon="restaurant-outline" tone="amber" />
        <MetricCard label="Saida pendente" value={String(pendingExit)} icon="alert-circle-outline" tone="red" />
      </View>

      <View style={styles.summaryBand}>
        <View>
          <Text style={styles.summaryLabel}>Saldo do mes</Text>
          <Text style={[styles.summaryValue, monthBalance < 0 && styles.negativeText]}>{minutesToTime(monthBalance)}</Text>
        </View>
        <Button label="Ver relatorio" icon="document-text-outline" onPress={onOpenReports} secondary compact />
      </View>

      <SectionTitle title="Registros de hoje" />
      {todayRecords.length === 0 && <EmptyState text="Nenhum ponto registrado hoje." />}
      {todayRecords.map((record) => {
        const employee = employees.find((item) => item.id === record.employeeId);
        return <RecordCard key={record.id} record={record} employee={employee} />;
      })}
    </View>
  );
}

function PunchView({ employee, records, onRegister }: { employee: Employee; records: TimeRecord[]; onRegister: () => void }) {
  const today = todayIso();
  const todayRecord = records.find((record) => record.employeeId === employee.id && record.date === today);
  const nextAction = getNextAction(todayRecord);
  const monthRows = buildReportRows(records, [employee], currentMonthIso(), employee.id);
  const workedThisMonth = monthRows.reduce((sum, row) => sum + row.workedMinutes, 0);
  const balanceThisMonth = monthRows.reduce((sum, row) => sum + row.balanceMinutes, 0);

  return (
    <View>
      <SectionTitle title="Registrar ponto" />
      <View style={styles.clockPanel}>
        <Text style={styles.clockDate}>{formatDayName(today)}, {formatDate(today)}</Text>
        <Text style={styles.clockTime}>{currentTime()}</Text>
        <Text style={styles.clockNext}>{nextAction ? nextAction.label : "Jornada completa"}</Text>
        <Button label={nextAction ? `Registrar ${nextAction.label}` : "Ponto completo"} icon="finger-print-outline" onPress={onRegister} />
      </View>

      <View style={styles.grid}>
        <MetricCard label="Mes" value={minutesToTime(workedThisMonth)} icon="calendar-outline" tone="blue" />
        <MetricCard label="Saldo" value={minutesToTime(balanceThisMonth)} icon="speedometer-outline" tone={balanceThisMonth < 0 ? "red" : "green"} />
      </View>

      <SectionTitle title="Hoje" />
      <PunchTimeline record={todayRecord} />
    </View>
  );
}

function ReportView(props: {
  rows: ReportRow[];
  employees: Employee[];
  month: string;
  selectedEmployeeId: string;
  csvPreview: string;
  title: string;
  showEmployeeFilter?: boolean;
  onMonthChange: (value: string) => void;
  onEmployeeChange: (value: string) => void;
  onGenerateCsv: () => void;
}) {
  const totalWorked = props.rows.reduce((sum, row) => sum + row.workedMinutes, 0);
  const totalExpected = props.rows.reduce((sum, row) => sum + row.expectedMinutes, 0);
  const balance = totalWorked - totalExpected;
  const pending = props.rows.filter((row) => row.missingMarks.length > 0).length;
  const employeeOptions = ["all", ...props.employees.map((employee) => employee.id)];

  return (
    <View>
      <SectionTitle title={props.title} />
      <Input label="Mes (AAAA-MM)" value={props.month} onChangeText={props.onMonthChange} />
      {props.showEmployeeFilter && (
        <ChoiceRow
          label="Funcionario"
          values={employeeOptions}
          selected={props.selectedEmployeeId}
          onSelect={props.onEmployeeChange}
          renderValue={(value) => (value === "all" ? "Todos" : props.employees.find((employee) => employee.id === value)?.name ?? value)}
        />
      )}

      <View style={styles.summaryBand}>
        <View>
          <Text style={styles.summaryLabel}>{monthLabel(props.month)}</Text>
          <Text style={styles.summaryValue}>{minutesToTime(totalWorked)}</Text>
        </View>
        <View style={styles.summaryRight}>
          <Text style={styles.summarySmall}>Previsto {minutesToTime(totalExpected)}</Text>
          <Text style={[styles.summarySmallStrong, balance < 0 && styles.negativeText]}>Saldo {minutesToTime(balance)}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <MetricCard label="Dias" value={String(props.rows.length)} icon="calendar-number-outline" tone="blue" />
        <MetricCard label="Pendencias" value={String(pending)} icon="warning-outline" tone={pending ? "amber" : "green"} />
      </View>

      <Button label="Gerar CSV" icon="download-outline" onPress={props.onGenerateCsv} secondary />
      {!!props.csvPreview && <Text selectable style={styles.csvBox}>{props.csvPreview}</Text>}

      <SectionTitle title="Dias do mes" compact />
      {props.rows.length === 0 && <EmptyState text="Nenhum registro encontrado para o filtro." />}
      {props.rows.map((row) => <ReportRowCard key={row.record.id} row={row} />)}
    </View>
  );
}

function EmployeesView(props: {
  employees: Employee[];
  users: SystemUser[];
  form: EmployeeForm;
  setForm: (form: EmployeeForm) => void;
  onSave: () => void;
  onToggleStatus: (employeeId: string) => void;
}) {
  return (
    <View>
      <SectionTitle title="Novo funcionario" />
      <Input label="Nome" value={props.form.name} onChangeText={(name) => props.setForm({ ...props.form, name })} />
      <Input label="CPF ou documento" value={props.form.document} onChangeText={(document) => props.setForm({ ...props.form, document })} />
      <Input label="Cargo" value={props.form.position} onChangeText={(position) => props.setForm({ ...props.form, position })} />
      <Input label="Setor" value={props.form.department} onChangeText={(department) => props.setForm({ ...props.form, department })} />
      <View style={styles.row}>
        <Input label="Admissao" value={props.form.admissionDate} onChangeText={(admissionDate) => props.setForm({ ...props.form, admissionDate })} half />
        <Input label="Horas/dia" value={props.form.expectedHours} onChangeText={(expectedHours) => props.setForm({ ...props.form, expectedHours })} keyboardType="numeric" half />
      </View>
      <Button label="Cadastrar funcionario" icon="person-add-outline" onPress={props.onSave} />

      <SectionTitle title="Funcionarios" />
      {props.employees.map((employee) => {
        const user = props.users.find((item) => item.employeeId === employee.id);
        return (
          <View key={employee.id} style={styles.employeeCard}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{employee.name}</Text>
                <Text style={styles.muted}>{employee.position} | {employee.department}</Text>
              </View>
              <StatusPill label={employee.active ? "Ativo" : "Inativo"} tone={employee.active ? "green" : "red"} />
            </View>
            <Text style={styles.bodyText}>Jornada: {minutesToTime(employee.expectedDailyMinutes)} por dia</Text>
            {!!user && <Text style={styles.muted}>Login: {user.email} | PIN {user.pin}</Text>}
            <Button
              label={employee.active ? "Inativar" : "Ativar"}
              icon={employee.active ? "pause-circle-outline" : "play-circle-outline"}
              onPress={() => props.onToggleStatus(employee.id)}
              secondary
              compact
            />
          </View>
        );
      })}
    </View>
  );
}

function AdjustmentsView(props: {
  employees: Employee[];
  records: TimeRecord[];
  form: AdjustmentForm;
  setForm: (form: AdjustmentForm) => void;
  onSave: () => void;
  onLoad: (employeeId?: string, date?: string) => void;
}) {
  const employeeIds = props.employees.map((employee) => employee.id);
  const recentRecords = [...props.records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return (
    <View>
      <SectionTitle title="Ajustar ponto" />
      <ChoiceRow
        label="Funcionario"
        values={employeeIds}
        selected={props.form.employeeId}
        onSelect={(employeeId) => props.setForm({ ...props.form, employeeId })}
        renderValue={(employeeId) => props.employees.find((employee) => employee.id === employeeId)?.name ?? employeeId}
      />
      <Input label="Data (AAAA-MM-DD)" value={props.form.date} onChangeText={(date) => props.setForm({ ...props.form, date })} />
      <Button label="Carregar dia" icon="refresh-outline" onPress={() => props.onLoad()} secondary compact />
      <View style={styles.row}>
        <Input label="Entrada" value={props.form.clockIn} onChangeText={(clockIn) => props.setForm({ ...props.form, clockIn })} half />
        <Input label="Saida almoco" value={props.form.lunchOut} onChangeText={(lunchOut) => props.setForm({ ...props.form, lunchOut })} half />
      </View>
      <View style={styles.row}>
        <Input label="Volta almoco" value={props.form.lunchIn} onChangeText={(lunchIn) => props.setForm({ ...props.form, lunchIn })} half />
        <Input label="Saida" value={props.form.clockOut} onChangeText={(clockOut) => props.setForm({ ...props.form, clockOut })} half />
      </View>
      <Input label="Observacao" value={props.form.notes} onChangeText={(notes) => props.setForm({ ...props.form, notes })} multiline />
      <Button label="Salvar ajuste" icon="save-outline" onPress={props.onSave} />

      <SectionTitle title="Ultimos registros" />
      {recentRecords.map((record) => {
        const employee = props.employees.find((item) => item.id === record.employeeId);
        return (
          <View key={record.id} style={styles.adjustmentItem}>
            <RecordCard record={record} employee={employee} />
            <Button label="Editar" icon="create-outline" onPress={() => props.onLoad(record.employeeId, record.date)} secondary compact />
          </View>
        );
      })}
    </View>
  );
}

function PunchTimeline({ record }: { record?: TimeRecord }) {
  return (
    <View style={styles.timeline}>
      {punchActions.map((action) => {
        const value = record?.[action.field];
        return (
          <View key={action.field} style={styles.timelineItem}>
            <View style={[styles.timelineDot, value && styles.timelineDotDone]}>
              <Ionicons name={value ? "checkmark-outline" : "ellipse-outline"} size={14} color={value ? "#ffffff" : "#64748b"} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.timelineLabel}>{action.label}</Text>
              <Text style={styles.timelineTime}>{value ?? "--:--"}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function RecordCard({ record, employee }: { record: TimeRecord; employee?: Employee }) {
  return (
    <View style={styles.recordCard}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.cardTitle}>{employee?.name ?? "Funcionario"}</Text>
          <Text style={styles.muted}>{formatDayName(record.date)}, {formatDate(record.date)}</Text>
        </View>
        {!!record.adjustedBy && <StatusPill label="Ajustado" tone="amber" />}
      </View>
      <View style={styles.punchGrid}>
        <PunchValue label="Entrada" value={record.clockIn} />
        <PunchValue label="Almoco" value={record.lunchOut} />
        <PunchValue label="Retorno" value={record.lunchIn} />
        <PunchValue label="Saida" value={record.clockOut} />
      </View>
      {!!record.notes && <Text style={styles.bodyText}>{record.notes}</Text>}
    </View>
  );
}

function ReportRowCard({ row }: { row: ReportRow }) {
  return (
    <View style={styles.recordCard}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{formatDate(row.record.date)} | {row.employee.name}</Text>
          <Text style={styles.muted}>{formatDayName(row.record.date)} | Almoco {minutesToTime(row.lunchMinutes)}</Text>
        </View>
        <StatusPill label={row.missingMarks.length ? "Pendente" : "OK"} tone={row.missingMarks.length ? "amber" : "green"} />
      </View>
      <View style={styles.punchGrid}>
        <PunchValue label="Entrada" value={row.record.clockIn} />
        <PunchValue label="Almoco" value={row.record.lunchOut} />
        <PunchValue label="Retorno" value={row.record.lunchIn} />
        <PunchValue label="Saida" value={row.record.clockOut} />
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.bodyText}>Trabalhado {minutesToTime(row.workedMinutes)}</Text>
        <Text style={[styles.balanceText, row.balanceMinutes < 0 && styles.negativeText]}>Saldo {minutesToTime(row.balanceMinutes)}</Text>
      </View>
      {row.missingMarks.length > 0 && <Text style={styles.warningText}>Falta: {row.missingMarks.join(", ")}</Text>}
    </View>
  );
}

function PunchValue({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.punchValue}>
      <Text style={styles.punchLabel}>{label}</Text>
      <Text style={styles.punchTime}>{value ?? "--:--"}</Text>
    </View>
  );
}

function MetricCard({ label, value, icon, tone }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; tone: Tone }) {
  return (
    <View style={[styles.metricCard, toneStyles[tone].card]}>
      <Ionicons name={icon} size={22} color={toneStyles[tone].ink.color} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function TabBar<T extends string>({ items, selected, onSelect }: { items: T[]; selected: string; onSelect: (item: T) => void }) {
  return (
    <View style={styles.tabs}>
      {items.map((item) => (
        <Pressable key={item} style={[styles.tab, selected === item && styles.tabActive]} onPress={() => onSelect(item)}>
          <Text style={[styles.tabText, selected === item && styles.tabTextActive]} numberOfLines={1}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ChoiceRow<T extends string>(props: {
  label: string;
  values: T[];
  selected: string;
  onSelect: (value: T) => void;
  renderValue?: (value: T) => string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {props.values.map((value) => (
          <Pressable key={value} style={[styles.choice, props.selected === value && styles.choiceActive]} onPress={() => props.onSelect(value)}>
            <Text style={[styles.choiceText, props.selected === value && styles.choiceTextActive]}>{props.renderValue ? props.renderValue(value) : value}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Input(props: {
  label: string;
  value?: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "email-address";
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  half?: boolean;
}) {
  return (
    <View style={[styles.field, props.half && styles.half]}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value ?? ""}
        onChangeText={props.onChangeText}
        multiline={props.multiline}
        keyboardType={props.keyboardType}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize}
        style={[styles.input, props.multiline && styles.textArea]}
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

function Button(props: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  secondary?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable style={[styles.button, props.secondary && styles.buttonSecondary, props.compact && styles.buttonCompact]} onPress={props.onPress}>
      <Ionicons name={props.icon} size={18} color={props.secondary ? "#0f172a" : "#ffffff"} />
      <Text style={[styles.buttonText, props.secondary && styles.buttonTextSecondary]} numberOfLines={1}>{props.label}</Text>
    </Pressable>
  );
}

function IconButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.iconButton} onPress={onPress} accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color="#0f172a" />
    </Pressable>
  );
}

function SectionTitle({ title, compact }: { title: string; compact?: boolean }) {
  return <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>{title}</Text>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="file-tray-outline" size={24} color="#64748b" />
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  return (
    <View style={[styles.statusPill, toneStyles[tone].pill]}>
      <Text style={[styles.statusText, toneStyles[tone].ink]}>{label}</Text>
    </View>
  );
}

function getNextAction(record?: TimeRecord): PunchAction | null {
  return punchActions.find((action) => !record?.[action.field]) ?? null;
}

function buildEmployeeEmail(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "");
  return `${slug || "funcionario"}@ponto.local`;
}

const toneStyles = {
  blue: {
    card: { backgroundColor: "#e0f2fe", borderColor: "#bae6fd" },
    pill: { backgroundColor: "#dbeafe" },
    ink: { color: "#075985" }
  },
  green: {
    card: { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" },
    pill: { backgroundColor: "#dcfce7" },
    ink: { color: "#166534" }
  },
  amber: {
    card: { backgroundColor: "#fef3c7", borderColor: "#fde68a" },
    pill: { backgroundColor: "#fef3c7" },
    ink: { color: "#92400e" }
  },
  red: {
    card: { backgroundColor: "#fee2e2", borderColor: "#fecaca" },
    pill: { backgroundColor: "#fee2e2" },
    ink: { color: "#991b1b" }
  }
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerTitle: { flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { fontSize: 28, fontWeight: "900", color: "#0f172a" },
  subtitle: { color: "#475569", marginTop: 2 },
  badge: { alignSelf: "center", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeDemo: { backgroundColor: "#fef3c7" },
  badgeOnline: { backgroundColor: "#ccfbf1" },
  badgeText: { color: "#0f172a", fontSize: 12, fontWeight: "800" },
  iconButton: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  tabs: { flexDirection: "row", paddingHorizontal: 12, gap: 8 },
  tab: { flex: 1, minHeight: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#e2e8f0", paddingHorizontal: 6 },
  tabActive: { backgroundColor: "#0f172a" },
  tabText: { color: "#334155", fontSize: 12, fontWeight: "800" },
  tabTextActive: { color: "#ffffff" },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 34 },
  loginWrap: { padding: 18, paddingBottom: 34 },
  loginTop: { minHeight: 128, flexDirection: "row", alignItems: "center", gap: 14 },
  logoMark: { width: 58, height: 58, borderRadius: 8, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center" },
  loginPanel: { backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, marginBottom: 14 },
  userOption: { minHeight: 72, backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  userIcon: { width: 42, height: 42, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 20, fontWeight: "900", color: "#0f172a", marginTop: 8, marginBottom: 12 },
  sectionTitleCompact: { fontSize: 17, marginTop: 18, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  metricCard: { width: "48%", minHeight: 112, borderRadius: 8, padding: 14, borderWidth: 1, justifyContent: "space-between" },
  metricValue: { fontSize: 24, fontWeight: "900", color: "#0f172a" },
  metricLabel: { color: "#334155", fontWeight: "800" },
  summaryBand: { minHeight: 78, backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", padding: 14, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  summaryRight: { alignItems: "flex-end", gap: 4 },
  summaryLabel: { color: "#64748b", fontWeight: "800", textTransform: "capitalize" },
  summaryValue: { color: "#0f172a", fontSize: 28, fontWeight: "900", marginTop: 2 },
  summarySmall: { color: "#64748b", fontWeight: "700" },
  summarySmallStrong: { color: "#166534", fontWeight: "900" },
  clockPanel: { backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", padding: 18, marginBottom: 12, alignItems: "center" },
  clockDate: { color: "#475569", fontWeight: "800" },
  clockTime: { color: "#0f172a", fontSize: 54, fontWeight: "900", marginVertical: 8 },
  clockNext: { color: "#0f766e", fontWeight: "900", marginBottom: 14 },
  field: { marginBottom: 12 },
  half: { flex: 1 },
  label: { color: "#334155", fontWeight: "800", marginBottom: 6 },
  input: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 12, color: "#0f172a" },
  textArea: { minHeight: 86, textAlignVertical: "top", paddingTop: 12 },
  button: { minHeight: 48, borderRadius: 8, backgroundColor: "#0f172a", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10, paddingHorizontal: 14 },
  buttonSecondary: { backgroundColor: "#e2e8f0" },
  buttonCompact: { minHeight: 40, alignSelf: "flex-start" },
  buttonText: { color: "#ffffff", fontWeight: "900" },
  buttonTextSecondary: { color: "#0f172a" },
  choice: { minHeight: 38, borderRadius: 8, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#e2e8f0", marginRight: 8 },
  choiceActive: { backgroundColor: "#0f766e" },
  choiceText: { color: "#334155", fontWeight: "800" },
  choiceTextActive: { color: "#ffffff" },
  row: { flexDirection: "row", gap: 10 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  flex: { flex: 1 },
  employeeCard: { backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, marginBottom: 10, gap: 8 },
  adjustmentItem: { marginBottom: 4 },
  recordCard: { backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, marginBottom: 10, gap: 10 },
  cardTitle: { color: "#0f172a", fontSize: 16, fontWeight: "900" },
  muted: { color: "#64748b", fontWeight: "600" },
  bodyText: { color: "#334155", lineHeight: 20 },
  punchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  punchValue: { width: "48%", minHeight: 58, borderRadius: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", padding: 10 },
  punchLabel: { color: "#64748b", fontSize: 12, fontWeight: "800" },
  punchTime: { color: "#0f172a", fontSize: 18, fontWeight: "900", marginTop: 3 },
  balanceText: { color: "#166534", fontWeight: "900" },
  negativeText: { color: "#b91c1c" },
  warningText: { color: "#92400e", fontWeight: "800" },
  csvBox: { borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", padding: 12, color: "#0f172a", fontFamily: "monospace", marginBottom: 12 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: "900" },
  timeline: { backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", padding: 14 },
  timelineItem: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 },
  timelineDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  timelineDotDone: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  timelineLabel: { color: "#334155", fontWeight: "900" },
  timelineTime: { color: "#0f172a", fontSize: 18, fontWeight: "900", marginTop: 2 },
  emptyState: { minHeight: 86, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 }
});
