import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Fingerprint,
  Loader2,
  LogIn,
  LogOut,
  PauseCircle,
  PlayCircle,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Users
} from "lucide-react";
import { isConfigured, supabase } from "./lib/supabase";
import "./styles.css";

// ─── Brand ────────────────────────────────────────────────────────────────────

const brand = {
  company: "Massari Ferramentas",
  accounting: "Virtus Contabil",
  logo: "/massari-logo.png"
};

// ─── Demo seed (usado apenas quando Supabase não está configurado) ─────────────

const dailyMotivation = [
  "Organizacao no inicio do dia deixa o trabalho mais leve.",
  "Cada registro certo ajuda a fechar o mes sem correria.",
  "Seu cuidado com o ponto tambem cuida da sua tranquilidade.",
  "Um bom dia comeca com presenca, foco e clareza.",
  "Pequenas rotinas bem feitas sustentam grandes resultados.",
  "Pontualidade e uma forma simples de respeito com voce e com a equipe.",
  "Hoje e mais uma oportunidade de fazer o essencial bem feito.",
  "Trabalho bem registrado vira fechamento sem duvidas.",
  "Comece pelo simples: registre seu ponto e siga com calma.",
  "Disciplina no dia a dia evita problemas no fim do mes."
];

const punchActions = [
  ["clockIn", "Entrada"],
  ["lunchOut", "Saida almoco"],
  ["lunchIn", "Volta almoco"],
  ["clockOut", "Saida"]
];

const employeesSeed = [
  { id: "emp-1", name: "Maria Oliveira", document: "123.456.789-00", position: "Auxiliar administrativo", department: "Financeiro", admissionDate: "2024-03-04", expectedDailyMinutes: 480, active: true },
  { id: "emp-2", name: "Ana Santos", document: "987.654.321-00", position: "Atendente", department: "Recepcao", admissionDate: "2023-09-11", expectedDailyMinutes: 480, active: true },
  { id: "emp-3", name: "Joao Lima", document: "456.987.123-00", position: "Operador", department: "Oficina", admissionDate: "2025-01-20", expectedDailyMinutes: 440, active: true }
];

const usersSeed = [
  { id: "user-admin", name: "Administrador", email: "admin@massari.com.br", pin: "1234", role: "admin" },
  { id: "user-maria", name: "Maria Oliveira", email: "maria@massari.com.br", pin: "1111", role: "employee", employeeId: "emp-1" },
  { id: "user-ana", name: "Ana Santos", email: "ana@massari.com.br", pin: "2222", role: "employee", employeeId: "emp-2" }
];

const recordsSeed = [
  { id: "rec-today-1", employeeId: "emp-1", date: todayIso(), clockIn: "08:02", lunchOut: "12:05" },
  { id: "rec-yesterday-1", employeeId: "emp-1", date: dateOffset(-1), clockIn: "08:01", lunchOut: "12:00", lunchIn: "13:02", clockOut: "17:08" },
  { id: "rec-yesterday-2", employeeId: "emp-2", date: dateOffset(-1), clockIn: "07:55", lunchOut: "11:58", lunchIn: "13:00", clockOut: "16:57" },
  { id: "rec-week-1", employeeId: "emp-3", date: dateOffset(-2), clockIn: "08:13", lunchOut: "12:12", lunchIn: "13:18", clockOut: "17:24", notes: "Ajuste autorizado pelo admin." }
];

// ─── Supabase mappers ──────────────────────────────────────────────────────────

function mapEmployee(row) {
  return {
    id: row.id,
    name: row.full_name,
    document: row.document,
    position: row.position,
    department: row.department,
    admissionDate: row.admission_date,
    expectedDailyMinutes: row.expected_daily_minutes,
    active: row.active,
    profileId: row.profile_id ?? null,
    entryTime: row.entry_time ?? "",
    exitTime: row.exit_time ?? "",
    lunchOut: row.lunch_out ?? "",
    lunchIn: row.lunch_in ?? "",
    salary: Number(row.salary ?? 0),
    va: Number(row.va ?? 0),
    vt: Number(row.vt ?? 0)
  };
}

function mapRecord(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    date: row.work_date,
    clockIn: row.clock_in ? row.clock_in.slice(0, 5) : undefined,
    lunchOut: row.lunch_out ? row.lunch_out.slice(0, 5) : undefined,
    lunchIn: row.lunch_in ? row.lunch_in.slice(0, 5) : undefined,
    clockOut: row.clock_out ? row.clock_out.slice(0, 5) : undefined,
    notes: row.notes ?? undefined,
    adjustedBy: row.adjusted_by ?? undefined
  };
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [users, setUsers] = useState(isConfigured ? [] : usersSeed);
  const [employees, setEmployees] = useState(isConfigured ? [] : employeesSeed);
  const [records, setRecords] = useState(isConfigured ? [] : recordsSeed);
  const [currentUser, setCurrentUser] = useState(null);
  const [email, setEmail] = useState("admin@massari.com.br");
  const [pin, setPin] = useState("1234");
  const [tab, setTab] = useState("Painel");
  const [month, setMonth] = useState(currentMonthIso());
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [csv, setCsv] = useState("");
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm());
  const [adjustment, setAdjustment] = useState(emptyAdjustment(isConfigured ? "" : employeesSeed[0].id));
  const [loading, setLoading] = useState(isConfigured);
  const [saving, setSaving] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  const currentEmployee = currentUser?.employeeId ? employees.find((e) => e.id === currentUser.employeeId) : null;
  const reportEmployee = isAdmin ? employeeFilter : currentEmployee?.id ?? "all";
  const rows = useMemo(() => buildReportRows(records, employees, month, reportEmployee), [records, employees, month, reportEmployee]);
  const monthRows = useMemo(() => buildReportRows(records, employees, currentMonthIso(), "all"), [records, employees]);

  // ── Supabase session ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isConfigured) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadAppData(data.session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setCurrentUser(null);
        setEmployees([]);
        setRecords([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadAppData(userId) {
    setLoading(true);
    try {
      const [{ data: profile, error: profileErr }, { data: emps }, { data: recs }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("employees").select("*").order("full_name"),
        supabase.from("time_records").select("*").gte("work_date", dateOffset(-120)).order("work_date", { ascending: false })
      ]);

      if (profileErr) throw profileErr;

      const empList = emps ?? [];
      const ownEmployee = empList.find((e) => e.profile_id === userId);

      setCurrentUser({
        id: profile.id,
        name: profile.full_name,
        email: profile.email,
        role: profile.role,
        employeeId: ownEmployee?.id ?? null
      });
      setEmployees(empList.map(mapEmployee));
      setRecords((recs ?? []).map(mapRecord));
      if (empList.length > 0) setAdjustment((prev) => prev.employeeId === "" ? emptyAdjustment(empList[0].id) : prev);
      setTab(profile.role === "admin" ? "Painel" : "Ponto");
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      try { await supabase.auth.signOut(); } catch {}
      window.alert("Nao foi possivel carregar os dados. Tente fazer login novamente.");
    } finally {
      setLoading(false);
    }
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  async function login() {
    if (!isConfigured) {
      const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.pin === pin.trim());
      if (!found) { window.alert("Confira o email e o PIN."); return; }
      setCurrentUser(found);
      setTab(found.role === "admin" ? "Painel" : "Ponto");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pin.trim()
    });
    if (error) {
      setLoading(false);
      window.alert(error.message.includes("Invalid") ? "Confira o email e o PIN." : error.message);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }
    await loadAppData(session.user.id);
  }

  async function quickLogin(user) {
    setEmail(user.email);
    setPin(user.pin);
    if (!isConfigured) {
      setCurrentUser(user);
      setTab(user.role === "admin" ? "Painel" : "Ponto");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: user.pin });
    if (error) { setLoading(false); window.alert("Usuario de teste nao existe no Supabase. Use o login manual."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }
    await loadAppData(session.user.id);
  }

  async function logout() {
    if (isConfigured) await supabase.auth.signOut();
    setCurrentUser(null);
    setTab("Painel");
    if (!isConfigured) {
      setEmployees(employeesSeed);
      setRecords(recordsSeed);
    }
  }

  // ── Ponto ───────────────────────────────────────────────────────────────────

  async function registerPunch() {
    if (!currentEmployee) return;
    const today = todayIso();
    if (isWeekend(today) || getHoliday(today)) {
      window.alert("Hoje nao ha expediente cadastrado para bater ponto.");
      return;
    }
    const record = records.find((item) => item.employeeId === currentEmployee.id && item.date === today);
    const action = getNextAction(record);
    if (!action) { window.alert("Os quatro pontos de hoje ja foram registrados."); return; }

    const now = currentTime();
    const updated = record
      ? { ...record, [action[0]]: now }
      : { id: `rec-${Date.now()}`, employeeId: currentEmployee.id, date: today, [action[0]]: now };

    setRecords((prev) => record
      ? prev.map((item) => item.id === record.id ? updated : item)
      : [updated, ...prev]);

    if (isConfigured) {
      const { error } = await supabase.from("time_records").upsert({
        employee_id: currentEmployee.id,
        work_date: today,
        clock_in: updated.clockIn || null,
        lunch_out: updated.lunchOut || null,
        lunch_in: updated.lunchIn || null,
        clock_out: updated.clockOut || null
      }, { onConflict: "employee_id,work_date" });

      if (error) {
        setRecords((prev) => record ? prev.map((item) => item.id === updated.id ? record : item) : prev.filter((item) => item.id !== updated.id));
        window.alert("Erro ao salvar ponto. Tente novamente.");
        return;
      }
    }

    window.alert(`${action[1]} registrada as ${now}.`);
  }

  // ── Funcionários ─────────────────────────────────────────────────────────────

  async function saveEmployee(event) {
    event.preventDefault();
    if (!employeeForm.name || !employeeForm.document || !employeeForm.position) {
      window.alert("Informe nome, documento e cargo.");
      return;
    }

    const newEmail = buildEmployeeEmail(employeeForm.name);
    const newPin = employeeForm.document.replace(/\D/g, "").slice(-6) || "123456";
    const expectedMinutes = scheduleToMinutes(employeeForm);

    if (!isConfigured) {
      const employeeId = `emp-${Date.now()}`;
      setEmployees([{
        id: employeeId,
        name: employeeForm.name.trim(),
        document: employeeForm.document.trim(),
        position: employeeForm.position.trim(),
        department: employeeForm.department.trim() || "Geral",
        admissionDate: employeeForm.admissionDate || todayIso(),
        expectedDailyMinutes: expectedMinutes,
        active: true
      }, ...employees]);
      setUsers([...users, { id: `user-${Date.now()}`, name: employeeForm.name.trim(), email: newEmail, pin: newPin, role: "employee", employeeId }]);
      setEmployeeForm(emptyEmployeeForm());
      window.alert(`Funcionario cadastrado.\nLogin: ${newEmail}\nPIN: ${newPin}`);
      return;
    }

    setSaving(true);
    try {
      // Guarda sessao do admin antes do signUp (que pode trocar a sessao)
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPin,
        options: { data: { full_name: employeeForm.name.trim(), role: "employee" } }
      });
      if (authError) throw authError;

      // Restaura sessao do admin para inserir o perfil com permissao correta
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token
        });
      }

      const userId = authData.user.id;

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        full_name: employeeForm.name.trim(),
        email: newEmail,
        role: "employee"
      }, { onConflict: "id" });
      if (profileError) throw profileError;

      const { data: empData, error: empError } = await supabase.from("employees").insert({
        profile_id: userId,
        full_name: employeeForm.name.trim(),
        document: employeeForm.document.trim(),
        position: employeeForm.position.trim(),
        department: employeeForm.department.trim() || "Geral",
        admission_date: employeeForm.admissionDate || todayIso(),
        expected_daily_minutes: expectedMinutes,
        active: true,
        entry_time: employeeForm.entryTime || null,
        exit_time: employeeForm.exitTime || null,
        lunch_out: employeeForm.lunchOut || null,
        lunch_in: employeeForm.lunchIn || null,
        salary: employeeForm.salary ? Number(employeeForm.salary.replace(",", ".")) : 0,
        va: employeeForm.va ? Number(employeeForm.va.replace(",", ".")) : 0,
        vt: employeeForm.vt ? Number(employeeForm.vt.replace(",", ".")) : 0
      }).select().single();
      if (empError) throw empError;

      setEmployees([mapEmployee(empData), ...employees]);
      setEmployeeForm(emptyEmployeeForm());
      window.alert(`Funcionario cadastrado!\nLogin: ${newEmail}\nPIN: ${newPin}`);
    } catch (err) {
      window.alert(`Erro ao cadastrar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEmployee(employeeId) {
    if (!window.confirm("Excluir este funcionario e todos os seus registros de ponto?")) return;
    const snapshot = employees.find((e) => e.id === employeeId);
    setEmployees((prev) => prev.filter((e) => e.id !== employeeId));
    if (isConfigured) {
      await supabase.from("time_records").delete().eq("employee_id", employeeId);
      const { error } = await supabase.from("employees").delete().eq("id", employeeId);
      if (error) {
        setEmployees((prev) => [snapshot, ...prev]);
        window.alert("Erro ao excluir funcionario.");
      }
    } else {
      setRecords((prev) => prev.filter((r) => r.employeeId !== employeeId));
    }
  }

  async function toggleEmployeeStatus(employeeId) {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;
    const newActive = !employee.active;

    setEmployees((prev) => prev.map((e) => e.id === employeeId ? { ...e, active: newActive } : e));

    if (isConfigured) {
      const { error } = await supabase.from("employees").update({ active: newActive }).eq("id", employeeId);
      if (error) {
        setEmployees((prev) => prev.map((e) => e.id === employeeId ? { ...e, active: !newActive } : e));
        window.alert("Erro ao atualizar status.");
      }
    }
  }

  // ── Ajustes ──────────────────────────────────────────────────────────────────

  async function saveAdjustment(event) {
    event.preventDefault();
    const invalid = ["clockIn", "lunchOut", "lunchIn", "clockOut"].find((field) => adjustment[field] && timeToMinutes(adjustment[field]) === null);
    if (invalid) { window.alert("Use horarios no formato HH:MM."); return; }

    const existing = records.find((r) => r.employeeId === adjustment.employeeId && r.date === adjustment.date);
    const next = {
      id: existing?.id ?? `rec-${Date.now()}`,
      employeeId: adjustment.employeeId,
      date: adjustment.date,
      clockIn: adjustment.clockIn || undefined,
      lunchOut: adjustment.lunchOut || undefined,
      lunchIn: adjustment.lunchIn || undefined,
      clockOut: adjustment.clockOut || undefined,
      notes: adjustment.notes || undefined,
      adjustedBy: currentUser.name
    };

    setRecords([next, ...records.filter((r) => r.id !== next.id)]);

    if (isConfigured) {
      const { error } = await supabase.from("time_records").upsert({
        employee_id: adjustment.employeeId,
        work_date: adjustment.date,
        clock_in: adjustment.clockIn || null,
        lunch_out: adjustment.lunchOut || null,
        lunch_in: adjustment.lunchIn || null,
        clock_out: adjustment.clockOut || null,
        notes: adjustment.notes || null
      }, { onConflict: "employee_id,work_date" });

      if (error) { window.alert("Erro ao salvar ajuste."); return; }
    }

    window.alert("Ajuste salvo.");
  }

  function loadAdjustment(employeeId = adjustment.employeeId, date = adjustment.date) {
    const record = records.find((item) => item.employeeId === employeeId && item.date === date);
    setAdjustment({ employeeId, date, clockIn: record?.clockIn ?? "", lunchOut: record?.lunchOut ?? "", lunchIn: record?.lunchIn ?? "", clockOut: record?.clockOut ?? "", notes: record?.notes ?? "" });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="loading-screen">
        <Loader2 size={32} className="spin" />
        <p>Carregando...</p>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <Login
        email={email} pin={pin}
        setEmail={setEmail} setPin={setPin}
        login={login} users={isConfigured ? [] : users}
        quickLogin={quickLogin}
      />
    );
  }

  const tabs = isAdmin ? ["Painel", "Calendario", "Relatorios", "Funcionarios", "Ajustes"] : ["Ponto", "Calendario", "Meu mes"];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-area">
          <img src={brand.logo} alt={brand.company} />
          <div>
            <h1>Ponto Massari</h1>
            <p>{isAdmin ? "Gestao interna" : `Solicitado pela ${brand.accounting}`}</p>
          </div>
        </div>
        <div className="topbar-meta">
          <span>{isAdmin ? "Administrador" : currentEmployee?.name}</span>
          <small>{isConfigured ? brand.accounting : "Modo demo"}</small>
        </div>
        <button className="icon-button" onClick={logout} aria-label="Sair">
          <LogOut size={19} />
        </button>
      </header>

      <nav className="tabs">
        {tabs.map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </nav>

      <main>
        {isAdmin && tab === "Painel" && <Dashboard employees={employees} records={records} rows={monthRows} openReports={() => setTab("Relatorios")} />}
        {tab === "Calendario" && (
          <CalendarView employees={employees} records={records} month={month} setMonth={setMonth}
            employeeFilter={isAdmin ? employeeFilter : currentEmployee?.id}
            setEmployeeFilter={setEmployeeFilter} showEmployeeFilter={isAdmin} />
        )}
        {isAdmin && tab === "Relatorios" && (
          <Reports title="Relatorio mensal" rows={rows} employees={employees} month={month} setMonth={setMonth}
            employeeFilter={employeeFilter} setEmployeeFilter={setEmployeeFilter}
            csv={csv} generateCsv={() => setCsv(reportToCsv(rows))} showEmployeeFilter />
        )}
        {isAdmin && tab === "Funcionarios" && (
          <Employees employees={employees} users={users} form={employeeForm} setForm={setEmployeeForm}
            saveEmployee={saveEmployee} saving={saving} onToggleStatus={toggleEmployeeStatus} onDelete={deleteEmployee} />
        )}
        {isAdmin && tab === "Ajustes" && (
          <Adjustments employees={employees} records={records} form={adjustment} setForm={setAdjustment}
            saveAdjustment={saveAdjustment} loadAdjustment={loadAdjustment} />
        )}
        {!isAdmin && tab === "Ponto" && <Punch employee={currentEmployee} records={records} registerPunch={registerPunch} />}
        {!isAdmin && tab === "Meu mes" && (
          <Reports title="Meu mes" rows={rows} employees={employees} month={month} setMonth={setMonth}
            csv={csv} generateCsv={() => setCsv(reportToCsv(rows))} />
        )}
      </main>
    </div>
  );
}

// ─── UI Components ────────────────────────────────────────────────────────────

function Login({ email, pin, setEmail, setPin, login, users, quickLogin }) {
  const motivation = getDailyMotivation(todayIso());
  return (
    <main className="login-page">
      <section className="login-hero">
        <img className="login-logo" src={brand.logo} alt={brand.company} />
        <div>
          <h1>Ponto Massari</h1>
          <p>Controle de entrada, saida e intervalo de almoco.</p>
          <span className="accounting-badge">
            <Building2 size={15} /> Solicitado pela {brand.accounting}
          </span>
        </div>
      </section>

      <section className="motivation-strip">
        <CalendarCheck size={20} />
        <div>
          <strong>{motivation.title}</strong>
          <span>{motivation.text}</span>
        </div>
      </section>

      <section className="panel">
        <h2>Acesso</h2>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>PIN / Senha<input value={pin} onChange={(e) => setPin(e.target.value)} type="password" /></label>
        <button className="primary" onClick={login}><LogIn size={18} /> Entrar</button>
      </section>

      {users.length > 0 && (
        <section>
          <h2>Perfis de teste</h2>
          <div className="quick-grid">
            {users.slice(0, 3).map((user) => (
              <button className="quick-card" key={user.id} onClick={() => quickLogin(user)}>
                {user.role === "admin" ? <ShieldCheck size={21} /> : <Users size={21} />}
                <span>
                  <strong>{user.name}</strong>
                  <small>{user.email} | PIN {user.pin}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Dashboard({ employees, records, rows, openReports }) {
  const todayRecords = records.filter((r) => r.date === todayIso());
  const present = new Set(todayRecords.filter((r) => r.clockIn).map((r) => r.employeeId)).size;
  const onLunch = todayRecords.filter((r) => r.lunchOut && !r.lunchIn).length;
  const pendingExit = todayRecords.filter((r) => r.clockIn && !r.clockOut).length;
  const monthBalance = rows.reduce((sum, row) => sum + row.balanceMinutes, 0);
  return (
    <>
      <h2>Painel de hoje</h2>
      <div className="metric-grid">
        <Metric icon={Users} label="Ativos" value={employees.filter((e) => e.active).length} tone="blue" />
        <Metric icon={CheckCircle2} label="Presentes" value={present} tone="green" />
        <Metric icon={Clock} label="Em almoco" value={onLunch} tone="amber" />
        <Metric icon={AlertCircle} label="Saida pendente" value={pendingExit} tone="red" />
      </div>
      <section className="summary-band">
        <div>
          <small>Saldo do mes</small>
          <strong className={monthBalance < 0 ? "negative" : ""}>{minutesToTime(monthBalance)}</strong>
        </div>
        <button className="secondary" onClick={openReports}><CalendarDays size={18} /> Relatorio</button>
      </section>
      <h2>Registros de hoje</h2>
      {todayRecords.length === 0 ? <Empty text="Nenhum ponto registrado hoje." /> : todayRecords.map((r) => <RecordCard key={r.id} record={r} employees={employees} />)}
    </>
  );
}

function Punch({ employee, records, registerPunch }) {
  const record = records.find((item) => item.employeeId === employee.id && item.date === todayIso());
  const next = getNextAction(record);
  const empRows = buildReportRows(records, [employee], currentMonthIso(), employee.id);
  const total = empRows.reduce((sum, row) => sum + row.workedMinutes, 0);
  const balance = empRows.reduce((sum, row) => sum + row.balanceMinutes, 0);
  const motivation = getDailyMotivation(todayIso());
  const nonWorkingToday = isWeekend(todayIso()) || getHoliday(todayIso());
  return (
    <>
      <section className="motivation-strip">
        <CalendarCheck size={20} />
        <div><strong>{motivation.title}</strong><span>{motivation.text}</span></div>
      </section>
      <section className="accounting-strip">
        <Building2 size={20} />
        <div>
          <strong>{brand.accounting}</strong>
          <span>Esta contabilidade solicitou o controle e acompanha o fechamento do ponto.</span>
        </div>
      </section>
      <section className="clock-panel">
        <span>{formatDayName(todayIso())}, {formatDate(todayIso())}</span>
        <strong>{currentTime()}</strong>
        <p>{nonWorkingToday ? "Dia sem expediente" : next ? next[1] : "Jornada completa"}</p>
        <button className="primary" onClick={registerPunch} disabled={nonWorkingToday}>
          <Fingerprint size={18} /> {nonWorkingToday ? "Registro indisponivel" : next ? `Registrar ${next[1]}` : "Ponto completo"}
        </button>
      </section>
      <div className="metric-grid">
        <Metric icon={CalendarDays} label="Mes" value={minutesToTime(total)} tone="blue" />
        <Metric icon={Clock} label="Saldo" value={minutesToTime(balance)} tone={balance < 0 ? "red" : "green"} />
      </div>
      <h2>Hoje</h2>
      <PunchTimeline record={record} />
    </>
  );
}

function Reports({ title, rows, employees, month, setMonth, employeeFilter = "all", setEmployeeFilter, csv, generateCsv, showEmployeeFilter }) {
  const totalWorked = rows.reduce((sum, row) => sum + row.workedMinutes, 0);
  const totalExpected = rows.reduce((sum, row) => sum + row.expectedMinutes, 0);
  const balance = totalWorked - totalExpected;
  const pending = rows.filter((row) => row.missing.length).length;
  return (
    <>
      <h2>{title}</h2>
      <div className="filters">
        <label>Mes<input value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        {showEmployeeFilter && (
          <label>
            Funcionario
            <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
              <option value="all">Todos</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
        )}
      </div>
      <section className="summary-band">
        <div><small>{monthLabel(month)}</small><strong>{minutesToTime(totalWorked)}</strong></div>
        <div className="right">
          <span>Previsto {minutesToTime(totalExpected)}</span>
          <b className={balance < 0 ? "negative" : ""}>Saldo {minutesToTime(balance)}</b>
        </div>
      </section>
      <div className="metric-grid">
        <Metric icon={CalendarDays} label="Dias" value={rows.length} tone="blue" />
        <Metric icon={AlertCircle} label="Pendencias" value={pending} tone={pending ? "amber" : "green"} />
      </div>
      <button className="secondary" onClick={generateCsv}><Download size={18} /> Gerar CSV</button>
      {csv && <pre className="csv-box">{csv}</pre>}
      <h2>Dias do mes</h2>
      {rows.length === 0 ? <Empty text="Nenhum registro encontrado." /> : rows.map((row) => <ReportCard key={row.record.id} row={row} />)}
    </>
  );
}

function CalendarView({ employees, records, month, setMonth, employeeFilter = "all", setEmployeeFilter, showEmployeeFilter }) {
  const cells = buildCalendarCells(month);
  const selectedEmployees = employeeFilter === "all" ? employees.filter((e) => e.active) : employees.filter((e) => e.id === employeeFilter);
  return (
    <>
      <h2>Calendario</h2>
      <div className="filters">
        <label>Mes<input value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        {showEmployeeFilter && (
          <label>
            Funcionario
            <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
              <option value="all">Todos</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
        )}
      </div>
      <section className="calendar-note">
        <CalendarCheck size={20} />
        <div><strong>{monthLabel(month)}</strong><span>Feriados e fins de semana ficam marcados como sem expediente.</span></div>
      </section>
      <div className="calendar-weekdays">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="calendar-grid">
        {cells.map((date, i) => {
          if (!date) return <div className="calendar-cell empty-cell" key={`empty-${i}`} />;
          const holiday = getHoliday(date);
          const weekend = isWeekend(date);
          const dayRecords = records.filter((r) => r.date === date && selectedEmployees.some((e) => e.id === r.employeeId));
          const pending = holiday || weekend ? 0 : dayRecords.filter((r) => missingMarks(r).length > 0).length;
          const cls = ["calendar-cell", holiday ? "holiday" : "", weekend && !holiday ? "weekend" : "", dayRecords.length ? "has-record" : ""].filter(Boolean).join(" ");
          const title = holiday?.name ?? (weekend ? "Fim de semana" : dayRecords.length ? "Com registro" : "Sem registro");
          return (
            <article className={cls} key={date}>
              <div className="calendar-day-head">
                <strong>{Number(date.slice(8, 10))}</strong>
                <span>{title}</span>
              </div>
              {dayRecords.length > 0 && <small>{dayRecords.length} registro{dayRecords.length > 1 ? "s" : ""}{pending ? `, ${pending} pendente` : ""}</small>}
              {employeeFilter !== "all" && dayRecords[0] && <PunchMini record={dayRecords[0]} />}
            </article>
          );
        })}
      </div>
    </>
  );
}

function formatBRL(value) {
  if (!value && value !== 0) return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function EmployeeScheduleInfo({ employee }) {
  const hasSchedule = employee.entryTime || employee.exitTime;
  if (!hasSchedule) return null;
  const parts = [];
  if (employee.entryTime) parts.push(`Entrada ${employee.entryTime}`);
  if (employee.lunchOut && employee.lunchIn) parts.push(`Almoco ${employee.lunchOut}–${employee.lunchIn}`);
  if (employee.exitTime) parts.push(`Saida ${employee.exitTime}`);
  return (
    <p style={{ fontSize: "13px" }}>
      ⏰ {parts.join(" | ")} — <strong style={{ color: "var(--ink)" }}>{minutesToTime(employee.expectedDailyMinutes)}/dia</strong>
    </p>
  );
}

function Employees({ employees, users, form, setForm, saveEmployee, saving, onToggleStatus, onDelete }) {
  return (
    <>
      <h2>Novo funcionario</h2>
      <form className="panel" onSubmit={saveEmployee}>
        <p style={{ color: "var(--muted)", fontSize: "13px", margin: "-4px 0 4px" }}>Dados pessoais</p>
        <div className="form-grid">
          <Field label="Nome completo" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Field label="CPF ou documento" value={form.document} onChange={(document) => setForm({ ...form, document })} />
          <Field label="Cargo" value={form.position} onChange={(position) => setForm({ ...form, position })} />
          <Field label="Setor / Departamento" value={form.department} onChange={(department) => setForm({ ...form, department })} />
          <Field label="Data de admissao" value={form.admissionDate} onChange={(admissionDate) => setForm({ ...form, admissionDate })} />
        </div>

        <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "8px" }}>Horario de trabalho</p>
        <div className="form-grid">
          <Field label="Entrada (ex: 08:30)" value={form.entryTime} onChange={(entryTime) => setForm({ ...form, entryTime })} />
          <Field label="Saida (ex: 17:45)" value={form.exitTime} onChange={(exitTime) => setForm({ ...form, exitTime })} />
          <Field label="Saida almoco (ex: 12:00)" value={form.lunchOut} onChange={(lunchOut) => setForm({ ...form, lunchOut })} />
          <Field label="Volta almoco (ex: 13:00)" value={form.lunchIn} onChange={(lunchIn) => setForm({ ...form, lunchIn })} />
        </div>

        <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "8px" }}>Remuneracao mensal</p>
        <div className="form-grid">
          <Field label="Salario (R$)" value={form.salary} onChange={(salary) => setForm({ ...form, salary })} />
          <Field label="Vale alimentacao — VA (R$)" value={form.va} onChange={(va) => setForm({ ...form, va })} />
          <Field label="Vale transporte — VT (R$)" value={form.vt} onChange={(vt) => setForm({ ...form, vt })} />
        </div>

        <button className="primary full" disabled={saving} style={{ marginTop: "4px" }}>
          {saving ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}
          {saving ? "Cadastrando..." : "Cadastrar funcionario"}
        </button>
      </form>

      <h2>Funcionarios</h2>
      <div className="cards">
        {employees.map((employee) => {
          const user = users.find((item) => item.employeeId === employee.id);
          const loginEmail = user ? user.email : (isConfigured ? buildEmployeeEmail(employee.name) : null);
          const loginPin = user ? user.pin : null;
          return (
            <article className="card" key={employee.id}>
              <div className="card-head">
                <div>
                  <h3>{employee.name}</h3>
                  <p>{employee.position}{employee.department ? ` | ${employee.department}` : ""}</p>
                </div>
                <Pill tone={employee.active ? "green" : "red"}>{employee.active ? "Ativo" : "Inativo"}</Pill>
              </div>

              <div style={{ display: "grid", gap: "4px" }}>
                <EmployeeScheduleInfo employee={employee} />
                {employee.admissionDate && (
                  <p style={{ fontSize: "13px" }}>📅 Admissao: <strong style={{ color: "var(--ink)" }}>{formatDate(employee.admissionDate)}</strong></p>
                )}
                {(employee.salary > 0 || employee.va > 0 || employee.vt > 0) && (
                  <p style={{ fontSize: "13px" }}>
                    💰 Salario: <strong style={{ color: "var(--ink)" }}>{formatBRL(employee.salary)}</strong>
                    {employee.va > 0 && <> | VA: <strong style={{ color: "var(--ink)" }}>{formatBRL(employee.va)}</strong></>}
                    {employee.vt > 0 && <> | VT: <strong style={{ color: "var(--ink)" }}>{formatBRL(employee.vt)}</strong></>}
                  </p>
                )}
                {loginEmail && (
                  <p style={{ fontSize: "13px" }}>🔑 Login: <strong style={{ color: "var(--ink)" }}>{loginEmail}</strong>{loginPin ? ` | PIN: ${loginPin}` : ""}</p>
                )}
              </div>

              <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                <button className="secondary" onClick={() => onToggleStatus(employee.id)}>
                  {employee.active ? <PauseCircle size={18} /> : <PlayCircle size={18} />} {employee.active ? "Inativar" : "Ativar"}
                </button>
                <button className="secondary" style={{ color: "#dc2626" }} onClick={() => onDelete(employee.id)}>
                  <Trash2 size={18} /> Excluir
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function Adjustments({ employees, records, form, setForm, saveAdjustment, loadAdjustment }) {
  const recent = [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  return (
    <>
      <h2>Ajustar ponto</h2>
      <form className="panel form-grid" onSubmit={saveAdjustment}>
        <label>
          Funcionario
          <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <Field label="Data" value={form.date} onChange={(date) => setForm({ ...form, date })} />
        <button type="button" className="secondary full" onClick={() => loadAdjustment()}><Edit3 size={18} /> Carregar dia</button>
        <Field label="Entrada" value={form.clockIn} onChange={(clockIn) => setForm({ ...form, clockIn })} />
        <Field label="Saida almoco" value={form.lunchOut} onChange={(lunchOut) => setForm({ ...form, lunchOut })} />
        <Field label="Volta almoco" value={form.lunchIn} onChange={(lunchIn) => setForm({ ...form, lunchIn })} />
        <Field label="Saida" value={form.clockOut} onChange={(clockOut) => setForm({ ...form, clockOut })} />
        <label className="full">Observacao<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <button className="primary full"><Save size={18} /> Salvar ajuste</button>
      </form>
      <h2>Ultimos registros</h2>
      {recent.map((record) => (
        <article className="card" key={record.id}>
          <RecordCard record={record} employees={employees} />
          <button className="secondary" onClick={() => loadAdjustment(record.employeeId, record.date)}><Edit3 size={18} /> Editar</button>
        </article>
      ))}
    </>
  );
}

function RecordCard({ record, employees }) {
  const employee = employees.find((item) => item.id === record.employeeId);
  return (
    <article className="card">
      <div className="card-head">
        <div><h3>{employee?.name ?? "Funcionario"}</h3><p>{formatDayName(record.date)}, {formatDate(record.date)}</p></div>
        {record.adjustedBy && <Pill tone="amber">Ajustado</Pill>}
      </div>
      <PunchGrid record={record} />
      {record.notes && <p>{record.notes}</p>}
    </article>
  );
}

function ReportCard({ row }) {
  const dayLabel = row.holidayName ?? (row.nonWorking ? "Fim de semana" : null);
  return (
    <article className="card">
      <div className="card-head">
        <div>
          <h3>{formatDate(row.record.date)} | {row.employee.name}</h3>
          <p>{formatDayName(row.record.date)} | Almoco {minutesToTime(row.lunchMinutes)}</p>
        </div>
        <Pill tone={dayLabel ? "blue" : row.missing.length ? "amber" : "green"}>{dayLabel ?? (row.missing.length ? "Pendente" : "OK")}</Pill>
      </div>
      <PunchGrid record={row.record} />
      <div className="row-between">
        <span>Trabalhado {minutesToTime(row.workedMinutes)}</span>
        <b className={row.balanceMinutes < 0 ? "negative" : ""}>Saldo {minutesToTime(row.balanceMinutes)}</b>
      </div>
      {row.missing.length > 0 && <p className="warning">Falta: {row.missing.join(", ")}</p>}
    </article>
  );
}

function PunchTimeline({ record }) {
  return (
    <section className="timeline">
      {punchActions.map(([field, label]) => (
        <div className="timeline-row" key={field}>
          <span className={record?.[field] ? "dot done" : "dot"}>{record?.[field] ? "OK" : ""}</span>
          <div><b>{label}</b><strong>{record?.[field] ?? "--:--"}</strong></div>
        </div>
      ))}
    </section>
  );
}

function PunchGrid({ record }) {
  return (
    <div className="punch-grid">
      {punchActions.map(([field, label]) => (
        <div key={field}><small>{label}</small><strong>{record[field] ?? "--:--"}</strong></div>
      ))}
    </div>
  );
}

function PunchMini({ record }) {
  return (
    <div className="punch-mini">
      {punchActions.map(([field, label]) => <span key={field}>{label.split(" ")[0]} {record[field] ?? "--:--"}</span>)}
    </div>
  );
}

function Field({ label, value, onChange }) {
  return <label>{label}<input value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function Metric({ icon: Icon, label, value, tone }) {
  return (
    <article className={`metric ${tone}`}>
      <Icon size={22} /><strong>{value}</strong><span>{label}</span>
    </article>
  );
}

function Pill({ tone, children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function Empty({ text }) {
  return <section className="empty">{text}</section>;
}

// ─── Pure functions ───────────────────────────────────────────────────────────

function pad(v) { return String(v).padStart(2, "0"); }

function todayIso(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return todayIso(d);
}

function currentMonthIso(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function currentTime(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatDayName(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"][new Date(y, m - 1, d).getDay()];
}

function isWeekend(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

function monthLabel(monthIso) {
  const [y, m] = monthIso.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function buildCalendarCells(monthIso) {
  const [y, m] = monthIso.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const cells = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= last.getDate(); day++) cells.push(todayIso(new Date(y, m - 1, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getHoliday(iso) {
  const [y] = iso.split("-").map(Number);
  return getBrazilHolidays(y).find((h) => h.date === iso) ?? null;
}

function getBrazilHolidays(year) {
  const easter = easterDate(year);
  return [
    { date: `${year}-01-01`, name: "Confraternizacao" },
    { date: addDaysToIso(easter, -48), name: "Carnaval" },
    { date: addDaysToIso(easter, -47), name: "Carnaval" },
    { date: addDaysToIso(easter, -2), name: "Sexta-feira Santa" },
    { date: todayIso(easter), name: "Pascoa" },
    { date: `${year}-04-21`, name: "Tiradentes" },
    { date: `${year}-05-01`, name: "Dia do Trabalho" },
    { date: addDaysToIso(easter, 60), name: "Corpus Christi" },
    { date: `${year}-09-07`, name: "Independencia" },
    { date: `${year}-10-12`, name: "Nossa Senhora Aparecida" },
    { date: `${year}-11-02`, name: "Finados" },
    { date: `${year}-11-15`, name: "Proclamacao da Republica" },
    { date: `${year}-12-25`, name: "Natal" }
  ];
}

function easterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m2 = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m2 + 114) / 31);
  const day = ((h + l - 7 * m2 + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDaysToIso(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return todayIso(next);
}

function getDailyMotivation(iso) {
  const holiday = getHoliday(iso);
  if (holiday) return { title: holiday.name, text: "Hoje e feriado. Aproveite o descanso e retorne no proximo dia util." };
  if (isWeekend(iso)) return { title: "Fim de semana", text: "Sabado e domingo sao dias sem expediente. Bom descanso." };
  const [y, m, d] = iso.split("-").map(Number);
  return { title: "Mensagem do dia", text: dailyMotivation[(y + m * 31 + d) % dailyMotivation.length] };
}

function timeToMinutes(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [h, min] = time.split(":").map(Number);
  return h * 60 + min;
}

function minutesToTime(minutes) {
  const sign = minutes < 0 ? "-" : "";
  const total = Math.abs(minutes);
  return `${sign}${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function decimalHoursToMinutes(value) {
  const h = Number(String(value).replace(",", "."));
  return Number.isFinite(h) && h > 0 ? Math.round(h * 60) : 480;
}

function workedMinutes(record) {
  const clockIn = timeToMinutes(record.clockIn);
  const clockOut = timeToMinutes(record.clockOut);
  if (clockIn === null || clockOut === null || clockOut <= clockIn) return 0;
  const lunchOut = timeToMinutes(record.lunchOut);
  const lunchIn = timeToMinutes(record.lunchIn);
  const lunch = lunchOut !== null && lunchIn !== null && lunchIn > lunchOut ? lunchIn - lunchOut : 0;
  return Math.max(0, clockOut - clockIn - lunch);
}

function lunchMinutes(record) {
  const lo = timeToMinutes(record.lunchOut), li = timeToMinutes(record.lunchIn);
  return lo !== null && li !== null && li > lo ? li - lo : 0;
}

function missingMarks(record) {
  return punchActions.filter(([field]) => !record[field]).map(([, label]) => label);
}

function buildReportRows(records, employees, month, employeeId) {
  return records
    .filter((r) => r.date.startsWith(month))
    .filter((r) => employeeId === "all" || r.employeeId === employeeId)
    .map((record) => {
      const employee = employees.find((e) => e.id === record.employeeId);
      if (!employee) return null;
      const worked = workedMinutes(record);
      const holiday = getHoliday(record.date);
      const nonWorking = Boolean(holiday) || isWeekend(record.date);
      const expected = nonWorking ? 0 : employee.expectedDailyMinutes;
      return {
        record, employee,
        workedMinutes: worked,
        lunchMinutes: lunchMinutes(record),
        expectedMinutes: expected,
        balanceMinutes: worked - expected,
        missing: nonWorking ? [] : missingMarks(record),
        nonWorking,
        holidayName: holiday?.name
      };
    })
    .filter(Boolean)
    .sort((a, b) => `${a.record.date}-${a.employee.name}`.localeCompare(`${b.record.date}-${b.employee.name}`));
}

function reportToCsv(rows) {
  const header = ["Data", "Funcionario", "Situacao", "Entrada", "Saida almoco", "Volta almoco", "Saida", "Almoco", "Trabalhado", "Saldo", "Pendencias"];
  const lines = rows.map((row) =>
    [
      formatDate(row.record.date), row.employee.name,
      row.holidayName ?? (row.nonWorking ? "Fim de semana" : row.missing.length ? "Pendente" : "OK"),
      row.record.clockIn ?? "", row.record.lunchOut ?? "", row.record.lunchIn ?? "", row.record.clockOut ?? "",
      minutesToTime(row.lunchMinutes), minutesToTime(row.workedMinutes), minutesToTime(row.balanceMinutes),
      row.missing.join(" | ")
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")
  );
  return [header.join(";"), ...lines].join("\n");
}

function getNextAction(record) {
  return punchActions.find(([field]) => !record?.[field]) ?? null;
}

function scheduleToMinutes(form) {
  const entry = timeToMinutes(form.entryTime);
  const exit = timeToMinutes(form.exitTime);
  const lo = timeToMinutes(form.lunchOut);
  const li = timeToMinutes(form.lunchIn);
  if (!entry || !exit || exit <= entry) return 480;
  const lunch = (lo && li && li > lo) ? li - lo : 0;
  return Math.max(0, exit - entry - lunch);
}

function emptyEmployeeForm() {
  return { name: "", document: "", position: "", department: "", admissionDate: todayIso(), entryTime: "08:30", exitTime: "17:45", lunchOut: "12:00", lunchIn: "13:00", salary: "", va: "", vt: "" };
}

function emptyAdjustment(employeeId) {
  return { employeeId, date: todayIso(), clockIn: "", lunchOut: "", lunchIn: "", clockOut: "", notes: "" };
}

function buildEmployeeEmail(name) {
  const slug = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "");
  return `${slug || "funcionario"}@ponto.local`;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")).render(<App />);
