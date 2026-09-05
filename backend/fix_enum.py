import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import settings

async def alter_enum():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        for enum_val in ['DAMAGED_SIGNBOARD', 'DAMAGED_DIVIDER', 'MISSING_ZEBRA', 'LICENSE_PLATE', 'TRAFFIC_BOTTLENECK', 'PEDESTRIAN_RISK', 'MISSING_SIGNAGE']:
            try:
                await conn.execute(text(f"ALTER TYPE eventtype ADD VALUE IF NOT EXISTS '{enum_val}'"))
                print(f"Added {enum_val}")
            except Exception as e:
                print(f"Error adding {enum_val}: {e}")

asyncio.run(alter_enum())
