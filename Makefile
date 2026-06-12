COMPOSE_DEV    = docker compose -f compose.yml -f compose.dev.yml
COMPOSE_PROD   = docker compose -f compose.yml -f compose.prod.yml
COMPOSE_TUNNEL = docker compose -f compose.yml -f compose.prod.yml -f compose.tunnel.yml

.PHONY: dev dev-down prod prod-down tunnel tunnel-down logs

dev:
	$(COMPOSE_DEV) up --build

dev-down:
	$(COMPOSE_DEV) down

prod:
	$(COMPOSE_PROD) up -d --build

prod-down:
	$(COMPOSE_PROD) down

tunnel:
	$(COMPOSE_TUNNEL) up -d --build

tunnel-down:
	$(COMPOSE_TUNNEL) down

logs:
	$(COMPOSE_PROD) logs -f
