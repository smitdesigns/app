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
import { Plus, Inbox, Factory, Droplet, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

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

function Dashboard() {
  const powders = usePowders();
  const tasks = useTodayTasks();

  useEffect(() => {
    powders.fetchAll();
    tasks.fetchAll();
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard icon={Inbox} label="Total SKUs" value={powders.summary.total_skus} />
          <StatCard icon={Factory} label="Total Stock" value={powders.summary.total_stock_kg} suffix="kg" />
          <StatCard icon={Droplet} label="Low Stock Items" value={powders.summary.low_stock_count} />
        </div>

        <Tabs defaultValue="inventory" className="w-full">
          <TabsList>
            <TabsTrigger value="inventory">Powder Inventory</TabsTrigger>
            <TabsTrigger value="tasks">Today's Tasks</TabsTrigger>
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