from __future__ import annotations

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Form, Response, Depends, APIRouter
from fastapi.middleware.cors import CORSMiddleware 
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm # Necesario para el flujo de login estándar de FastAPI
from fastapi.responses import FileResponse
from pathlib import Path
from pydantic import BaseModel, field_validator, Field
from typing import Optional, List, Generator
from datetime import datetime, timedelta, timezone, date
import uuid
from passlib.context import CryptContext
from jose import jwt, JWTError
import re
from enum import Enum

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime,
    Boolean,
    select,
    func,
    Date,
    UniqueConstraint,
    Float,
    case,
    cast,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session, aliased, joinedload
from sqlalchemy.exc import IntegrityError


app = FastAPI(title="Strategic Plan API (DB-backed)")

# ---- Configuración de CORS ----

origins = [
    "http://127.0.0.1",  # Dirección común para el localhost
    "http://localhost",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "*", # <-- Permite cualquier origen (solo para desarrollo)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # Lista de orígenes permitidos
    allow_credentials=True,         # Permitir cookies y encabezados de autenticación
    allow_methods=["*"],            # Permitir todos los métodos (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],            # Permitir todos los encabezados
)


@app.on_event("startup")
def on_startup():
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    # Ensure upload dir exists
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# -----------------------------


# ---- Config ----
UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ---- Configuración de Seguridad ----

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = "COLEGIO_ARZOBISPADO" 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ------- Database URL (MySQL) --------
DATABASE_URL = "mysql+pymysql://root:2025@127.0.0.1:3306/colegio_db"

# SQLAlchemy setup
engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()

# ------------------------codigo nuevo---------------------

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserModel:
    """Decodifica el token, maneja la expiración/invalidez (401) y retorna el usuario."""
    credentials_exception = HTTPException(
        status_code=401,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub") 
        
        if username is None:
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    
    user = db.execute(select(UserModel).where(UserModel.rut == username)).scalar_one_or_none()
    
    if user is None:
        raise credentials_exception # Usuario no encontrado, 401
        
    if not user.is_active: 
        raise credentials_exception

    return user

def require_role(*roles: str):
    """
    Dependencia de seguridad que verifica si el usuario autenticado
    (obtenido de get_current_user) tiene uno de los roles especificados.
    Lanza 403 Forbidden si no tiene el rol.
    """
    def _dep(user: UserModel = Depends(get_current_user)) -> UserModel:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Permisos insuficientes")
        return user
    return _dep


# ==============================
# Utilidades & validaciones
# ==============================
def _dv_mod11(num: str) -> str:
    serie = [2,3,4,5,6,7]
    s, i = 0, 0
    for d in reversed(num):
        s += int(d) * serie[i % len(serie)]
        i += 1
    resto = 11 - (s % 11)
    if resto == 11: return "0"
    if resto == 10: return "K"
    return str(resto)

def normalize_rut(rut: str) -> str:
    s = re.sub(r"[^0-9kK]", "", rut or "")
    if len(s) < 2:
        raise HTTPException(status_code=400, detail="RUT inválido")
    cuerpo, dv = s[:-1], s[-1].upper()
    if not cuerpo.isdigit():
        raise HTTPException(status_code=400, detail="RUT inválido")
    if _dv_mod11(cuerpo) != dv:
        # usamos mismo mensaje para no filtrar info
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    # PRESERVA CEROS A LA IZQUIERDA
    return cuerpo + dv

def asdict(model: BaseModel) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()

CURRENT_YEAR = datetime.utcnow().year
MIN_YEAR = 1900
MAX_YEAR = CURRENT_YEAR + 10

ALLOWED_EXTS = {".pdf", ".png", ".jpg", ".jpeg", ".xlsx", ".docx"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
COPY_CHUNK_SIZE = 1024 * 1024        # 1 MB


# ===================================================================
#                             ORM MODELS
# ===================================================================

class ObjectiveModel(Base):
    __tablename__ = "objectives"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=False)
    description = Column(String(1024), nullable=True)
    start_year = Column(Integer, nullable=False)
    end_year = Column(Integer, nullable=False)
    dimension = Column(String(64), nullable=False)
    __table_args__ = (
        UniqueConstraint('dimension', 'name', name='uniq_objective_dim_name'),
    )
    goals = relationship(
        "GoalModel",
        back_populates="objective",
        cascade="all, delete-orphan")


class GoalModel(Base):
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    year = Column(Integer, nullable=False)
    objective_id = Column(Integer, ForeignKey("objectives.id", ondelete="RESTRICT"), nullable=False, index=True)
    objective = relationship("ObjectiveModel", back_populates="goals")
    indicators = relationship("IndicatorModel", back_populates="goal")
    __table_args__ = (
        UniqueConstraint('objective_id', 'title', 'year', name='uniq_goal_obj_title_year'),
    )


class IndicatorModel(Base):
    __tablename__ = "indicators"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    target = Column(Text, nullable=True)
    unit = Column(String(50), nullable=True)
    goal_id = Column(Integer, ForeignKey("goals.id", ondelete="RESTRICT"), nullable=False, index=True)
    goal = relationship("GoalModel", back_populates="indicators")
    evidences = relationship("EvidenceModel", back_populates="indicator", cascade="all, delete-orphan")

    # --- CAMPOS DE PROGRESO (NUEVOS) ---
    # Almacena el valor total (ej: 100 alumnos, 5 proyectos)
    progress_total = Column(Float, nullable=True) 
    # Almacena el valor obtenido (ej: 80 alumnos, 3 proyectos)
    progress_obtained = Column(Float, nullable=True)
    # Almacena el valor de texto libre (para indicadores 'other')
    progress_free = Column(String(255), nullable=True)
    # -----------------------------------

    __table_args__ = (
        UniqueConstraint('goal_id', 'title', 'unit', name='uniq_indicator_goal_title_unit'),
    )


class EvidenceModel(Base):
    __tablename__ = "evidences"
    id = Column(Integer, primary_key=True, index=True)
    description = Column(Text, nullable=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=True)
    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    indicator_id = Column(Integer, ForeignKey("indicators.id", ondelete="RESTRICT"), nullable=True, index=True)
    indicator = relationship("IndicatorModel", back_populates="evidences")
    plan_id = Column(Integer, ForeignKey("strategic_plans.id", ondelete="SET NULL"), nullable=True, index=True)
    plan = relationship("StrategicPlanModel", backref="evidences")


class UserModel(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    rut = Column(String(12), unique=True, nullable=False, index=True) 
    name = Column(String(190), unique=True, nullable=False, index=True) 
    email = Column(String(190), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False) 
    is_active = Column(Boolean, nullable=False, server_default="1")
    role = Column(String(20), nullable=False, server_default="viewer")
    created_at = Column(DateTime, server_default=func.current_timestamp())

class StrategicPlanModel(Base):
    __tablename__ = "strategic_plans"
    id = Column(Integer, primary_key=True, index=True)
    dimension = Column(String(40), nullable=False, index=True)
    colegio = Column(String(200), nullable=False)
    objetivo_estrategico = Column(Text, nullable=False)
    estrategia = Column(Text, nullable=False)
    subdimension = Column(String(120), nullable=True)
    accion = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    fecha_inicio = Column(Date, nullable=False)
    fecha_termino = Column(Date, nullable=False)
    programa_asociado = Column(String(255), nullable=True)
    responsable = Column(String(120), nullable=False)
    created_at = Column(DateTime, server_default=func.current_timestamp())
    resources = relationship(
        "StrategicResourceModel",
        back_populates="plan",
        cascade="all, delete-orphan"
    )
#recursos
class StrategicResourceModel(Base):
    __tablename__ = "plan_resources"
    id   = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("strategic_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    recursos_necesarios   = Column(Text, nullable=True)
    ate                   = Column(String(120), nullable=True)
    tic                   = Column(String(120), nullable=True)
    planes                = Column(String(255), nullable=True)
    medios_verificacion   = Column(Text, nullable=True)
    monto_subvencion_general = Column(Integer, nullable=True, default=0)
    monto_sep                = Column(Integer, nullable=True, default=0)
    monto_pie                = Column(Integer, nullable=True, default=0)
    monto_eib                = Column(Integer, nullable=True, default=0)
    monto_mantenimiento      = Column(Integer, nullable=True, default=0)
    monto_pro_retencion      = Column(Integer, nullable=True, default=0)
    monto_internado          = Column(Integer, nullable=True, default=0)
    monto_reforzamiento      = Column(Integer, nullable=True, default=0)
    monto_faep               = Column(Integer, nullable=True, default=0)
    monto_aporte_municipal   = Column(Integer, nullable=True, default=0)
    monto_total              = Column(Integer, nullable=True, default=0)

    plan = relationship("StrategicPlanModel", back_populates="resources")

class StrategicGoal(Base):
    __tablename__ = "strategic_goals"
    id = Column(Integer, primary_key=True, index=True)
    dimension = Column(String(64), nullable=False)
    objetivo = Column(String(512), nullable=False)
    plan_id = Column(Integer, ForeignKey("strategic_plans.id"), nullable=False)
    meta_estrategica = Column(String(512), nullable=False)
    estrategia_periodo = Column(String(512), nullable=False)
    descripcion_indicador = Column(String(1024), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    plan = relationship("StrategicPlanModel", backref="strategic_goals")


# ===================================================================
#                             Schemas Pydantic
# ===================================================================

class ObjectiveCreate(BaseModel):
    name: str
    dimension: str
    description: Optional[str] = None
    start_year: int
    end_year: int

    @field_validator("start_year", "end_year")
    @classmethod
    def _reasonable_year(cls, v: int):
        if v < MIN_YEAR or v > MAX_YEAR:
            raise ValueError(f"year must be between {MIN_YEAR} and {MAX_YEAR}")
        return v

    @field_validator("end_year")
    @classmethod
    def _end_after_start(cls, v: int, info):
        start = info.data.get("start_year")
        if start is not None and v < start:
            raise ValueError("end_year must be >= start_year")
        return v

class Objective(ObjectiveCreate):
    id: int
    average_progress_pct: Optional[float] = None #Promedio de avance


class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    year: int

    @field_validator("year")
    @classmethod
    def _reasonable_year(cls, v: int):
        if v < MIN_YEAR or v > MAX_YEAR:
            raise ValueError(f"year must be between {MIN_YEAR} and {MAX_YEAR}")
        return v


class Goal(GoalCreate):
    id: int
    objective_id: int


class IndicatorCreate(BaseModel):
    title: str
    target: Optional[str] = None
    unit: Optional[str] = None
    progress_total: Optional[float] = None
    progress_obtained: Optional[float] = None
    progress_free: Optional[str] = None

class Indicator(IndicatorCreate):
    id: int
    goal_id: int

    class Config:
        from_attributes = True

class IndicatorProgressUpdate(BaseModel):
    progress_total: Optional[float] = Field(None, ge=0)
    progress_obtained: Optional[float] = Field(None, ge=0)
    progress_free: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example":{
                "progress_total": 100.0,
                "progress_obtained": 45.5,
                "progress_free": "Notas de progreso"
            }
        }


class EvidenceCreate(BaseModel):
    description: Optional[str] = ""
    filename: str
    original_filename: Optional[str] = None
    plan_id: Optional[int] = None # Permite enviar descripcion


class Evidence(EvidenceCreate):
    id: int
    indicator_id: Optional[int] = None
    uploaded_at: datetime
    download_url: Optional[str] = None

class ObjectiveEvidenceOut(BaseModel):
    id: int
    indicator_id: int
    indicator_title: str
    description: Optional[str] = None
    original_filename: Optional[str] = None
    filename: str
    uploaded_at: datetime
    download_url: str

class DimensionEnum(str, Enum):
    LIDERAZGO = "LIDERAZGO"
    GESTION_PEDAGOGICA = "GESTION_PEDAGOGICA"
    CONVIVENCIA_ESCOLAR = "CONVIVENCIA_ESCOLAR"
    GESTION_RECURSOS = "GESTION_RECURSOS"

class RoleEnum(str, Enum):
    editor = "editor"
    viewer = "viewer"

class StrategicPlanCreate(BaseModel):
    dimension: DimensionEnum
    colegio: str                       
    objetivo_estrategico: str
    estrategia: str
    subdimension: Optional[str] = None
    accion: str
    descripcion: Optional[str] = None
    fecha_inicio: date
    fecha_termino: date
    programa_asociado: Optional[str] = None
    responsable: str

    @field_validator("fecha_termino")
    @classmethod
    def _fin_despues_de_inicio(cls, v: date, info):
        ini = info.data.get("fecha_inicio")
        if ini and v < ini:
            raise ValueError("La Fecha Término debe ser mayor o igual a la Fecha Inicio")
        return v


class StrategicResourceCreate(BaseModel):
    recursos_necesarios: Optional[str] = None
    ate: Optional[str] = None
    tic: Optional[str] = None
    planes: Optional[str] = None
    medios_verificacion: Optional[str] = None
    monto_subvencion_general: Optional[int] = 0
    monto_sep: Optional[int] = 0
    monto_pie: Optional[int] = 0
    monto_eib: Optional[int] = 0
    monto_mantenimiento: Optional[int] = 0
    monto_pro_retencion: Optional[int] = 0
    monto_internado: Optional[int] = 0
    monto_reforzamiento: Optional[int] = 0
    monto_faep: Optional[int] = 0
    monto_aporte_municipal: Optional[int] = 0
    monto_total: Optional[int] = 0


class StrategicResource(StrategicResourceCreate):
    id: int
    plan_id: int


class StrategicPlan(StrategicPlanCreate):
    id: int
    created_at: datetime


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel): 
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel): 
    sub: Optional[str] = None 
    role: Optional[str] = None


class MeOut(BaseModel):
    id: int
    rut: str
    name: str
    email: str
    role: str
    is_active: bool

class StrategicGoalIn(BaseModel):
    dimension: str
    objetivo: str
    plan_id: int
    meta_estrategica: str
    estrategia_periodo: str
    descripcion_indicador: str

class StrategicGoalUpdate(BaseModel):
    plan_id: int | None = None
    meta_estrategica: str | None = None
    estrategia_periodo: str | None = None
    descripcion_indicador: str | None = None

class StrategicGoalOut(BaseModel):
    id: int
    dimension: str
    objetivo: str
    plan_id: int
    meta_estrategica: str
    estrategia_periodo: str
    descripcion_indicador: str
    class Config: from_attributes = True

@app.get("/auth/me", response_model=MeOut)
def me(u: UserModel = Depends(get_current_user)):
    return MeOut(id=u.id, rut=u.rut, name=u.name, email=u.email, role=u.role, is_active=u.is_active)

# ===================================================================
#                       Converters (ORM -> Pydantic)
# ===================================================================


def objective_to_pydantic(m: ObjectiveModel, avg_pct: Optional[float] = None) -> Objective:
    """Map ObjectiveModel to API schema."""
    return Objective(
        id=m.id, 
        name=m.name, 
        description=m.description, 
        start_year=m.start_year, 
        end_year=m.end_year, 
        dimension=m.dimension,
        average_progress_pct=avg_pct if avg_pct is not None else 0.0 
    )

def goal_to_pydantic(m: GoalModel) -> Goal:
    """Map GoalModel to API schema."""
    return Goal(id=m.id, objective_id=m.objective_id, title=m.title, description=m.description, year=m.year)

def indicator_to_pydantic(m: IndicatorModel) -> Indicator:
    """Map IndicatorModel to API schema."""
    return Indicator(
        id=m.id, 
        goal_id=m.goal_id, 
        title=m.title, 
        target=m.target, 
        unit=m.unit,
        progress_total=m.progress_total,
        progress_obtained=m.progress_obtained,
        progress_free=m.progress_free,
    )

def evidence_to_pydantic(m: EvidenceModel) -> Evidence:
    """Map EvidenceModel to API schema."""
    return Evidence(
        id=m.id,
        indicator_id=m.indicator_id,
        plan_id=getattr(m, "plan_id", None),
        description=m.description or "",
        filename=m.filename,
        original_filename=m.original_filename,
        uploaded_at=m.uploaded_at,
        download_url=f"/uploads/{m.filename}",
    )

def plan_to_pydantic(m: StrategicPlanModel) -> StrategicPlan:
    """Map StrategicPlanModel to API schema."""
    return StrategicPlan(
        id=m.id,
        dimension=m.dimension,
        colegio=m.colegio,
        objetivo_estrategico=m.objetivo_estrategico,
        estrategia=m.estrategia,
        subdimension=m.subdimension,
        accion=m.accion,
        descripcion=m.descripcion,
        fecha_inicio=m.fecha_inicio,
        fecha_termino=m.fecha_termino,
        programa_asociado=m.programa_asociado,
        responsable=m.responsable,
        created_at=m.created_at,
    )

def Resource_to_pydantic(m: StrategicResourceModel) -> StrategicResource:
    """Map StrategicResourceModel to API schema."""
    return StrategicResource(
        id=m.id,
        plan_id=m.plan_id,
        recursos_necesarios=m.recursos_necesarios,
        ate=m.ate,
        tic=m.tic,
        planes=m.planes,
        medios_verificacion=m.medios_verificacion,
        monto_subvencion_general=m.monto_subvencion_general,
        monto_sep=m.monto_sep,
        monto_pie=m.monto_pie,
        monto_eib=m.monto_eib,
        monto_mantenimiento=m.monto_mantenimiento,
        monto_pro_retencion=m.monto_pro_retencion,
        monto_internado=m.monto_internado,
        monto_reforzamiento=m.monto_reforzamiento,
        monto_faep=m.monto_faep,
        monto_aporte_municipal=m.monto_aporte_municipal,
        monto_total=m.monto_total,
    )

def objective_get_by_dim_and_name(db: Session, dimension: str, name: str) -> Optional[ObjectiveModel]:
    return (
        db.query(ObjectiveModel)
          .filter(
              ObjectiveModel.dimension == dimension,
              ObjectiveModel.name == name
          ).first()
    )

def objective_create_or_get(db: Session, payload: ObjectiveCreate) -> ObjectiveModel:
    """
    Crea un Objective idempotente por (dimension, name).
    Si ya existe, retorna el existente.
    """
    # ¿Existe?
    existing = objective_get_by_dim_and_name(db, payload.dimension, payload.name)
    if existing:
        return existing

    # Crear protegido por UNIQUE(dimension, name)
    m = ObjectiveModel(**asdict(payload))
    db.add(m)
    try:
        db.flush()
    except IntegrityError:
        # Otra request paralela lo insertó: busca y devuelve
        db.rollback()
        again = objective_get_by_dim_and_name(db, payload.dimension, payload.name)
        if again:
            return again
        raise HTTPException(status_code=409, detail="Objective already exists")
    return m

# ---- Helpers de Seguridad (Añadir en cualquier lugar antes de las rutas) ----

def hash_password(password: str) -> str:
    """Hashea una contraseña para almacenarla."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, password: str) -> bool:
    """Verifica una contraseña contra un hash."""
    return pwd_context.verify(plain_password, password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Genera un token de acceso JWT."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

#====================================================================
#                               RUTAS
#====================================================================

# ====================
# OBJETIVOS
# ====================

@app.post("/objectives", response_model=Objective, status_code=201)
def create_objective(
    payload: ObjectiveCreate,
    db: Session = Depends(get_db),
    response: Response = None
):
    """
    Crea un Objective idempotente por (dimension, name).
    Si ya existe, lo devuelve con 200 (OK).
    """
    obj = objective_create_or_get(db, payload)
    if response is not None:
        # Si no es "nuevo", status 200
        exists = db.query(ObjectiveModel).filter(
            ObjectiveModel.id == obj.id
        ).count() > 0 and objective_get_by_dim_and_name(db, payload.dimension, payload.name) is not None
        response.status_code = 200 if exists else 201
    return objective_to_pydantic(obj)

@app.get("/objectives", response_model=List[Objective])
def list_objectives(
    dimension: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    Lista objetivos con filtros opcionales por dimension y/o name,
    incluyendo el avance promedio de sus indicadores.
    """
    # Calcula % de avance por indicador
    pct_per_indicator = func.coalesce(
        case(
            (IndicatorModel.progress_total > 0, 
             (IndicatorModel.progress_obtained / IndicatorModel.progress_total) * 100),
            else_=0.0
        ),
        0.0 
    )

    #Agrupa por ID del objetivo
    avg_progress_subquery = (
        select(
            GoalModel.objective_id,
            func.avg(pct_per_indicator).label('avg_pct')
        )
        .join(IndicatorModel, IndicatorModel.goal_id == GoalModel.id)
        .group_by(GoalModel.objective_id)
        .subquery()
    )

    q = db.query(ObjectiveModel).order_by(ObjectiveModel.id.asc())
    
    #Unir la tabla de objetivos con el resultado del promedio
    q = q.outerjoin(
        avg_progress_subquery,
        avg_progress_subquery.c.objective_id == ObjectiveModel.id
    )
    
    #Aplicar filtros
    if dimension:
        q = q.filter(ObjectiveModel.dimension == dimension)
    if name:
        q = q.filter(ObjectiveModel.name == name)
        
    #Seleccionar ObjectiveModel y el promedio calculado
    q = q.with_entities(
        ObjectiveModel,
        avg_progress_subquery.c.avg_pct.label('average_progress_pct')
    ).order_by(ObjectiveModel.id.asc())

    objs_data = q.offset(skip).limit(limit).all()
    
    #Mapear y devolver los datos
    results = []
    for obj_model, avg_pct in objs_data:
        results.append(objective_to_pydantic(obj_model, avg_pct if avg_pct is not None else 0.0))
        
    return results


@app.get("/objectives/{objective_id}", response_model=Objective)
def get_objective(objective_id: int, db: Session = Depends(get_db)):
    """Fetch a single objective by ID, 404 if missing."""
    m = db.get(ObjectiveModel, objective_id)
    if not m:
        raise HTTPException(status_code=404, detail="Objective not found")
    return objective_to_pydantic(m)

@app.delete("/objectives/{objective_id}", status_code=204)
def delete_objective(objective_id: int, db: Session = Depends(get_db)):
    """Delete an objective only if it has no child goals."""
    m = db.get(ObjectiveModel, objective_id)
    if not m:
        raise HTTPException(status_code=404, detail="Objective not found")
    child_count = db.execute(select(func.count(GoalModel.id)).where(GoalModel.objective_id == objective_id)).scalar()
    if child_count and child_count > 0:
        raise HTTPException(status_code=409, detail="Objective has goals; delete them first")
    db.delete(m)
    return Response(status_code=204)

# ====================
# GOALS
# ====================

@app.post("/objectives/{objective_id}/goals", response_model=Goal, status_code=201)
def create_goal(objective_id: int, payload: GoalCreate, db: Session = Depends(get_db), response: Response = None):
    """Create a goal under an objective; enforce that the goal year is within the objective range.
       Idempotente por (objective_id, title, year)."""
    obj = db.get(ObjectiveModel, objective_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Objective not found")
    if not (obj.start_year <= payload.year <= obj.end_year):
        raise HTTPException(status_code=400, detail="Goal year must be within the objective period")

    # 1) ¿Ya existe?
    existing = (
        db.query(GoalModel)
          .filter(
              GoalModel.objective_id == objective_id,
              GoalModel.title == payload.title,
              GoalModel.year == payload.year
          )
          .first()
    )
    if existing:
        # Devolver el existente con 200 (no creado)
        if response is not None:
            response.status_code = 200
        return goal_to_pydantic(existing)

    # 2) Crear (protegido por índice único)
    m = GoalModel(objective_id=objective_id, **asdict(payload))
    db.add(m)
    try:
        db.flush()  # o db.commit() si tu patrón lo requiere aquí
    except IntegrityError:
        db.rollback()
        # Buscar y devolver el existente (otra request paralela lo insertó)
        again = (
            db.query(GoalModel)
              .filter(
                  GoalModel.objective_id == objective_id,
                  GoalModel.title == payload.title,
                  GoalModel.year == payload.year
              )
              .first()
        )
        if again:
            if response is not None:
                response.status_code = 200
            return goal_to_pydantic(again)
        # Si no lo encontramos, reporta conflicto
        raise HTTPException(status_code=409, detail="Goal already exists")
    return goal_to_pydantic(m)


@app.get("/objectives/{objective_id}/goals", response_model=List[Goal])
def list_goals(objective_id: int, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    """List all goals for an objective."""
    stmt = select(GoalModel).where(GoalModel.objective_id == objective_id).order_by(GoalModel.id).offset(skip).limit(limit)
    goals = db.execute(stmt).scalars().all()
    return [goal_to_pydantic(g) for g in goals]

@app.get("/goals/{goal_id}", response_model=Goal)
def get_goal(goal_id: int, db: Session = Depends(get_db)):
    """Retrieve a single goal."""
    m = db.get(GoalModel, goal_id)
    if not m:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal_to_pydantic(m)

@app.delete("/goals/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    """Delete a goal only if it has no indicators."""
    m = db.get(GoalModel, goal_id)
    if not m:
        raise HTTPException(status_code=404, detail="Goal not found")
    child_count = db.execute(select(func.count(IndicatorModel.id)).where(IndicatorModel.goal_id == goal_id)).scalar()
    if child_count and child_count > 0:
        raise HTTPException(status_code=409, detail="Goal has indicators; delete them first")
    db.delete(m)
    return Response(status_code=204)

# ====================
# INDICADORES
# ====================

@app.post("/goals/{goal_id}/indicators", response_model=Indicator, status_code=201)
def create_indicator(goal_id: int, payload: IndicatorCreate, db: Session = Depends(get_db), response: Response = None):
    """Create an indicator for a goal. Idempotente por (goal_id, title, unit)."""
    parent = db.get(GoalModel, goal_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Goal not found")

    # Al comparar unit, cuida el NULL
    unit = getattr(payload, "unit", None)
    q = db.query(IndicatorModel).filter(
        IndicatorModel.goal_id == goal_id,
        IndicatorModel.title == payload.title,
        (IndicatorModel.unit == unit) if unit is not None else IndicatorModel.unit.is_(None)
    )
    existing = q.first()
    if existing:
        if response is not None:
            response.status_code = 200
        return indicator_to_pydantic(existing)

    m = IndicatorModel(goal_id=goal_id, **asdict(payload))
    db.add(m)
    try:
        db.flush()  # o db.commit()
    except IntegrityError:
        db.rollback()
        again = db.query(IndicatorModel).filter(
            IndicatorModel.goal_id == goal_id,
            IndicatorModel.title == payload.title,
            (IndicatorModel.unit == unit) if unit is not None else IndicatorModel.unit.is_(None)
        ).first()
        if again:
            if response is not None:
                response.status_code = 200
            return indicator_to_pydantic(again)
        raise HTTPException(status_code=409, detail="Indicator already exists")
    return indicator_to_pydantic(m)

@app.get("/goals/{goal_id}/indicators", response_model=List[Indicator])
def list_indicators(goal_id: int, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    """List all indicators under a goal."""
    stmt = select(IndicatorModel).where(IndicatorModel.goal_id == goal_id).order_by(IndicatorModel.id).offset(skip).limit(limit)
    inds = db.execute(stmt).scalars().all()
    return [indicator_to_pydantic(i) for i in inds]

@app.get("/indicators/{indicator_id}", response_model=Indicator)
def get_indicator(indicator_id: int, db: Session = Depends(get_db)):
    """Fetch a single indicator."""
    m = db.get(IndicatorModel, indicator_id)
    if not m:
        raise HTTPException(status_code=404, detail="Indicator not found")
    return indicator_to_pydantic(m)

@app.delete("/indicators/{indicator_id}", status_code=204)
def delete_indicator(indicator_id: int, db: Session = Depends(get_db)):
    """Delete an indicator only if it has no evidences attached."""
    m = db.get(IndicatorModel, indicator_id)
    if not m:
        raise HTTPException(status_code=404, detail="Indicator not found")
    db.delete(m)
    return Response(status_code=204)

@app.patch("/indicators/{indicator_id}/progress", status_code=204) 
async def update_indicator_progress(
    indicator_id: int,
    data: IndicatorProgressUpdate,
    db: Session = Depends(get_db)
):
    """
    Recibe la actualización de progreso (total, obtenido, o texto libre) 
    y actualiza el indicador en la DB.
    """
    # Buscar el indicador
    stmt = select(IndicatorModel).where(IndicatorModel.id == indicator_id)
    indicator = db.execute(stmt).scalars().first()

    if not indicator:
        raise HTTPException(status_code=404, detail=f"Indicator with ID {indicator_id} not found")

    # 2. Preparar datos: Convierte Pydantic a diccionario, excluyendo los campos que son None
    update_data = data.model_dump(exclude_none=True) 

    # 3. Aplicar las actualizaciones
    for key, value in update_data.items():
        setattr(indicator, key, value) 

    # 4. Guardar los cambios
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during update: {e}")

    return

# ====================
# EVIDENCIAS
# ====================

@app.post("/indicators/{indicator_id}/evidences", response_model=Evidence, status_code=201)
def upload_evidence(indicator_id: int, file: UploadFile = File(...), description: str = Form(""), db: Session = Depends(get_db)):
    """Stream-save an uploaded file to disk with size/type checks and register an Evidence row."""
    ind = db.get(IndicatorModel, indicator_id)
    if not ind:
        raise HTTPException(status_code=404, detail="Indicator not found")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=415, detail=f"Unsupported file type '{ext}'")
    filename = f"{uuid.uuid4()}{ext}"
    dest = UPLOAD_DIR / filename
    bytes_written = 0
    with dest.open("wb") as buffer:
        while True:
            chunk = file.file.read(COPY_CHUNK_SIZE)
            if not chunk:
                break
            bytes_written += len(chunk)
            if bytes_written > MAX_UPLOAD_BYTES:
                buffer.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large")
            buffer.write(chunk)
    m = EvidenceModel(
        indicator_id=indicator_id,
        description=description,
        filename=filename,
        original_filename=file.filename,
        uploaded_at=datetime.utcnow()
    )
    db.add(m)
    db.flush()
    return evidence_to_pydantic(m)

@app.post("/plans/{plan_id}/evidences", response_model=Evidence, status_code=201)
def upload_plan_evidence(plan_id: int, file: UploadFile = File(...), description: str = Form(""), db: Session = Depends(get_db)):
    plan = db.get(StrategicPlanModel, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=415, detail=f"Unsupported file type '{ext}'")
    filename = f"{uuid.uuid4()}{ext}"
    dest = UPLOAD_DIR / filename
    bytes_written = 0
    with dest.open("wb") as buffer:
        while True:
            chunk = file.file.read(COPY_CHUNK_SIZE)
            if not chunk:
                break
            bytes_written += len(chunk)
            if bytes_written > MAX_UPLOAD_BYTES:
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large")
            buffer.write(chunk)
    m = EvidenceModel(
        plan_id=plan_id,
        description=description,
        filename=filename,
        original_filename=file.filename,
        uploaded_at=datetime.utcnow()
    )
    db.add(m)
    db.flush()
    return evidence_to_pydantic(m)


@app.get("/indicators/{indicator_id}/evidences", response_model=List[Evidence])
def list_evidences(indicator_id: int, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    """List evidences for a specific indicator."""
    if not db.get(IndicatorModel, indicator_id):
        raise HTTPException(status_code=404, detail="Indicator not found")
    stmt = select(EvidenceModel).where(EvidenceModel.indicator_id == indicator_id).order_by(EvidenceModel.id).offset(skip).limit(limit)
    evs = db.execute(stmt).scalars().all()
    return [evidence_to_pydantic(e) for e in evs]

@app.get("/evidences/{evidence_id}", response_model=Evidence)
def get_evidence(evidence_id: int, db: Session = Depends(get_db)):
    """Fetch a single evidence record."""
    m = db.get(EvidenceModel, evidence_id)
    if not m:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return evidence_to_pydantic(m)

@app.get("/plans/{plan_id}/evidences", response_model=List[Evidence])
def list_plan_evidences(plan_id: int, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    if not db.get(StrategicPlanModel, plan_id):
        raise HTTPException(status_code=404, detail="Plan not found")
    stmt = select(EvidenceModel).where(EvidenceModel.plan_id == plan_id).order_by(EvidenceModel.id).offset(skip).limit(limit)
    evs = db.execute(stmt).scalars().all()
    return [evidence_to_pydantic(e) for e in evs]

@app.delete("/evidences/{evidence_id}", status_code=204)
def delete_evidence(evidence_id: int, db: Session = Depends(get_db)):
    """Delete an evidence row and remove the physical file if present."""
    m = db.get(EvidenceModel, evidence_id)
    if not m:
        raise HTTPException(status_code=404, detail="Evidence not found")
    filename = m.filename
    db.delete(m)
    try:
        (UPLOAD_DIR / filename).unlink(missing_ok=True)
    except Exception:
        pass
    return Response(status_code=204)

# Descarga directa del archivo subido
@app.get("/uploads/{filename}")
def download_upload(filename: str):
    path = UPLOAD_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(path, media_type="application/octet-stream", filename=filename)

# ---- Evidences aggregated by Objective (objective → goals → indicators) ----
@app.get("/objectives/{objective_id}/evidences", response_model=list[ObjectiveEvidenceOut])
def list_evidences_by_objective(objective_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(
            EvidenceModel.id,
            EvidenceModel.indicator_id,
            IndicatorModel.title.label("indicator_title"),
            EvidenceModel.description,
            EvidenceModel.original_filename,
            EvidenceModel.filename,
            EvidenceModel.uploaded_at
        )
        .join(IndicatorModel, IndicatorModel.id == EvidenceModel.indicator_id)
        .join(GoalModel, GoalModel.id == IndicatorModel.goal_id)
        .where(GoalModel.objective_id == objective_id)
        .order_by(EvidenceModel.uploaded_at.desc())
    )
    rows = db.execute(stmt).all()

    out: list[ObjectiveEvidenceOut] = []
    for r in rows:
        out.append(ObjectiveEvidenceOut(
            id=r.id,
            indicator_id=r.indicator_id,
            indicator_title=r.indicator_title,
            description=r.description,
            original_filename=r.original_filename,
            filename=r.filename,
            uploaded_at=r.uploaded_at,
            download_url=f"/uploads/{r.filename}",
        ))
    return out

@app.get("/objectives/{objective_id}/evidences/count")
def count_evidences_by_objective(objective_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(func.count(EvidenceModel.id))
        .join(IndicatorModel, IndicatorModel.id == EvidenceModel.indicator_id)
        .join(GoalModel, GoalModel.id == IndicatorModel.goal_id)
        .where(GoalModel.objective_id == objective_id)
    )
    return { "count": db.scalar(stmt) or 0 }


# ====================
# LOGIN
# ====================

@app.post("/auth/login", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    """Endpoint para autenticar al usuario y generar un token JWT."""
    rut_normalizado = normalize_rut(form_data.username) 
    user = db.execute(select(UserModel).where(UserModel.rut == rut_normalizado)).scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=401, 
            detail="Credenciales inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_payload = {
        "sub": user.rut, 
        "role": user.role
    }
    access_token = create_access_token(
        token_payload, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


# =========================================================
# Strategic Plans API (plans + resources + strategic goals)
# =========================================================


@app.post("/plans", response_model=StrategicPlan, status_code=201)
def create_plan(
    payload: StrategicPlanCreate,
    db: Session = Depends(get_db),
    current_user: "UserModel" = Depends(require_role("editor")),
):
    """Create a StrategicPlan row. Only editors may create."""
    m = StrategicPlanModel(
        dimension=payload.dimension.value,
        colegio=payload.colegio,
        objetivo_estrategico=payload.objetivo_estrategico,
        estrategia=payload.estrategia,
        subdimension=payload.subdimension,
        accion=payload.accion,
        descripcion=payload.descripcion,
        fecha_inicio=payload.fecha_inicio,
        fecha_termino=payload.fecha_termino,
        programa_asociado=payload.programa_asociado,
        responsable=payload.responsable,
    )
    db.add(m)
    db.flush()
    return plan_to_pydantic(m)

@app.get("/plans", response_model=List[StrategicPlan])
def list_plans(
    dimension: Optional[DimensionEnum] = Query(None),
    colegio: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List plans with optional dimension/college filters."""
    stmt = select(StrategicPlanModel).order_by(StrategicPlanModel.id)
    if dimension:
        stmt = stmt.where(StrategicPlanModel.dimension == dimension.value)
    if colegio:
        stmt = stmt.where(StrategicPlanModel.colegio == colegio)
    rows = db.execute(stmt.offset(skip).limit(limit)).scalars().all()

    return [plan_to_pydantic(r) for r in rows]

@app.get("/plans/dimensions", response_model=List[str])
def list_dimensions():
    """Return the static list of valid dimensions (Enum values)."""
    return [d.value for d in DimensionEnum]

@app.get("/plans/{plan_id}", response_model=StrategicPlan)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    """Retrieve a single plan by ID."""
    m = db.get(StrategicPlanModel, plan_id)
    if not m:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    return plan_to_pydantic(m)

@app.delete("/plans/{plan_id}", status_code=204)
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: "UserModel" = Depends(require_role("editor")),
):
    """Delete a plan (editor only)."""
    m = db.get(StrategicPlanModel, plan_id)
    if not m:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    db.delete(m)
    return Response(status_code=204)

@app.post("/plans/{plan_id}/resources", response_model=StrategicResource, status_code=201)
def create_resource(
    plan_id: int,
    payload: StrategicResourceCreate,
    db: Session = Depends(get_db),
    current_user: "UserModel" = Depends(require_role("editor")),
):
    """Create resource/budget row for a plan. If total is missing, it is computed."""
    plan = db.get(StrategicPlanModel, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    if not payload.monto_total:
        nums = [
            payload.monto_subvencion_general or 0,
            payload.monto_sep or 0,
            payload.monto_pie or 0,
            payload.monto_eib or 0,
            payload.monto_mantenimiento or 0,
            payload.monto_pro_retencion or 0,
            payload.monto_internado or 0,
            payload.monto_reforzamiento or 0,
            payload.monto_faep or 0,
            payload.monto_aporte_municipal or 0,
        ]
        payload.monto_total = sum(nums)

    m = StrategicResourceModel(plan_id=plan_id, **asdict(payload))
    db.add(m)
    db.flush()
    return Resource_to_pydantic(m)

@app.get("/plans/{plan_id}/resources", response_model=List[StrategicResource])
def list_resources(plan_id: int, db: Session = Depends(get_db)):
    """List all resources for a given plan."""
    if not db.get(StrategicPlanModel, plan_id):
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    rows = db.execute(
        select(StrategicResourceModel).where(StrategicResourceModel.plan_id == plan_id)
    ).scalars().all()
    return [Resource_to_pydantic(r) for r in rows]

@app.delete("/resources/{resource_id}", status_code=204)
def delete_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: "UserModel" = Depends(require_role("editor")),
):
    """Delete a single resource row (editor only)."""
    m = db.get(StrategicResourceModel, resource_id)
    if not m:
        raise HTTPException(status_code=404, detail="Recurso no encontrado")
    db.delete(m)
    return Response(status_code=204)

@app.get("/strategic-goals", response_model=list[StrategicGoalOut])
def list_strategic_goals(
    dimension: str = Query(...),
    objetivo: str = Query(...),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Query all strategic goals matching a (dimension, objetivo) pair."""
    q = db.query(StrategicGoal).filter(
        StrategicGoal.dimension == dimension,
        StrategicGoal.objetivo == objetivo
    ).order_by(StrategicGoal.id.asc())
    return q.all()

@app.post("/strategic-goals", response_model=StrategicGoalOut)
def create_strategic_goal(
    payload: StrategicGoalIn,
    db: Session = Depends(get_db),
    user = Depends(require_role("editor"))
):
    """Create a strategic goal record bound to an existing plan (editor only)."""
    plan = db.query(StrategicPlanModel).get(payload.plan_id)
    if not plan:
        raise HTTPException(404, "Plan no existe")

    rec = StrategicGoal(
        dimension=payload.dimension,
        objetivo=payload.objetivo,
        plan_id=payload.plan_id,
        meta_estrategica=payload.meta_estrategica,
        estrategia_periodo=payload.estrategia_periodo,
        descripcion_indicador=payload.descripcion_indicador
    )
    db.add(rec); db.commit(); db.refresh(rec)
    return rec

@app.put("/strategic-goals/{sid}", response_model=StrategicGoalOut)
def update_strategic_goal(
    sid: int, payload: StrategicGoalUpdate,
    db: Session = Depends(get_db),
    user = Depends(require_role("editor"))
):
    """Partial update for strategic goals; validates plan existence when changed."""
    rec = db.query(StrategicGoal).get(sid)
    if not rec:
        raise HTTPException(404, "No encontrado")
    if payload.plan_id:
        plan = db.query(StrategicPlanModel).get(payload.plan_id)
        if not plan: raise HTTPException(404, "Plan no existe")
        rec.plan_id = payload.plan_id
    if payload.meta_estrategica is not None: rec.meta_estrategica = payload.meta_estrategica
    if payload.estrategia_periodo is not None: rec.estrategia_periodo = payload.estrategia_periodo
    if payload.descripcion_indicador is not None: rec.descripcion_indicador = payload.descripcion_indicador
    db.commit(); db.refresh(rec)
    return rec

@app.delete("/strategic-goals/{sid}")
def delete_strategic_goal(
    sid: int,
    db: Session = Depends(get_db),
    user = Depends(require_role("editor"))
):
    """Delete a strategic goal (editor only)."""
    rec = db.query(StrategicGoal).get(sid)
    if not rec: raise HTTPException(404, "No encontrado")
    db.delete(rec); db.commit()
    return {"ok": True}

# Health
@app.get("/health")
def health():
    return {"status": "ok"}
