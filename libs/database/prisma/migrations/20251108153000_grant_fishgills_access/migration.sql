DO $$
DECLARE
  target_role text := 'fishgills@fishgills.net';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), target_role);
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', target_role);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', target_role);
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I', target_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', target_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', target_role);
  ELSE
    RAISE NOTICE 'Role % not found; skipping IAM grants.', target_role;
  END IF;
END
$$;
