-- Only for the disposable CI database, run as its owner after migrations.
CREATE ROLE vault_api LOGIN PASSWORD 'ci-runtime-ephemeral-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT CONNECT ON DATABASE vault_ci TO vault_api;
GRANT USAGE ON SCHEMA public TO vault_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vault_api;
