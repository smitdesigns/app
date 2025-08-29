import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import axios from "axios";
import { BrowserRouter } from "react-router-dom";
import { Toaster, toast } from "sonner";
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
import { Plus, Inbox, Factory, Droplet, CheckCircle2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

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
    &lt;Card className="card-glass border rounded-2xl shadow-sm">
      &lt;CardContent className="p-5 flex items-center gap-4">
        &lt;div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
          &lt;Icon size={22} />
        &lt;/div>
        &lt;div>
          &lt;div className="stat-value text-2xl font-semibold">{value}{suffix ? ` ${suffix}` : ""}&lt;/div>
          &lt;div className="stat-label text-sm">{label}&lt;/div>
        &lt;/div>
      &lt;/CardContent>
    &lt;/Card>
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
    &lt;Dialog open={open} onOpenChange={setOpen}>
      &lt;DialogTrigger asChild>
        &lt;Button className="btn-primary px-4 py-2 text-sm">&lt;Plus size={16} className="mr-2"/>Add Powder&lt;/Button>
      &lt;/DialogTrigger>
      &lt;DialogContent className="sm:max-w-[520px]">
        &lt;DialogHeader>
          &lt;DialogTitle>Add new powder&lt;/DialogTitle>
          &lt;DialogDescription>Track by kg. You can adjust later.&lt;/DialogDescription>
        &lt;/DialogHeader>
        &lt;div className="grid grid-cols-2 gap-4">
          &lt;div className="col-span-2">
            &lt;Label>Name&lt;/Label>
            &lt;Input value={form.name} onChange={e =&gt; handle("name", e.target.value)} placeholder="Eg. RAL 9016 White" />
          &lt;/div>
          &lt;div>
            &lt;Label>Color&lt;/Label>
            &lt;Input value={form.color} onChange={e =&gt; handle("color", e.target.value)} placeholder="Eg. White" />
          &lt;/div>
          &lt;div>
            &lt;Label>Supplier&lt;/Label>
            &lt;Input value={form.supplier} onChange={e =&gt; handle("supplier", e.target.value)} placeholder="Eg. AkzoNobel" />
          &lt;/div>
          &lt;div>
            &lt;Label>Current Stock (kg)&lt;/Label>
            &lt;Input type="number" value={form.current_stock_kg} onChange={e =&gt; handle("current_stock_kg", e.target.value)} placeholder="0" />
          &lt;/div>
          &lt;div>
            &lt;Label>Safety Stock (kg)&lt;/Label>
            &lt;Input type="number" value={form.safety_stock_kg} onChange={e =&gt; handle("safety_stock_kg", e.target.value)} placeholder="0" />
          &lt;/div>
          &lt;div className="col-span-2">
            &lt;Label>Cost per kg (optional)&lt;/Label>
            &lt;Input type="number" value={form.cost_per_kg} onChange={e =&gt; handle("cost_per_kg", e.target.value)} placeholder="0" />
          &lt;/div>
        &lt;/div>
        &lt;div className="flex justify-end gap-3">
          &lt;Button variant="outline" onClick={() =&gt; setOpen(false)}>Cancel&lt;/Button>
          &lt;Button className="btn-primary" onClick={submit}>Save&lt;/Button>
        &lt;/div>
      &lt;/DialogContent>
    &lt;/Dialog>
  );
}

function StockActionDialog({ powder, onSubmit, type }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const isReceive = type === "receive";

  const submit = async () => {
    const val = parseFloat(qty || 0);
    if (!val || val &lt;= 0) { toast.error("Enter a positive qty"); return; }
    await onSubmit(powder.id, { type, quantity_kg: val, note });
    setOpen(false);
    setQty(""); setNote("");
  };

  return (
    &lt;Dialog open={open} onOpenChange={setOpen}>
      &lt;DialogTrigger asChild>
        {isReceive ? (
          &lt;Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">&lt;ArrowDownToLine size={14} className="mr-2"/>Receive&lt;/Button>
        ) : (
          &lt;Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white">&lt;ArrowUpFromLine size={14} className="mr-2"/>Consume&lt;/Button>
        )}
      &lt;/DialogTrigger>
      &lt;DialogContent className="sm:max-w-[420px]">
        &lt;DialogHeader>
          &lt;DialogTitle>{isReceive ? "Receive stock" : "Consume stock"}&lt;/DialogTitle>
          &lt;DialogDescription>Powder: {powder.name}&lt;/DialogDescription>
        &lt;/DialogHeader>
        &lt;div className="space-y-3">
          &lt;div>
            &lt;Label>Quantity (kg)&lt;/Label>
            &lt;Input type="number" value={qty} onChange={e =&gt; setQty(e.target.value)} placeholder="0" />
          &lt;/div>
          &lt;div>
            &lt;Label>Note (optional)&lt;/Label>
            &lt;Textarea value={note} onChange={e =&gt; setNote(e.target.value)} placeholder="Batch details, job #, etc" />
          &lt;/div>
        &lt;/div>
        &lt;div className="flex justify-end gap-3">
          &lt;Button variant="outline" onClick={() =&gt; setOpen(false)}>Cancel&lt;/Button>
          &lt;Button className="btn-primary" onClick={submit}>Save&lt;/Button>
        &lt;/div>
      &lt;/DialogContent>
    &lt;/Dialog>
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
    &lt;Dialog open={open} onOpenChange={setOpen}>
      &lt;DialogTrigger asChild>
        &lt;Button className="btn-primary px-4 py-2 text-sm">&lt;Plus size={16} className="mr-2"/>Add Task&lt;/Button>
      &lt;/DialogTrigger>
      &lt;DialogContent className="sm:max-w-[500px]">
        &lt;DialogHeader>
          &lt;DialogTitle>Add task for today&lt;/DialogTitle>
          &lt;DialogDescription>Quickly capture what's happening today.&lt;/DialogDescription>
        &lt;/DialogHeader>
        &lt;div className="space-y-3">
          &lt;div>
            &lt;Label>Title&lt;/Label>
            &lt;Input value={form.title} onChange={e =&gt; handle("title", e.target.value)} placeholder="Eg. Coat batch #1023 in RAL 9005" />
          &lt;/div>
          &lt;div>
            &lt;Label>Description&lt;/Label>
            &lt;Textarea value={form.description} onChange={e =&gt; handle("description", e.target.value)} placeholder="Notes, specs, prep steps" />
          &lt;/div>
          &lt;div>
            &lt;Label>Assignee (optional)&lt;/Label>
            &lt;Input value={form.assignee} onChange={e =&gt; handle("assignee", e.target.value)} placeholder="Operator's name" />
          &lt;/div>
        &lt;/div>
        &lt;div className="flex justify-end gap-3">
          &lt;Button variant="outline" onClick={() =&gt; setOpen(false)}>Cancel&lt;/Button>
          &lt;Button className="btn-primary" onClick={submit}>Save&lt;/Button>
        &lt;/div>
      &lt;/DialogContent>
    &lt;/Dialog>
  );
}

function Dashboard() {
  const powders = usePowders();
  const tasks = useTodayTasks();

  useEffect(() =&gt; {
    powders.fetchAll();
    tasks.fetchAll();
  }, []);

  const today = useMemo(() =&gt; new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }), []);

  return (
    &lt;div className="app-shell">
      &lt;div className="navbar px-6 py-3 flex items-center justify-between">
        &lt;div className="flex items-center gap-2">
          &lt;div className="h-8 w-8 rounded-lg bg-orange-600" />
          &lt;div className="brand-badge text-sm">METAMORPH &lt;span className="brand-dot">METALS&lt;/span>&lt;/div>
        &lt;/div>
        &lt;div className="text-sm text-slate-600">{today}&lt;/div>
      &lt;/div>

      &lt;main className="px-6 py-6 space-y-6">
        &lt;div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          &lt;StatCard icon={Inbox} label="Total SKUs" value={powders.summary.total_skus} />
          &lt;StatCard icon={Factory} label="Total Stock" value={powders.summary.total_stock_kg} suffix="kg" />
          &lt;StatCard icon={Droplet} label="Low Stock Items" value={powders.summary.low_stock_count} />
        &lt;/div>

        &lt;Tabs defaultValue="inventory" className="w-full">
          &lt;TabsList>
            &lt;TabsTrigger value="inventory">Powder Inventory&lt;/TabsTrigger>
            &lt;TabsTrigger value="tasks">Today's Tasks&lt;/TabsTrigger>
          &lt;/TabsList>

          &lt;TabsContent value="inventory" className="space-y-4">
            &lt;Card className="card-glass border rounded-2xl">
              &lt;CardHeader className="flex-row items-center justify-between">
                &lt;div>
                  &lt;CardTitle>Powders&lt;/CardTitle>
                  &lt;CardDescription>Manage powder stock in kilograms&lt;/CardDescription>
                &lt;/div>
                &lt;AddPowderDialog onSubmit={powders.addPowder} />
              &lt;/CardHeader>
              &lt;CardContent>
                &lt;div className="overflow-x-auto">
                  &lt;Table>
                    &lt;TableHeader>
                      &lt;TableRow className="table-header">
                        &lt;TableHead>Name&lt;/TableHead>
                        &lt;TableHead>Color&lt;/TableHead>
                        &lt;TableHead>Supplier&lt;/TableHead>
                        &lt;TableHead className="text-right">Stock (kg)&lt;/TableHead>
                        &lt;TableHead className="text-right">Safety (kg)&lt;/TableHead>
                        &lt;TableHead>Actions&lt;/TableHead>
                      &lt;/TableRow>
                    &lt;/TableHeader>
                    &lt;TableBody>
                      {powders.items.map(p =&gt; {
                        const low = (p.current_stock_kg || 0) &lt; (p.safety_stock_kg || 0);
                        return (
                          &lt;TableRow key={p.id}>
                            &lt;TableCell className="font-medium">{p.name}&lt;/TableCell>
                            &lt;TableCell>{p.color || "-"}&lt;/TableCell>
                            &lt;TableCell>{p.supplier || "-"}&lt;/TableCell>
                            &lt;TableCell className="text-right">{p.current_stock_kg?.toFixed ? p.current_stock_kg.toFixed(2) : p.current_stock_kg}&lt;/TableCell>
                            &lt;TableCell className="text-right">{p.safety_stock_kg?.toFixed ? p.safety_stock_kg.toFixed(2) : p.safety_stock_kg}&lt;/TableCell>
                            &lt;TableCell className="space-x-2">
                              {low &amp;&amp; &lt;Badge variant="destructive">Low&lt;/Badge>}
                              &lt;StockActionDialog powder={p} type="receive" onSubmit={powders.transact} />
                              &lt;StockActionDialog powder={p} type="consume" onSubmit={powders.transact} />
                            &lt;/TableCell>
                          &lt;/TableRow>
                        );
                      })}
                    &lt;/TableBody>
                  &lt;/Table>
                  {powders.items.length === 0 &amp;&amp; (
                    &lt;div className="text-sm text-slate-500 py-8 text-center">No powders yet. Add your first powder to get started.&lt;/div>
                  )}
                &lt;/div>
              &lt;/CardContent>
            &lt;/Card>
          &lt;/TabsContent>

          &lt;TabsContent value="tasks" className="space-y-4">
            &lt;Card className="card-glass border rounded-2xl">
              &lt;CardHeader className="flex-row items-center justify-between">
                &lt;div>
                  &lt;CardTitle>Today's tasks&lt;/CardTitle>
                  &lt;CardDescription>Keep the team aligned on what's happening&lt;/CardDescription>
                &lt;/div>
                &lt;AddTaskDialog onSubmit={tasks.addTask} />
              &lt;/CardHeader>
              &lt;CardContent>
                &lt;div className="space-y-3">
                  {tasks.tasks.map(t =&gt; (
                    &lt;div key={t.id} className="flex items-start justify-between rounded-xl border p-3"> 
                      &lt;div className="flex items-start gap-3">
                        &lt;Checkbox checked={t.status === 'done'} onCheckedChange={v =&gt; tasks.updateTask(t.id, { status: v ? 'done' : 'pending' })} />
                        &lt;div>
                          &lt;div className="font-medium">{t.title}&lt;/div>
                          {t.description &amp;&amp; &lt;div className="text-sm text-slate-500">{t.description}&lt;/div>}
                          &lt;div className="text-xs text-slate-500 mt-1">{t.assignee ? `Assignee: ${t.assignee}` : 'Unassigned'}&lt;/div>
                        &lt;/div>
                      &lt;/div>
                      {t.status === 'done' &amp;&amp; &lt;Badge className="bg-emerald-600">Done&lt;/Badge>}
                    &lt;/div>
                  ))}
                  {tasks.tasks.length === 0 &amp;&amp; (
                    &lt;div className="text-sm text-slate-500 py-8 text-center">No tasks for today yet. Add your first task.&lt;/div>
                  )}
                &lt;/div>
              &lt;/CardContent>
            &lt;/Card>
          &lt;/TabsContent>
        &lt;/Tabs>
      &lt;/main>
      &lt;Toaster position="top-right" richColors />
    &lt;/div>
  );
}

export default function App() {
  return (
    &lt;BrowserRouter>
      &lt;Dashboard />
    &lt;/BrowserRouter>
  );
}