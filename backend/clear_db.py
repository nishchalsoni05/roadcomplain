import asyncio
from sqlalchemy import text
from app.database import engine

async def clear_db():
    print("Clearing database...")
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE detection_events, detection_sessions, road_health_records RESTART IDENTITY CASCADE;"))
        print("Database cleared.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(clear_db())
