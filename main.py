from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
import math
import os

import models
from database import engine, SessionLocal

# Create tables automatically on startup
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CO-OP CONNECT API")

configured_origins = os.getenv("FRONTEND_ORIGINS", "*")
allowed_origins = [
    origin.strip() for origin in configured_origins.split(",") if origin.strip()
]

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to CO-OP CONNECT API",
        "docs": "/docs"
    }

# Enable CORS for Flutter & React integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allowed_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- AUTOMATIC DATABASE SEEDING ON STARTUP ---
@app.on_event("startup")
def startup_db_seed():
    db = SessionLocal()
    try:
        if db.query(models.Worker).count() == 0:
            initial_workers = [
                models.Worker(name="Rahul Kumar", service="Plumbing", rating=4.8, lat=22.5726, lon=88.3639, exp_years=5, available=True),
                models.Worker(name="Amit Das", service="Plumbing", rating=4.6, lat=22.5800, lon=88.3700, exp_years=3, available=True),
                models.Worker(name="Suresh Verma", service="Electrical", rating=4.9, lat=22.5650, lon=88.3600, exp_years=8, available=True),
                models.Worker(name="Priya Sharma", service="Cleaner", rating=4.7, lat=22.5700, lon=88.3650, exp_years=4, available=True)
            ]
            db.add_all(initial_workers)
            db.commit()
    finally:
        db.close()

# --- PYDANTIC SCHEMAS ---
class UserRegister(BaseModel):
    name: str
    email: str
    role: str

class AdminLogin(BaseModel):
    email: str
    password: str

class MatchRequest(BaseModel):
    service: str
    customer_lat: float
    customer_lon: float

class BookingRequest(BaseModel):
    customer_id: int
    worker_id: int
    service: str

class StatusUpdate(BaseModel):
    status: str

class PredictionRequest(BaseModel):
    service: str
    days_ahead: int = 1

# --- HELPER FUNCTIONS ---
def calculate_distance(lat1, lon1, lat2, lon2):
    return math.sqrt((lat2 - lat1)**2 + (lon2 - lon1)**2) * 111

# --- ENDPOINTS ---

# 1. USER REGISTRATION
@app.post("/api/register")
def register_user(user: UserRegister, db: Session = Depends(get_db)):
    db_user = models.User(name=user.name, email=user.email, role=user.role)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"message": "User registered successfully", "user_id": db_user.id}

# 2. ADMIN LOGIN (FOR MEMBER 3 REACT DASHBOARD)
@app.post("/api/admin/login")
def admin_login(credentials: AdminLogin):
    if credentials.email == "admin@coopconnect.com" and credentials.password == "admin123":
        return {
            "status": "success",
            "token": "admin-demo-token-12345",
            "admin": {"email": credentials.email, "role": "admin"}
        }
    raise HTTPException(status_code=401, detail="Invalid admin credentials")

# 3. GET WORKERS LIST (FOR MEMBER 2 FLUTTER APP)
@app.get("/api/workers")
def get_workers(service: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Worker)
    if service:
        query = query.filter(models.Worker.service.ilike(service))
    workers = query.all()
    return {"workers": workers}

# 4. MATCHING ENGINE
@app.post("/api/match")
def match_workers(request: MatchRequest, db: Session = Depends(get_db)):
    workers = db.query(models.Worker).filter(
        models.Worker.service.ilike(request.service),
        models.Worker.available == True
    ).all()
    
    results = []
    for w in workers:
        dist = calculate_distance(request.customer_lat, request.customer_lon, w.lat, w.lon)
        dist_score = max(0, 100 - (dist * 10))
        rating_score = (w.rating / 5.0) * 100
        exp_score = min(100, w.exp_years * 10)
        
        match_percentage = round((dist_score * 0.4) + (rating_score * 0.4) + (exp_score * 0.2), 1)
        results.append({
            "worker_id": w.id,
            "name": w.name,
            "service": w.service,
            "distance_km": round(dist, 2),
            "rating": w.rating,
            "lat": w.lat,
            "lon": w.lon,
            "exp_years": w.exp_years,
            "match_score": match_percentage
        })
    
    results.sort(key=lambda x: x["match_score"], reverse=True)
    return {"matches": results}

# 5. CREATE BOOKING
@app.post("/api/bookings")
def create_booking(booking: BookingRequest, db: Session = Depends(get_db)):
    new_booking = models.Booking(
        customer_id=booking.customer_id,
        worker_id=booking.worker_id,
        service=booking.service,
        status="pending"
    )
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    return {"message": "Booking created", "booking_id": new_booking.id, "status": new_booking.status}

# 6. UPDATE BOOKING STATUS
@app.put("/api/bookings/{booking_id}/status")
def update_booking_status(booking_id: int, update: StatusUpdate, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking.status = update.status
    db.commit()
    return {"message": "Status updated successfully", "booking_id": booking.id, "status": booking.status}

# 7. ADMIN DASHBOARD STATS
@app.get("/api/admin/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    total_workers = db.query(models.Worker).count()
    total_customers = db.query(models.User).filter(models.User.role == "customer").count()
    active_jobs = db.query(models.Booking).filter(models.Booking.status.in_(["pending", "accepted"])).count()
    completed_jobs = db.query(models.Booking).filter(models.Booking.status == "completed").count()

    return {
        "total_workers": total_workers,
        "total_customers": total_customers,
        "active_jobs": active_jobs,
        "completed_jobs": completed_jobs
    }

# 8. AI DEMAND PREDICTION
@app.post("/api/admin/predict-demand")
def predict_demand(request: PredictionRequest):
    base_demand = {"plumbing": 45, "electrical": 30, "cleaning": 20}
    service_key = request.service.lower()
    
    current_demand = base_demand.get(service_key, 15)
    forecasted_demand = int(current_demand * (1 + (0.15 * request.days_ahead)))
    
    status = "HIGH DEMAND" if forecasted_demand > 40 else "MODERATE DEMAND"
    recommendation = f"Deploy {math.ceil(forecasted_demand * 0.2)} additional workers."
    
    return {
        "service": request.service.capitalize(),
        "forecast_days": request.days_ahead,
        "predicted_requests": forecasted_demand,
        "demand_level": status,
        "action_recommended": recommendation
    }

