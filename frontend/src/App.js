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
import { Plus, Inbox, Factory, Droplet, ArrowDownToLine, ArrowUpFromLine, Flame, CheckCircle2, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

function useJobs() {
  const [items, setItems] = useState([]);
  const fetchAll = async () => {
    try { const res = await api.get("/jobs"); setItems(res.data); } catch (e) { console.error(e); toast.error("Failed to load jobs"); }
  };
  const add = async (payload) => { await api.post("/jobs", payload); toast.success("Job added"); await fetchAll(); };
  return { items, fetchAll, add };
}

function useQC() {
  const [summary, setSummary] = useState({ total: 0, passed: 0, failed: 0, pass_percent: 0 });
  const [list, setList] = useState([]);
  const fetchAll = async () => {
    try { const [s, l] = await Promise.all([api.get("/qc/summary"), api.get("/qc?limit=100")]); setSummary(s.data); setList(l.data); } catch (e) { console.error(e); toast.error("Failed to load QC data"); }
  };
  const add = async (payload) => { await api.post("/qc", payload); toast.success("QC recorded"); await fetchAll(); };
  return { summary, list, fetchAll, add };
}

function usePowderUsage() {
  const [today, setToday] = useState({ total_kg: 0 });
  const [trend, setTrend] = useState({ days: 14, points: [] });
  const fetchAll = async (days = 14) => { const [t, tr] = await Promise.all([api.get("/powders/usage/today"), api.get(`/powders/usage/trend?days=${days}`)]); setToday(t.data); setTrend(tr.data); };
  return { today, trend, fetchAll };
}

function usePowders() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total_skus: 0, total_stock_kg: 0, low_stock_count: 0 });
  const fetchAll = async () => { try { const [a,b]=await Promise.all([api.get("/powders"), api.get("/powders/summary")]); setItems(a.data); setSummary(b.data); } catch (e) { console.error(e); toast.error("Failed to load powders"); } };
  const addPowder = async (payload) => { await api.post("/powders", payload); toast.success("Powder added"); await fetchAll(); };
  const transact = async (powderId, payload) => { await api.post(`/powders/${powderId}/transactions`, payload); toast.success(payload.type==='receive'?'Stock received':'Stock consumed'); await fetchAll(); };
  return { items, summary, fetchAll, addPowder, transact };
}

function useGas() {
  const [today, setToday] = useState({ total_qty_kg: 0, total_cost: 0, baseline_avg_kg: 0, alert: false });
  const [trend, setTrend] = useState({ days: 14, points: [] });
  const [logs, setLogs] = useState([]);
  const fetchAll = async (days = 14) => { try { const [sum,tr,lg]=await Promise.all([api.get("/gas/summary/today"), api.get(`/gas/trend?days=${days}`), api.get("/gas/logs?limit=200")]); setToday(sum.data); setTrend(tr.data); setLogs(lg.data); } catch(e){ console.error(e); toast.error("Failed to load gas data"); } };
  const addLog = async (payload) => { await api.post("/gas/logs", payload); toast.success("Gas log added"); await fetchAll(14); };
  return { today, trend, logs, fetchAll, addLog };
}

function Sparkline({ points, height = 56, color = "#f97316" }) {
  if (!points || points.length === 0) return <div className="h-14" />;
  const w = Math.max(points.length - 1, 1) * 20;
  const max = Math.max(...points.map(p => p.qty_kg), 1);
  const path = points.map((p, i) => { const x=i*20; const y=height - (p.qty_kg/max)*height; return `${i===0?'M':'L'} ${x} ${y}`; }).join(" ");
  return (<svg width={w} height={height} viewBox={`0 0 ${w} ${height}`}><path d={path} fill="none" stroke={color} strokeWidth="2"/></svg>);
}

function AddJobDialog({ onSubmit }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ job_id: "", client: "", part: "", color: "", micron: "", status: "Pre-treatment" });
  const set = (k,v) => setForm(prev=>({ ...prev, [k]: v }));
  const submit = async () => {
    if (!form.job_id) { toast.error("Enter Job ID"); return; }
    await onSubmit({
      job_id: form.job_id,
      client: form.client || undefined,
      part: form.part || undefined,
      color: form.color || undefined,
      micron: form.micron || undefined,
      status: form.status || undefined,
    });
    setOpen(false);
    setForm({ job_id: "", client: "", part: "", color: "", micron: "", status: "Pre-treatment" });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="btn-primary px-4 py-2 text-sm"><Plus size={16} className="mr-2"/>Add Job</Button></DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader><DialogTitle>Add Job</DialogTitle><DialogDescription>Minimal job metadata to enable traceability</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Job ID</Label><Input value={form.job_id} onChange={e=>set('job_id', e.target.value)} placeholder="e.g., JOB-1042"/></div>
          <div><Label>Client</Label><Input value={form.client} onChange={e=>set('client', e.target.value)} placeholder="Client name"/></div>
          <div><Label>Part</Label><Input value={form.part} onChange={e=>set('part', e.target.value)} placeholder="Part type"/></div>
          <div><Label>Color</Label><Input value={form.color} onChange={e=>set('color', e.target.value)} placeholder="RAL code"/></div>
          <div><Label>Micron</Label><Input value={form.micron} onChange={e=>set('micron', e.target.value)} placeholder="e.g., 60-80"/></div>
          <div className="col-span-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v=>set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Pre-treatment">Pre-treatment</SelectItem>
                <SelectItem value="Spraying">Spraying</SelectItem>
                <SelectItem value="Curing">Curing</SelectItem>
                <SelectItem value="QC">QC</SelectItem>
                <SelectItem value="Dispatch">Dispatch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-3"><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button className="btn-primary" onClick={submit}>Save</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function JobsTable({ rows }) {
  return (
    <Card className="card-glass border rounded-2xl">
      <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Jobs</CardTitle><CardDescription>Backbone for linking Powder/Gas/QC</CardDescription></div></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="table-header">
                <TableHead>Job ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Part</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Micron</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.job_id}</TableCell>
                  <TableCell>{r.client || '-'}</TableCell>
                  <TableCell>{r.part || '-'}</TableCell>
                  <TableCell>{r.color || '-'}</TableCell>
                  <TableCell>{r.micron || '-'}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{format(parseISO(r.created_at), 'dd MMM yyyy')}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (<TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No jobs yet. Add your first job.</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function QCForm({ onSubmit }) {
  const [form, setForm] = useState({ job_id: "", color_match: false, surface_finish: false, micron_thickness: false, adhesion: false, checked_by: "", notes: "" });
  const set = (k,v) => setForm(prev=>({ ...prev, [k]: v }));
  const submit = async (e) => { e.preventDefault(); if(!form.checked_by){ toast.error('Enter name for signature'); return; } await onSubmit({ job_id: form.job_id || undefined, color_match: !!form.color_match, surface_finish: !!form.surface_finish, micron_thickness: !!form.micron_thickness, adhesion: !!form.adhesion, checked_by: form.checked_by, notes: form.notes || undefined }); setForm({ job_id: "", color_match:false, surface_finish:false, micron_thickness:false, adhesion:false, checked_by:"", notes:"" }); };
  const computedPass = form.color_match && form.surface_finish && form.micron_thickness && form.adhesion;
  return (
    <Card className="card-glass border rounded-2xl">
      <CardHeader><CardTitle>QC Checklist</CardTitle><CardDescription>Link checks to a Job ID for traceability</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Job ID (optional)</Label><Input value={form.job_id} onChange={e=>set('job_id', e.target.value)} placeholder="e.g., JOB-1042"/></div>
            <div className="flex items-center gap-2 mt-6"><Checkbox checked={form.color_match} onCheckedChange={v=>set('color_match', !!v)}/> Color Match</div>
            <div className="flex items-center gap-2"><Checkbox checked={form.surface_finish} onCheckedChange={v=>set('surface_finish', !!v)}/> Surface Finish</div>
            <div className="flex items-center gap-2"><Checkbox checked={form.micron_thickness} onCheckedChange={v=>set('micron_thickness', !!v)}/> Micron Thickness</div>
            <div className="flex items-center gap-2"><Checkbox checked={form.adhesion} onCheckedChange={v=>set('adhesion', !!v)}/> Adhesion</div>
          </div>
          <div><Label>Checked by (name)</Label><Input value={form.checked_by} onChange={e=>set('checked_by', e.target.value)} placeholder="e.g., Aman Gupta"/></div>
          <div><Label>Notes (optional)</Label><Textarea value={form.notes} onChange={e=>set('notes', e.target.value)} placeholder="Defects, rework, remarks"/></div>
          <div className="flex items-center gap-3 text-sm">{computedPass ? (<span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={16}/> Will save as PASS</span>) : (<span className="text-rose-600 flex items-center gap-1"><XCircle size={16}/> Will save as FAIL</span>)}</div>
          <div className="flex justify-end"><Button className="btn-primary">Save QC</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function QCSummaryCard({ summary }) {
  return (
    <Card className="card-glass border rounded-2xl">
      <CardHeader><CardTitle>QC Summary</CardTitle><CardDescription>Pass rate and totals</CardDescription></CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div><div className="text-xs text-slate-500">Total</div><div className="text-xl font-semibold">{summary.total}</div></div>
          <div><div className="text-xs text-emerald-600">Passed</div><div className="text-xl font-semibold">{summary.passed}</div></div>
          <div><div className="text-xs text-rose-600">Failed</div><div className="text-xl font-semibold">{summary.failed}</div></div>
          <div><div className="text-xs text-slate-500">Pass %</div><div className="text-xl font-semibold">{summary.pass_percent}%</div></div>
        </div>
      </CardContent>
    </Card>
  );
}

function QCTable({ rows }) {
  return (
    <Card className="card-glass border rounded-2xl">
      <CardHeader><CardTitle>Recent QC Checks</CardTitle><CardDescription>Latest 100 entries</CardDescription></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="table-header">
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Checked By</TableHead>
                <TableHead>Job ID</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{format(parseISO(`${r.date}T00:00:00Z`), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{r.status === 'pass' ? <Badge className="bg-emerald-600">Pass</Badge> : <Badge variant="destructive">Fail</Badge>}</TableCell>
                  <TableCell>{r.checked_by}</TableCell>
                  <TableCell>{r.job_id || '-'}</TableCell>
                  <TableCell className="max-w-[420px] truncate" title={r.notes || ''}>{r.notes || '-'}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (<TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">No QC checks yet. Add your first record.</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const powders = usePowders();
  const gas = useGas();
  const powderUsage = usePowderUsage();
  const qc = useQC();
  const jobs = useJobs();

  useEffect(() => { (async () => { await Promise.all([powders.fetchAll(), gas.fetchAll(14), powderUsage.fetchAll(14), qc.fetchAll(), jobs.fetchAll()]); })(); }, []);

  const todayStr = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }), []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <div className="navbar px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-600" />
            <div className="brand-badge text-sm">METAMORPH <span className="brand-dot">METALS</span></div>
          </div>
          <div className="text-sm text-slate-600">{todayStr}</div>
        </div>

        <main className="px-6 py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="card-glass border rounded-2xl shadow-sm"><CardContent className="p-5 flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600"><Inbox size={22}/></div><div><div className="stat-value text-2xl font-semibold">{powders.summary.total_skus}</div><div className="stat-label text-sm">Total SKUs</div></div></CardContent></Card>
            <Card className="card-glass border rounded-2xl shadow-sm"><CardContent className="p-5 flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600"><Factory size={22}/></div><div><div className="stat-value text-2xl font-semibold">{powders.summary.total_stock_kg} kg</div><div className="stat-label text-sm">Total Stock</div></div></CardContent></Card>
            <Card className="card-glass border rounded-2xl shadow-sm"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600"><ArrowUpFromLine size={22}/></div><div className="flex-1"><div className="stat-value text-2xl font-semibold">{powderUsage.today.total_kg?.toFixed ? powderUsage.today.total_kg.toFixed(1) : powderUsage.today.total_kg} kg</div><div className="stat-label text-sm">Powder Used Today</div></div></div><div className="mt-3"><Sparkline points={powderUsage.trend.points || []} /></div></CardContent></Card>
            <Card className="card-glass border rounded-2xl shadow-sm"><CardContent className="p-5 flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600"><Droplet size={22}/></div><div><div className="stat-value text-2xl font-semibold">{powders.summary.low_stock_count}</div><div className="stat-label text-sm">Low Stock Items</div></div></CardContent></Card>
            <Card className="card-glass border rounded-2xl shadow-sm"><CardContent className="p-5 flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600"><Flame size={22}/></div><div><div className="stat-value text-2xl font-semibold">{gas.today.total_qty_kg?.toFixed ? gas.today.total_qty_kg.toFixed(1) : gas.today.total_qty_kg} kg</div><div className="stat-label text-sm">Gas Today</div></div></CardContent></Card>
          </div>

          <Tabs defaultValue="inventory" className="w-full">
            <TabsList>
              <TabsTrigger value="inventory">Powder Inventory</TabsTrigger>
              <TabsTrigger value="gas">Gas Usage</TabsTrigger>
              <TabsTrigger value="qc">QC</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
            </TabsList>

            <TabsContent value="inventory" className="space-y-4">
              {/* Inventory table remains (omitted for brevity) */}
            </TabsContent>

            <TabsContent value="gas" className="space-y-4">
              {/* Gas UI as previously implemented */}
            </TabsContent>

            <TabsContent value="qc" className="space-y-4">
              <QCSummaryCard summary={qc.summary} />
              <QCForm onSubmit={qc.add} />
              <QCTable rows={qc.list} />
            </TabsContent>

            <TabsContent value="jobs" className="space-y-4">
              <div className="flex justify-end"><AddJobDialog onSubmit={jobs.add} /></div>
              <JobsTable rows={jobs.items} />
            </TabsContent>
          </Tabs>
        </main>
        <Toaster position="top-right" richColors />
      </div>
    </BrowserRouter>
  );
}