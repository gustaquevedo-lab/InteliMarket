"""Sync all SQLAlchemy model tables to the database."""
import sys
sys.path.insert(0, "/app")
import asyncio
from sqlalchemy import create_engine
from api.src.models import Base

print("Connecting...")
engine = create_engine("postgresql://intelimarket:intelimarket@db:5432/intelimarket")
print("Creating all tables...")
Base.metadata.create_all(engine)
print("Done!")
for tbl in sorted(Base.metadata.sorted_tables, key=lambda t: t.name):
    print("  {}: {} cols".format(tbl.name, len(tbl.columns)))
