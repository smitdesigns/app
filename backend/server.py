from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date as date_cls


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


def to_iso_date(d: Optional[date_cls]) -> Optional[str]:
    if d is None:
        return None
    return d.isoformat()


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
    powder_id: str
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
    date: Optional[str] = None  # if not provided, server will set to today (UTC)


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    assignee: Optional[str] = None


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


@api_router.get("/powders/summary")
async def powder_summary():
    items = await db.powders.find().to_list(1000)
    total_skus = len(items)
    total_stock = sum(float(i.get("current_stock_kg", 0.0)) for i in items)
    low_stock = sum(
        1 for i in items if float(i.get("current_stock_kg", 0.0)) < float(i.get("safety_stock_kg", 0.0))
    )
    return {
        "total_skus": total_skus,
        "total_stock_kg": round(total_stock, 2),
        "low_stock_count": low_stock,
    }


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

    # Apply stock update and create transaction
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