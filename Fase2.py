from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import sqlite3
import httpx
import time
import os
from databases import Database
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

# Definir el manejador lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await database.connect()
    print("DEBUG: Conectado a la base de datos PostgreSQL")

    # Crear la tabla 'favoritos' si no existe
    query = """
    CREATE TABLE IF NOT EXISTS favoritos (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        capital TEXT,
        currency TEXT,
        continent TEXT,
        population BIGINT,
        languages TEXT,
        subregion TEXT,
        area DOUBLE PRECISION,
        flag_url TEXT,
        cca3 TEXT
    )
    """
    await database.execute(query)

    # Migracion ligera para bases existentes (agrega columnas si faltan)
    alter_queries = [
        "ALTER TABLE favoritos ADD COLUMN IF NOT EXISTS continent TEXT",
        "ALTER TABLE favoritos ADD COLUMN IF NOT EXISTS population BIGINT",
        "ALTER TABLE favoritos ADD COLUMN IF NOT EXISTS languages TEXT",
        "ALTER TABLE favoritos ADD COLUMN IF NOT EXISTS subregion TEXT",
        "ALTER TABLE favoritos ADD COLUMN IF NOT EXISTS area DOUBLE PRECISION",
        "ALTER TABLE favoritos ADD COLUMN IF NOT EXISTS flag_url TEXT",
        "ALTER TABLE favoritos ADD COLUMN IF NOT EXISTS cca3 TEXT"
    ]
    for alter_query in alter_queries:
        await database.execute(alter_query)
    print("DEBUG: Tabla 'favoritos' verificada o creada exitosamente.")
    
    yield
    
    # Shutdown
    await database.disconnect()
    print("DEBUG: Desconectado de la base de datos PostgreSQL")

# Configurar la aplicación con el manejador lifespan
app = FastAPI(
    title="Countries API",
    description="API para obtener información de países y almacenarla en una base de datos SQLite",
    version="1.0.0",
    lifespan=lifespan
)

# Definir la conexión a la base de datos PostgreSQL
DATABASE_URL = "postgresql://postgres:123456@localhost:5432/countries_db"
database = Database(DATABASE_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    print(f"{request.method} {request.url} completed in {process_time:.2f} seconds")
    return response


@app.get("/")
async def root():
        return FileResponse("c:/Users/adald/Documents/Visual/S7A/paises.html")

@app.get("/countries/name/{country_name}")
async def get_country_by_name(country_name: str):
    url = f"https://restcountries.com/v3.1/name/{country_name}?fields=name,capital,currencies,region,population,languages,subregion,area,flags,cca3"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url)
            print(f"Request to {url} completed with status code {response.status_code}")

            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="País no encontrado")
            
            data = response.json()
            countries_data = {
                "name": data[0].get("name", {}).get("common", "N/A"),
                "capital": data[0].get("capital", ["N/A"])[0],
                "currency": list(data[0].get("currencies", {}).keys())[0] if data[0].get("currencies") else "N/A",
                "continent": data[0].get("region", "N/A"),
                "population": data[0].get("population", 0),
                "languages": ", ".join(list(data[0].get("languages", {}).values())) if data[0].get("languages") else "N/A",
                "subregion": data[0].get("subregion", "N/A"),
                "area": data[0].get("area", 0),
                "flag_url": data[0].get("flags", {}).get("png", ""),
                "cca3": data[0].get("cca3", "")
            }

            return countries_data
        except httpx.RequestError:
            raise HTTPException(status_code=500, detail="Error al conectar con la API externa")
        
# ---------------------------------------------
# MÉTODO POST - GUARDAR PAÍS FAVORITO
# ---------------------------------------------
@app.post("/favoritos")
async def guardar_pais_favorito(pais: dict):
    # Validar que el JSON tenga las claves necesarias
    required_keys = ["name"]
    for key in required_keys:
        if key not in pais:
            print(f"DEBUG ERROR: Falta la clave requerida: {key}")
            return {
                "status": "error",
                "message": f"Falta la clave requerida: {key}"
            }

    print(f"DEBUG: Intentando guardar el país {pais['name']} en la DB PostgreSQL")

    query = """
    INSERT INTO favoritos (name, capital, currency, continent, population, languages, subregion, area, flag_url, cca3)
    VALUES (:name, :capital, :currency, :continent, :population, :languages, :subregion, :area, :flag_url, :cca3)
    """
    try:
        await database.execute(query, values={
            "name": pais["name"],
            "capital": pais.get("capital", "N/A"),
            "currency": pais.get("currency", "N/A"),
            "continent": pais.get("continent", "N/A"),
            "population": pais.get("population", 0),
            "languages": pais.get("languages", "N/A"),
            "subregion": pais.get("subregion", "N/A"),
            "area": pais.get("area", 0),
            "flag_url": pais.get("flag_url", ""),
            "cca3": pais.get("cca3", "")
        })
        print(f"DEBUG: País {pais['name']} guardado correctamente en la base de datos.")
        return {
            "status": "success",
            "message": f"{pais['name']} guardado en favoritos"
        }
    except Exception as e:
        print(f"DEBUG ERROR: Error inesperado al guardar el país. Error: {e}")
        return {
            "status": "error",
            "message": "Ocurrió un error inesperado al guardar el país."
        }

# ---------------------------------------------
# MÉTODO POST - GUARDAR RECURSO EN LA DB
# ---------------------------------------------
@app.post("/recursos")
async def guardar_recurso(recurso: dict):
    required_keys = ["name"]
    for key in required_keys:
        if key not in recurso:
            return {
                "status": "error",
                "message": f"Falta la clave requerida: {key}"
            }

    query = """
    INSERT INTO favoritos (name, capital, currency, continent, population, languages, subregion, area, flag_url, cca3)
    VALUES (:name, :capital, :currency, :continent, :population, :languages, :subregion, :area, :flag_url, :cca3)
    """
    await database.execute(query, values={
        "name": recurso["name"],
        "capital": recurso.get("capital", "N/A"),
        "currency": recurso.get("currency", "N/A"),
        "continent": recurso.get("continent", "N/A"),
        "population": recurso.get("population", 0),
        "languages": recurso.get("languages", "N/A"),
        "subregion": recurso.get("subregion", "N/A"),
        "area": recurso.get("area", 0),
        "flag_url": recurso.get("flag_url", ""),
        "cca3": recurso.get("cca3", "")
    })
    return {"status": "success", "message": "Recurso guardado exitosamente."}

# ---------------------------------------------
# MÉTODO GET - LISTAR TODOS LOS RECURSOS
# ---------------------------------------------
@app.get("/recursos")
async def listar_recursos():
    query = "SELECT * FROM favoritos"
    rows = await database.fetch_all(query)
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "capital": row["capital"],
            "currency": row["currency"],
            "continent": row["continent"],
            "population": row["population"],
            "languages": row["languages"],
            "subregion": row["subregion"],
            "area": row["area"],
            "flag_url": row["flag_url"],
            "cca3": row["cca3"]
        }
        for row in rows
    ]

# ---------------------------------------------
# MÉTODO PUT/PATCH - ACTUALIZAR RECURSO
# ---------------------------------------------
@app.put("/recursos/{id}")
async def actualizar_recurso(id: int, recurso: dict):
    query = """
    UPDATE favoritos
    SET name = :name,
        capital = :capital,
        currency = :currency,
        continent = :continent,
        population = :population,
        languages = :languages,
        subregion = :subregion,
        area = :area,
        flag_url = :flag_url,
        cca3 = :cca3
    WHERE id = :id
    """
    await database.execute(query, values={
        "id": id,
        "name": recurso.get("name"),
        "capital": recurso.get("capital"),
        "currency": recurso.get("currency"),
        "continent": recurso.get("continent"),
        "population": recurso.get("population"),
        "languages": recurso.get("languages"),
        "subregion": recurso.get("subregion"),
        "area": recurso.get("area"),
        "flag_url": recurso.get("flag_url"),
        "cca3": recurso.get("cca3")
    })
    return {"status": "success", "message": "Recurso actualizado exitosamente."}

# ---------------------------------------------
# MÉTODO DELETE - ELIMINAR RECURSO
# ---------------------------------------------
@app.delete("/recursos/{id}")
async def eliminar_recurso(id: int):
    query = "DELETE FROM favoritos WHERE id = :id"
    await database.execute(query, values={"id": id})
    return {"status": "success", "message": "Recurso eliminado exitosamente."}

# ---------------------------------------------
# MÉTODO GET - LISTAR PAÍSES FAVORITOS
# ---------------------------------------------
@app.get("/favoritos")
async def listar_paises_favoritos():
    query = "SELECT * FROM favoritos"
    rows = await database.fetch_all(query)

    favoritos = []
    for row in rows:
        favoritos.append({
            "id": row["id"],
            "name": row["name"],
            "capital": row["capital"],
            "currency": row["currency"]
        })
    return FileResponse("c:/Users/adald/Documents/Visual/S7A/favoritos.html")



# ---------------------------------------------
# MÉTODO POST - GUARDAR OBJETO EN LA DB
# ---------------------------------------------
@app.post("/objetos")
async def guardar_objeto(objeto: dict):
    required_keys = ["name", "description"]
    for key in required_keys:
        if key not in objeto:
            return {
                "status": "error",
                "message": f"Falta la clave requerida: {key}"
            }

    query = """
    INSERT INTO objetos (name, description)
    VALUES (:name, :description)
    """
    await database.execute(query, values={
        "name": objeto["name"],
        "description": objeto.get("description", "N/A")
    })
    return {"status": "success", "message": "Objeto guardado exitosamente."}

# ---------------------------------------------
# MÉTODO GET - OBTENER OBJETO DE LA DB
# ---------------------------------------------
@app.get("/objetos/{id}")
async def obtener_objeto(id: int):
    query = "SELECT * FROM objetos WHERE id = :id"
    row = await database.fetch_one(query, values={"id": id})

    if not row:
        return {"status": "error", "message": "Objeto no encontrado."}

    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"]
    }

# ---------------------------------------------
# MÉTODO DELETE - ELIMINAR OBJETO DE LA DB
# ---------------------------------------------
@app.delete("/objetos/{id}")
async def eliminar_objeto(id: int):
    query = "DELETE FROM objetos WHERE id = :id"
    await database.execute(query, values={"id": id})

    # Verificar que el objeto ya no existe
    query_verificar = "SELECT * FROM objetos WHERE id = :id"
    row = await database.fetch_one(query_verificar, values={"id": id})

    if row:
        return {"status": "error", "message": "El objeto no pudo ser eliminado."}

    return {"status": "success", "message": "Objeto eliminado exitosamente."}

# Inicialización de la base de datos
if not os.path.exists("countries.db"):
    print("DEBUG: Creando la base de datos 'countries.db'")
    conn = sqlite3.connect("countries.db")
    cursor = conn.cursor()

    # Crear la tabla 'favoritos' si no existe
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS favoritos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            capital TEXT,
            currency TEXT
        )
        """
    )

    conn.commit()
    conn.close()
    print("DEBUG: Tabla 'favoritos' creada exitosamente.")

app.mount("/static", StaticFiles(directory="c:\\Users\\adald\\Documents\\Visual\\S7A\\static"), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)



