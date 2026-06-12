COMPOSE_DEV  = docker compose -f compose.yml -f compose.dev.yml
COMPOSE_PROD = docker compose -f compose.yml -f compose.prod.yml

.PHONY: dev dev-down prod prod-down logs

dev:
	$(COMPOSE_DEV) up --build

dev-down:
	$(COMPOSE_DEV) down

prod:
	$(COMPOSE_PROD) up -d --build

prod-down:
	$(COMPOSE_PROD) down

logs:
	$(COMPOSE_PROD) logs -f
