import asyncio
from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            await conn.execute(text("ALTER TABLE detection_events ALTER COLUMN location TYPE geography(POINT, 4326) USING location::geography;"))
            print("Migration successful.")
        except Exception as e:
            print(f"Migration error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
