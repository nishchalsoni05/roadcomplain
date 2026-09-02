import asyncio
from sqlalchemy import text
from app.database import engine

async def migrate_db():
    print("Starting migration...")
    async with engine.begin() as conn:
        # Alter detection_events location column to geography
        await conn.execute(text("ALTER TABLE detection_events ALTER COLUMN location TYPE geography(Point, 4326) USING location::geometry::geography;"))
        print("Migration complete.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate_db())
