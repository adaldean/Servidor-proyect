from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

import httpx
import time
import os
from dotenv import load_dotenv
from databases import Database

# -------------------------------
# CARGAR VARIABLES DE ENTORNO
# -------------------------------
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
ORIGEN = os.getenv("ORIGEN_PERMITIDO")
INEGI_TOKEN = os.getenv("INEGI_TOKEN")
API_KEY = os.getenv("API_KEY")

# VALIDACIONES
if not DATABASE_URL:
    raise Exception("❌ DATABASE_URL no está definido")

if not ORIGEN:
    raise Exception("❌ ORIGEN_PERMITIDO no está definido")

if not API_KEY:
    raise Exception("❌ API_KEY no está definido")

database = Database(DATABASE_URL)

# -------------------------------
# LIFESPAN
# -------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.connect()
    print("✅ DB conectada")

    await database.execute("""
    CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre TEXT UNIQUE NOT NULL,
        pin TEXT NOT NULL,
        grado TEXT
    )
    """)

    await database.execute("""
    CREATE TABLE IF NOT EXISTS estados (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        capital TEXT NOT NULL,
        region TEXT,
        clima TEXT,
        platillo_tipico TEXT,
        fiesta_popular TEXT,
        curiosidad TEXT,
        id_geojson TEXT UNIQUE,
        id_inegi TEXT UNIQUE,
        escudo_url TEXT
    )
    """)

    await database.execute("""
    CREATE TABLE IF NOT EXISTS poblacion (
        id SERIAL PRIMARY KEY,
        estado_id INT REFERENCES estados(id) ON DELETE CASCADE,
        anio TEXT,
        poblacion BIGINT,
        UNIQUE(estado_id, anio)
    )
    """)

    # Escudos automáticos
    await database.execute("""
    UPDATE estados
    SET escudo_url = '/static/images/estados/' || id_inegi || '.png'
    WHERE escudo_url IS NULL OR escudo_url = ''
    """)

    print("✅ Tablas listas")

    yield

    await database.disconnect()
    print("❌ DB desconectada")

# -------------------------------
# APP
# -------------------------------
app = FastAPI(
    title="Atlas Escolar API",
    version="3.2 - Secure",
    lifespan=lifespan
)

# -------------------------------
# CORS SEGURO
# -------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ORIGEN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# LOGS
# -------------------------------
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    print(f"{request.method} {request.url} - {time.time()-start:.2f}s")
    return response

# -------------------------------
# ROOT
# -------------------------------
@app.get("/")
async def root():
    return FileResponse("login.html")

# -------------------------------
# REDIRECCIÓN
# -------------------------------
def get_redirect_by_grado(grado: str):
    if not grado:
        return "/"

    grado = grado.lower()

    if grado in ["principiante", "primaria_1_3"]:
        return "/mexico/estados"

    elif grado in ["medio", "secundaria", "preparatoria"]:
        return "/paises"

    return "/"

# -------------------------------
# 🔐 VALIDACIÓN API KEY
# -------------------------------
def validar_api_key(x_api_key: str):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="❌ Firma no válida")

# -------------------------------
# AUTH
# -------------------------------
@app.post("/auth/register")
async def register(user: dict):
    query = """
    INSERT INTO usuarios (nombre, pin, grado)
    VALUES (:nombre, :pin, :grado)
    RETURNING id, nombre, grado
    """
    try:
        res = await database.fetch_one(query, values=user)

        user_data = dict(res)

        return {
            "access_token": f"token-{user_data['id']}",
            "usuario": user_data,
            "redirect": get_redirect_by_grado(user_data["grado"])
        }

    except Exception:
        raise HTTPException(400, "Usuario ya existe")


@app.post("/auth/login")
async def login(credentials: dict):
    query = """
    SELECT id, nombre, grado 
    FROM usuarios 
    WHERE nombre = :nombre AND pin = :pin
    """
    res = await database.fetch_one(query, values=credentials)

    if not res:
        raise HTTPException(401, "Nombre o PIN incorrectos")

    user_data = dict(res)

    return {
        "access_token": f"token-{user_data['id']}",
        "usuario": user_data,
        "redirect": get_redirect_by_grado(user_data["grado"])
    }

# -------------------------------
# 🔥 INEGI API (GUARDADO PROTEGIDO)
# -------------------------------
@app.get("/inegi/poblacion/{estado_id}")
async def get_poblacion(estado_id: str):

    if not INEGI_TOKEN:
        raise HTTPException(500, "Token INEGI no configurado")

    estado = await database.fetch_one("""
        SELECT * FROM estados 
        WHERE id_geojson = :geo OR id_inegi = :inegi
    """, values={"geo": estado_id, "inegi": estado_id.zfill(2)})

    if not estado:
        raise HTTPException(404, "Estado no encontrado")

    url = f"https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR/1002000001/es/{estado['id_inegi']}/true/BISE/2.0/{INEGI_TOKEN}?type=json"

    async with httpx.AsyncClient() as client:
        res = await client.get(url)

    if res.status_code != 200:
        raise HTTPException(500, "Error INEGI")

    data = res.json()

    try:
        obs = data["Series"][0]["OBSERVATIONS"]
    except:
        return {"status": "sin datos"}

    for o in obs:
        try:
            poblacion = int(float(o["OBS_VALUE"].replace(",", "")))

            await database.execute("""
            INSERT INTO poblacion (estado_id, anio, poblacion)
            VALUES (:estado_id, :anio, :poblacion)
            ON CONFLICT (estado_id, anio) DO NOTHING
            """, values={
                "estado_id": estado["id"],
                "anio": o["TIME_PERIOD"],
                "poblacion": poblacion
            })

        except:
            continue

    return {"status": "ok"}

# -------------------------------
# CONSULTA SEGURA
# -------------------------------
@app.get("/poblacion/{estado_id}")
async def get_data(estado_id: str):

    rows = await database.fetch_all("""
    SELECT e.nombre, e.capital, e.region, e.clima,
           e.escudo_url, p.anio, p.poblacion,
           e.platillo_tipico, e.fiesta_popular, e.curiosidad
    FROM poblacion p
    JOIN estados e ON e.id = p.estado_id
    WHERE e.id_geojson = :geo OR e.id_inegi = :inegi
    ORDER BY p.anio DESC
    """, values={"geo": estado_id, "inegi": estado_id.zfill(2)})

    return [dict(r) for r in rows]

# -------------------------------
# 🔐 EJEMPLO ENDPOINT PROTEGIDO
# -------------------------------
@app.post("/secure/test")
async def secure_test(data: dict, x_api_key: str = Header(None)):
    validar_api_key(x_api_key)
    return {"msg": "Acceso permitido 😎"}

# -------------------------------
# VISTAS
# -------------------------------
@app.get("/mexico/estados")
async def mexico():
    return FileResponse("mexico.html")

@app.get("/paises")
async def paises():
    return FileResponse("paises.html")

# -------------------------------
# STATIC
# -------------------------------
app.mount("/static", StaticFiles(directory="static"), name="static")

# -------------------------------
# CONFIG
# -------------------------------
@app.get("/config")
async def config():
    return {
        "status": "secure ✅",
        "port": PORT,
        "inegi": bool(INEGI_TOKEN),
        "origen": ORIGEN,
        "api_key_loaded": bool(API_KEY)
    }

# -------------------------------
# RUN
# -------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)