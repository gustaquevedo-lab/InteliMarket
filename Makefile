.PHONY: dev seed lint test clean

# Development
dev:
	cd ui-web && npm run dev

# Database
db-migrate:
	cd api && alembic upgrade head

db-migrate-down:
	cd api && alembic downgrade -1

db-migrate-status:
	cd api && alembic current

db-new:
	cd api && alembic revision --autogenerate -m "$(m)"

seed:
	python api/seed.py

# Code quality
lint:
	ruff check api/src
	ruff format --check api/src

test:
	pytest api/tests/ -v

# Clean
clean:
	rm -rf ui-web/node_modules ui-web/dist
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
