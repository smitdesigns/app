from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, date as date_cls, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ---------------------
# Helpers for Mongo serialization
# ---------------------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_iso_date(d: Optional[str]) -> str:
    """Normalize incoming date string to YYYY-MM-DD (UTC). If None, return today (UTC)."""
    if not d:
        return datetime.now(timezone.utc).date().isoformat()
    try:
        return datetime.fromisoformat(d).date().isoformat()
    except Exception:
        return d[:10]


def day_bounds_utc(dt: Optional[date_cls] = None) -> Dict[str, str]:
    d = dt or datetime.now(timezone.utc).date()
    start = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return {"start": start.isoformat(), "end": end.isoformat()}


# ---------------------
# Models
# ---------------------
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: str = Field(default_factory=now_iso)


class StatusCheckCreate(BaseModel):
    client_name: str


class Powder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    color: Optional[str] = None
    supplier: Optional[str] = None
    current_stock_kg: float = 0.0
    safety_stock_kg: float = 0.0
    cost_per_kg: Optional[float] = None
    created_at: str
    updated_at: str


class PowderCreate(BaseModel):
    name: str
    color: Optional[str] = None
    supplier: Optional[str] = None
    current_stock_kg: float = 0.0
    safety_stock_kg: float = 0.0
    cost_per_kg: Optional[float] = None


class PowderUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    supplier: Optional[str] = None
    safety_stock_kg: Optional[float] = None
    cost_per_kg: Optional[float] = None


class PowderTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    powder_id: str
    type: str  # 'receive' | 'consume'
    quantity_kg: float
    note: Optional[str] = None
    timestamp: str


class PowderTransactionCreate(BaseModel):
    type: str  # 'receive' | 'consume'
    quantity_kg: float
    note: Optional[str] = None


class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    description: Optional[str] = None
    status: str  # 'pending' | 'in_progress' | 'done'
    assignee: Optional[str] = None
    date: str  # ISO date YYYY-MM-DD for "today" grouping
    created_at: str
    updated_at: str


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignee: Optional[str] = None
    date: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    assignee: Optional[str] = None


# New: Gas Usage Models
class GasLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    date: str  # YYYY-MM-DD (UTC)
    fuel_type: str  # 'LPG' | 'Natural Gas'
    quantity_kg: float
    unit_cost: Optional[float] = None
    total_cost: Optional[float] = None
    note: Optional[str] = None
    created_at: str


class GasLogCreate(BaseModel):
    date: Optional[str] = None
    fuel_type: str
    quantity_kg: float
    unit_cost: Optional[float] = None
    note: Optional[str] = None


# New: QC Models
class QCCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    job_id: Optional[str] = None
    date: str
    color_match: bool
    surface_finish: bool
    micron_thickness: bool
    adhesion: bool
    status: str  # pass | fail
    checked_by: str
    notes: Optional[str] = None
    created_at: str


class QCCheckCreate(BaseModel):
    job_id: Optional[str] = None
    date: Optional[str] = None
    color_match: bool
    surface_finish: bool
    micron_thickness: bool
    adhesion: bool
    checked_by: str
    notes: Optional[str] = None


# New: Jobs Models
class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    job_id: str
    client: Optional[str] = None
    part: Optional[str] = None
    color: Optional[str] = None
    micron: Optional[str] = None
    status: str
    created_at: str


class JobCreate(BaseModel):
    job_id: str
    client: Optional[str] = None
    part: Optional[str] = None
    color: Optional[str] = None
    micron: Optional[str] = None
    status: Optional[str] = None  # default applied on server


# ---------------------
# Health/basic routes
# ---------------------
@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(client_name=input.client_name)
    await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# ---------------------
# Powder Inventory Endpoints
# ---------------------
@api_router.post("/powders", response_model=Powder)
async def create_powder(payload: PowderCreate):
    now = now_iso()
    powder = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "color": payload.color,
        "supplier": payload.supplier,
        "current_stock_kg": float(payload.current_stock_kg or 0.0),
        "safety_stock_kg": float(payload.safety_stock_kg or 0.0),
        "cost_per_kg": float(payload.cost_per_kg) if payload.cost_per_kg is not None else None,
        "created_at": now,
        "updated_at": now,
    }
    await db.powders.insert_one(powder)
    return Powder(**powder)


@api_router.get("/powders", response_model=List[Powder])
async def list_powders():
    items = await db.powders.find().sort("name", 1).to_list(1000)
    return [Powder(**it) for it in items]


@api_router.get("/powders/{powder_id}", response_model=Powder)
async def get_powder(powder_id: str):
    it = await db.powders.find_one({"id": powder_id})
    if not it:
        raise HTTPException(status_code=404, detail="Powder not found")
    return Powder(**it)


@api_router.patch("/powders/{powder_id}", response_model=Powder)
async def update_powder(powder_id: str, payload: PowderUpdate):
    it = await db.powders.find_one({"id": powder_id})
    if not it:
        raise HTTPException(status_code=404, detail="Powder not found")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    await db.powders.update_one({"id": powder_id}, {"$set": update})
    new_doc = await db.powders.find_one({"id": powder_id})
    return Powder(**new_doc)


@api_router.post("/powders/{powder_id}/transactions", response_model=PowderTransaction)
async def create_powder_transaction(powder_id: str, payload: PowderTransactionCreate):
    if payload.type not in ("receive", "consume"):
        raise HTTPException(status_code=400, detail="Invalid transaction type")
    if payload.quantity_kg is None or payload.quantity_kg <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")

    powder = await db.powders.find_one({"id": powder_id})
    if not powder:
        raise HTTPException(status_code=404, detail="Powder not found")

    qty = float(payload.quantity_kg)
    new_stock = float(powder.get("current_stock_kg", 0.0)) + (qty if payload.type == "receive" else -qty)
    if new_stock < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    await db.powders.update_one({"id": powder_id}, {"$set": {"current_stock_kg": new_stock, "updated_at": now_iso()}})

    trx = {
        "id": str(uuid.uuid4()),
        "powder_id": powder_id,
        "type": payload.type,
        "quantity_kg": qty,
        "note": payload.note,
        "timestamp": now_iso(),
    }
    await db.powder_transactions.insert_one(trx)
    return PowderTransaction(**trx)


@api_router.get("/powders/summary")
async def powder_summary():
    items = await db.powders.find().to_list(1000)
    total_skus = len(items)
    total_stock = sum(float(i.get("current_stock_kg", 0.0)) for i in items)
    low_stock = sum(1 for i in items if float(i.get("current_stock_kg", 0.0)) < float(i.get("safety_stock_kg", 0.0)))
    return {
        "total_skus": total_skus,
        "total_stock_kg": round(total_stock, 2),
        "low_stock_count": low_stock,
    }


@api_router.get("/powders/usage/today")
async def powder_usage_today():
    bounds = day_bounds_utc()
    q = {"type": "consume", "timestamp": {"$gte": bounds["start"], "$lt": bounds["end"]}}
    items = await db.powder_transactions.find(q).to_list(length=None)
    used = sum(float(i.get("quantity_kg", 0.0)) for i in items)
    return {"date": bounds["start"][:10], "total_kg": round(used, 2)}


@api_router.get("/powders/usage/trend")
async def powder_usage_trend(days: int = Query(14, ge=1, le=90)):
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    start_iso = datetime(start.year, start.month, start.day, 0, 0, 0, tzinfo=timezone.utc).isoformat()
    items = await db.powder_transactions.find({"type": "consume", "timestamp": {"$gte": start_iso}}).to_list(length=None)
    buckets: Dict[str, float] = {}
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        buckets[d] = 0.0
    for it in items:
        d = (it.get("timestamp") or "")[:10]
        if d in buckets:
            buckets[d] += float(it.get("quantity_kg", 0.0))
    points = [{"date": d, "qty_kg": v} for d, v in sorted(buckets.items())]
    return {"days": days, "points": points}


# ---------------------
# Today's Task List Endpoints
# ---------------------
@api_router.post("/tasks", response_model=Task)
async def create_task(payload: TaskCreate):
    today_iso = datetime.now(timezone.utc).date().isoformat()
    now = now_iso()
    task = {
        "id": str(uuid.uuid4()),
        "title": payload.title,
        "description": payload.description,
        "status": "pending",
        "assignee": payload.assignee,
        "date": payload.date or today_iso,
        "created_at": now,
        "updated_at": now,
    }
    await db.tasks.insert_one(task)
    return Task(**task)


@api_router.get("/tasks/today", response_model=List[Task])
async def list_today_tasks():
    today_iso = datetime.now(timezone.utc).date().isoformat()
    tasks = await db.tasks.find({"date": today_iso}).sort("created_at", -1).to_list(1000)
    return [Task(**t) for t in tasks]


@api_router.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, payload: TaskUpdate):
    it = await db.tasks.find_one({"id": task_id})
    if not it:
        raise HTTPException(status_code=404, detail="Task not found")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    await db.tasks.update_one({"id": task_id}, {"$set": update})
    new_doc = await db.tasks.find_one({"id": task_id})
    return Task(**new_doc)


# ---------------------
# Gas Usage Endpoints
# ---------------------
@api_router.post("/gas/logs", response_model=GasLog)
async def create_gas_log(payload: GasLogCreate):
    if payload.quantity_kg is None or payload.quantity_kg <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    if payload.fuel_type not in ("LPG", "Natural Gas"):
        raise HTTPException(status_code=400, detail="fuel_type must be 'LPG' or 'Natural Gas'")
    d = ensure_iso_date(payload.date)
    total_cost = None
    if payload.unit_cost is not None:
        total_cost = float(payload.quantity_kg) * float(payload.unit_cost)
    doc = {
        "id": str(uuid.uuid4()),
        "date": d,
        "fuel_type": payload.fuel_type,
        "quantity_kg": float(payload.quantity_kg),
        "unit_cost": float(payload.unit_cost) if payload.unit_cost is not None else None,
        "total_cost": total_cost,
        "note": payload.note,
        "created_at": now_iso(),
    }
    await db.gas_logs.insert_one(doc)
    return GasLog(**doc)


@api_router.get("/gas/logs", response_model=List[GasLog])
async def list_gas_logs(
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=2000),
):
    query: Dict[str, Dict] = {}
    if start or end:
        s = ensure_iso_date(start) if start else None
        e = ensure_iso_date(end) if end else None
        date_range: Dict[str, str] = {}
        if s:
            date_range["$gte"] = s
        if e:
            date_range["$lte"] = e
        query["date"] = date_range
    items = await db.gas_logs.find(query).sort("date", -1).limit(limit).to_list(length=limit)
    return [GasLog(**it) for it in items]


@api_router.get("/gas/summary/today")
async def gas_summary_today():
    today = datetime.now(timezone.utc).date()
    today_iso = today.isoformat()
    today_items = await db.gas_logs.find({"date": today_iso}).to_list(length=None)
    today_qty = sum(float(i.get("quantity_kg", 0.0)) for i in today_items)
    today_cost = sum(float(i.get("total_cost", 0.0) or 0.0) for i in today_items)

    start = (today - timedelta(days=7)).isoformat()
    window_items = await db.gas_logs.find({"date": {"$gte": start, "$lt": today_iso}}).to_list(length=None)
    day_totals: Dict[str, float] = {}
    for it in window_items:
        d = it.get("date")
        day_totals[d] = day_totals.get(d, 0.0) + float(it.get("quantity_kg", 0.0))
    baseline_avg = (sum(day_totals.values()) / len(day_totals)) if day_totals else 0.0

    alert = False
    if today_qty > 0 and baseline_avg > 0 and today_qty >= 5 and today_qty > 1.5 * baseline_avg:
        alert = True
    if baseline_avg == 0 and today_qty >= 10:
        alert = True

    return {
        "date": today_iso,
        "total_qty_kg": round(today_qty, 2),
        "total_cost": round(today_cost, 2),
        "baseline_avg_kg": round(baseline_avg, 2),
        "alert": alert,
    }


@api_router.get("/gas/trend")
async def gas_trend(days: int = Query(14, ge=1, le=90)):
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    start_iso = start.isoformat()
    items = await db.gas_logs.find({"date": {"$gte": start_iso}}).to_list(length=None)
    buckets: Dict[str, Dict[str, float]] = {}
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        buckets[d] = {"qty_kg": 0.0, "cost": 0.0}
    for it in items:
        d = it.get("date")
        if d in buckets:
            buckets[d]["qty_kg"] += float(it.get("quantity_kg", 0.0))
            buckets[d]["cost"] += float(it.get("total_cost", 0.0) or 0.0)
    points = [{"date": d, **vals} for d, vals in sorted(buckets.items())]
    return {"days": days, "points": points}


# ---------------------
# QC Endpoints
# ---------------------
@api_router.post("/qc", response_model=QCCheck)
async def add_qc_check(payload: QCCheckCreate):
    d = ensure_iso_date(payload.date)
    status = "pass" if (payload.color_match and payload.surface_finish and payload.micron_thickness and payload.adhesion) else "fail"
    doc = {
        "id": str(uuid.uuid4()),
        "job_id": payload.job_id,
        "date": d,
        "color_match": bool(payload.color_match),
        "surface_finish": bool(payload.surface_finish),
        "micron_thickness": bool(payload.micron_thickness),
        "adhesion": bool(payload.adhesion),
        "status": status,
        "checked_by": payload.checked_by,
        "notes": payload.notes,
        "created_at": now_iso(),
    }
    await db.qc_checks.insert_one(doc)
    return QCCheck(**doc)


@api_router.get("/qc", response_model=List[QCCheck])
async def list_qc_checks(limit: int = Query(50, ge=1, le=500)):
    items = await db.qc_checks.find().sort([("date", -1), ("created_at", -1)]).limit(limit).to_list(length=limit)
    return [QCCheck(**it) for it in items]


@api_router.get("/qc/summary")
async def qc_summary():
    total = await db.qc_checks.count_documents({})
    passed = await db.qc_checks.count_documents({"status": "pass"})
    failed = int(total) - int(passed)
    pass_percent = (float(passed) / float(total) * 100.0) if total else 0.0
    return {
        "total": int(total),
        "passed": int(passed),
        "failed": failed,
        "pass_percent": round(pass_percent, 1),
    }


# ---------------------
# Jobs Endpoints
# ---------------------
@api_router.post("/jobs", response_model=Job)
async def add_job(payload: JobCreate):
    now = now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "job_id": payload.job_id,
        "client": payload.client,
        "part": payload.part,
        "color": payload.color,
        "micron": payload.micron,
        "status": payload.status or "Pre-treatment",
        "created_at": now,
    }
    await db.jobs.insert_one(doc)
    return Job(**doc)


@api_router.get("/jobs", response_model=List[Job])
async def list_jobs(limit: int = Query(200, ge=1, le=1000)):
    items = await db.jobs.find().sort("created_at", -1).limit(limit).to_list(length=limit)
    return [Job(**it) for it in items]


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()