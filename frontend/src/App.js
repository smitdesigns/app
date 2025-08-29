import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import axios from "axios";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { Badge } from "./components/ui/badge";
import { Checkbox } from "./components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { Calendar } from "./components/ui/calendar";
import { Plus, Inbox, Factory, Droplet, ArrowDownToLine, ArrowUpFromLine, Flame } from "lucide-react";
import { format, parseISO } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

function usePowders() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total_skus: 0, total_stock_kg: 0, low_stock_count: 0 });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [listRes, sumRes] = await Promise.all([
        api.get("/powders"),
        api.get("/powders/summary"),
      ]);
      setItems(listRes.data);
      setSummary(sumRes.data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load powders");
    } finally {
      setLoading(false);
    }
  };

  const addPowder = async (payload) => {
    const res = await api.post("/powders", payload);
    toast.success("Powder added");
    await fetchAll();
    return res.data;
  };

  const transact = async (powderId, payload) => {
    await api.post(`/powders/${powderId}/transactions`, payload);
    toast.success(payload.type === "receive" ? "Stock received" : "Stock consumed");
    await fetchAll();
  };

  const updatePowder = async (powderId, payload) => {
    await api.patch(`/powders/${powderId}`, payload);
    toast.success("Powder updated");
    await fetchAll();
  };

  return { loading, items, summary, fetchAll, addPowder, transact, updatePowder };
}

function useTodayTasks() {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await api.get("/tasks/today");
      setTasks(res.data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (payload) => {
    const res = await api.post("/tasks", payload);
    toast.success("Task added for today");
    await fetchAll();
    return res.data;
  };

  const updateTask = async (id, payload) => {
    const res = await api.patch(`/tasks/${id}`, payload);
    await fetchAll();
    return res.data;
  };

  return { loading, tasks, fetchAll, addTask, updateTask };
}

// Gas usage hook
function useGas() {
  const [loading, setLoading] = useState(false);
  const [today, setToday] = useState({ total_qty_kg: 0, total_cost: 0, baseline_avg_kg: 0, alert: false });
  const [trendDays, setTrendDays] = useState(14);
  const [trend, setTrend] = useState({ days: 14, points: [] });
  const [logs, setLogs] = useState([]);

  const fetchAll = async (days = trendDays) => {
    setLoading(true);
    try {
      const [sum, tr, lg] = await Promise.all([
        api.get("/gas/summary/today"),
        api.get(`/gas/trend?days=${days}`),
        api.get("/gas/logs?limit=200"),
      ]);
      setToday(sum.data);
      setTrend(tr.data);
      setLogs(lg.data);
      setTrendDays(days);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load gas data");
    } finally {
      setLoading(false);
    }
  };

  const addLog = async (payload) => {
    const res = await api.post("/gas/logs", payload);
    toast.success("Gas log added");
    await fetchAll(trendDays);
    return res.data;
  };

  return { loading, today, trendDays, trend, logs, setTrendDays, fetchAll, addLog };
}

function StatCard({ icon: Icon, label, value, suffix }) {
  return (
    <Card className="card-glass border rounded-2xl shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
          <Icon size={22} />
        </div>
        <div>
          <div className="stat-value text-2xl font-semibold">{value}{suffix ? ` ${suffix}` : ""}</div>
          <div className="stat-label text-sm">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function AddPowderDialog({ onSubmit }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", color: "", supplier: "", current_stock_kg: "", safety_stock_kg: "", cost_per_kg: "" });

  const handle = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.name) { toast.error("Name required"); return; }
    await onSubmit({
      name: form.name,
      color: form.color || undefined,
      supplier: form.supplier || undefined,
      current_stock_kg: parseFloat(form.current_stock_kg || 0),
      safety_stock_kg: parseFloat(form.safety_stock_kg || 0),
      cost_per_kg: form.cost_per_kg ? parseFloat(form.cost_per_kg) : undefined,
    });
    setOpen(false);
    setForm({ name: "", color: "", supplier: "", current_stock_kg: "", safety_stock_kg: "", cost_per_kg: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="btn-primary px-4 py-2 text-sm"><Plus size={16} className="mr-2"/>Add Powder</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add new powder</DialogTitle>
          <DialogDescription>Track by kg. You can adjust later.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={e => handle("name", e.target.value)} placeholder="Eg. RAL 9016 White" />
          </div>
          <div>
            <Label>Color</Label>
            <Input value={form.color} onChange={e => handle("color", e.target.value)} placeholder="Eg. White" />
          </div>
          <div>
            <Label>Supplier</Label>
            <Input value={form.supplier} onChange={e => handle("supplier", e.target.value)} placeholder="Eg. AkzoNobel" />
          </div>
          <div>
            <Label>Current Stock (kg)</Label>
            <Input type="number" value={form.current_stock_kg} onChange={e => handle("current_stock_kg", e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Safety Stock (kg)</Label>
            <Input type="number" value={form.safety_stock_kg} onChange={e => handle("safety_stock_kg", e.target.value)} placeholder="0" />
          </div>
          <div className="col-span-2">
            <Label>Cost per kg (optional)</Label>
            <Input type="number" value={form.cost_per_kg} onChange={e => handle("cost_per_kg", e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="btn-primary" onClick={submit}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StockActionDialog({ powder, onSubmit, type }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const isReceive = type === "receive";

  const submit = async () => {
    const val = parseFloat(qty || 0);
    if (!val || val <= 0) { toast.error("Enter a positive qty"); return; }
    await onSubmit(powder.id, { type, quantity_kg: val, note });
    setOpen(false);
    setQty(""); setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isReceive ? (
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"><ArrowDownToLine size={14} className="mr-2"/>Receive</Button>
        ) : (
          <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white"><ArrowUpFromLine size={14} className="mr-2"/>Consume</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isReceive ? "Receive stock" : "Consume stock"}</DialogTitle>
          <DialogDescription>Powder: {powder.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Quantity (kg)</Label>
            <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Batch details, job #, etc" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="btn-primary" onClick={submit}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddTaskDialog({ onSubmit }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assignee: "" });
  const handle = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.title) { toast.error("Title required"); return; }
    await onSubmit({ title: form.title, description: form.description || undefined, assignee: form.assignee || undefined });
    setOpen(false); setForm({ title: "", description: "", assignee: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="btn-primary px-4 py-2 text-sm"><Plus size={16} className="mr-2"/>Add Task</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add task for today</DialogTitle>
          <DialogDescription>Quickly capture what's happening today.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={e => handle("title", e.target.value)} placeholder="Eg. Coat batch #1023 in RAL 9005" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => handle("description", e.target.value)} placeholder="Notes, specs, prep steps" />
          </div>
          <div>
            <Label>Assignee (optional)</Label>
            <Input value={form.assignee} onChange={e => handle("assignee", e.target.value)} placeholder="Operator's name" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="btn-primary" onClick={submit}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Gas: Add Log Dialog
function AddGasLogDialog({ onSubmit }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date());
  const [fuel, setFuel] = useState("LPG");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");

  const submit = async () => {
    const q = parseFloat(qty || 0);
    if (!q || q <= 0) { toast.error("Enter quantity in kg"); return; }
    await onSubmit({
      date: date.toISOString().slice(0,10),
      fuel_type: fuel,
      quantity_kg: q,
      unit_cost: unitCost ? parseFloat(unitCost) : undefined,
      note: note || undefined,
    });
    setOpen(false);
    setQty(""); setUnitCost(""); setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="btn-primary px-4 py-2 text-sm"><Plus size={16} className="mr-2"/>Add Gas Log</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add gas usage</DialogTitle>
          <DialogDescription>Daily LPG/Natural Gas usage in kilograms</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  {format(date, "EEE, dd MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={setDate} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Fuel</Label>
            <Select value={fuel} onValueChange={v => setFuel(v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LPG">LPG</SelectItem>
                <SelectItem value="Natural Gas">Natural Gas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantity (kg)</Label>
            <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Unit Cost (optional)</Label>
            <Input type="number" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="0" />
          </div>
          <div className="col-span-2">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Remarks, meter reading, vendor" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="btn-primary" onClick={submit}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simple SVG sparkline
function Sparkline({ points, height = 56, color = "#f97316" }) {
  if (!points || points.length === 0) return <div className="h-14" />;
  const w = Math.max(points.length - 1, 1) * 20; // 20px per day
  const max = Math.max(...points.map(p => p.qty_kg), 1);
  const path = points.map((p, i) => {
    const x = i * 20;
    const y = height - (p.qty_kg / max) * height;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(" ");
  return (
    <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function Dashboard() {
  const powders = usePowders();
  const tasks = useTodayTasks();
  const gas = useGas();

  useEffect(() => {
    powders.fetchAll();
    tasks.fetchAll();
    gas.fetchAll(14);
  }, []);

  const today = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }), []);

  return (
    <div className="app-shell">
      <div className="navbar px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-orange-600" />
          <div className="brand-badge text-sm">METAMORPH <span className="brand-dot">METALS</span></div>
        </div>
        <div className="text-sm text-slate-600">{today}</div>
      </div>

      <main className="px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={Inbox} label="Total SKUs" value={powders.summary.total_skus} />
          <StatCard icon={Factory} label="Total Stock" value={powders.summary.total_stock_kg} suffix="kg" />
          <StatCard icon={Droplet} label="Low Stock Items" value={powders.summary.low_stock_count} />
          <StatCard icon={Flame} label="Gas Today" value={gas.today.total_qty_kg?.toFixed ? gas.today.total_qty_kg.toFixed(1) : gas.today.total_qty_kg} suffix="kg" />
        </div>

        <Tabs defaultValue="inventory" className="w-full">
          <TabsList>
            <TabsTrigger value="inventory">Powder Inventory</TabsTrigger>
            <TabsTrigger value="tasks">Today's Tasks</TabsTrigger>
            <TabsTrigger value="gas">Gas Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            <Card className="card-glass border rounded-2xl">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Powders</CardTitle>
                  <CardDescription>Manage powder stock in kilograms</CardDescription>
                </div>
                <AddPowderDialog onSubmit={powders.addPowder} />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-header">
                        <TableHead>Name</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Stock (kg)</TableHead>
                        <TableHead className="text-right">Safety (kg)</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {powders.items.map(p => {
                        const low = (p.current_stock_kg || 0) < (p.safety_stock_kg || 0);
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell>{p.color || "-"}</TableCell>
                            <TableCell>{p.supplier || "-"}</TableCell>
                            <TableCell className="text-right">{p.current_stock_kg?.toFixed ? p.current_stock_kg.toFixed(2) : p.current_stock_kg}</TableCell>
                            <TableCell className="text-right">{p.safety_stock_kg?.toFixed ? p.safety_stock_kg.toFixed(2) : p.safety_stock_kg}</TableCell>
                            <TableCell className="space-x-2">
                              {low && <Badge variant="destructive">Low</Badge>}
                              <StockActionDialog powder={p} type="receive" onSubmit={powders.transact} />
                              <StockActionDialog powder={p} type="consume" onSubmit={powders.transact} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {powders.items.length === 0 && (
                    <div className="text-sm text-slate-500 py-8 text-center">No powders yet. Add your first powder to get started.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <Card className="card-glass border rounded-2xl">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Today's tasks</CardTitle>
                  <CardDescription>Keep the team aligned on what's happening</CardDescription>
                </div>
                <AddTaskDialog onSubmit={tasks.addTask} />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tasks.tasks.map(t => (
                    <div key={t.id} className="flex items-start justify-between rounded-xl border p-3"> 
                      <div className="flex items-start gap-3">
                        <Checkbox checked={t.status === 'done'} onCheckedChange={v => tasks.updateTask(t.id, { status: v ? 'done' : 'pending' })} />
                        <div>
                          <div className="font-medium">{t.title}</div>
                          {t.description && <div className="text-sm text-slate-500">{t.description}</div>}
                          <div className="text-xs text-slate-500 mt-1">{t.assignee ? `Assignee: ${t.assignee}` : 'Unassigned'}</div>
                        </div>
                      </div>
                      {t.status === 'done' && <Badge className="bg-emerald-600">Done</Badge>}
                    </div>
                  ))}
                  {tasks.tasks.length === 0 && (
                    <div className="text-sm text-slate-500 py-8 text-center">No tasks for today yet. Add your first task.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gas" className="space-y-4">
            <Card className="card-glass border rounded-2xl">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Gas Usage</CardTitle>
                  <CardDescription>Daily LPG/Natural Gas logs with trend and alerts</CardDescription>
                </div>
                <AddGasLogDialog onSubmit={gas.addLog} />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs text-slate-500">Today</div>
                      <div className="text-2xl font-semibold">{(gas.today.total_qty_kg || 0).toFixed ? gas.today.total_qty_kg.toFixed(1) : gas.today.total_qty_kg} kg</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs text-slate-500">Cost Today</div>
                      <div className="text-2xl font-semibold">₹{(gas.today.total_cost || 0).toFixed ? gas.today.total_cost.toFixed(0) : gas.today.total_cost}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs text-slate-500">7-day Avg</div>
                      <div className="text-2xl font-semibold">{(gas.today.baseline_avg_kg || 0).toFixed ? gas.today.baseline_avg_kg.toFixed(1) : gas.today.baseline_avg_kg} kg</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${gas.today.alert ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                      <div>
                        <div className="text-xs text-slate-500">Alert</div>
                        <div className="text-sm">{gas.today.alert ? 'Abnormal usage' : 'Normal'}</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">Last {gas.trendDays} days</div>
                  <Select value={String(gas.trendDays)} onValueChange={v => gas.fetchAll(parseInt(v))}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="overflow-x-auto">
                  <Sparkline points={gas.trend.points || []} />
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-header">
                        <TableHead>Date</TableHead>
                        <TableHead>Fuel</TableHead>
                        <TableHead className="text-right">Qty (kg)</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gas.logs.map(l => (
                        <TableRow key={l.id}>
                          <TableCell>{format(parseISO(`${l.date}T00:00:00Z`), 'dd MMM yyyy')}</TableCell>
                          <TableCell>{l.fuel_type}</TableCell>
                          <TableCell className="text-right">{(l.quantity_kg || 0).toFixed ? l.quantity_kg.toFixed(2) : l.quantity_kg}</TableCell>
                          <TableCell className="text-right">{l.unit_cost ?? '-'}</TableCell>
                          <TableCell className="text-right">{l.total_cost ?? '-'}</TableCell>
                          <TableCell className="max-w-[360px] truncate" title={l.note || ''}>{l.note || '-'}</TableCell>
                        </TableRow>
                      ))}
                      {gas.logs.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No gas logs yet. Add your first entry.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  );
}