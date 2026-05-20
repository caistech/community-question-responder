-- Community Question Responder — system_config table
-- Per CQR_RELEASE_REQUIREMENTS.md Task 3.
-- Holds runtime-written values (agent_id, schema version, install_id, operator identity)
-- that can't live in env vars because the app generates them after first deploy.
-- Idempotent. Safe to re-apply.

-- ---------------------------------------------------------------------------
-- system_config
-- Single-row table (enforced by CHECK). Service-role only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_config (
  id                 int PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Setup wizard state
  setup_complete     boolean NOT NULL DEFAULT false,
  schema_version     int NOT NULL DEFAULT 1,
  install_id         uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Voice agent (created on first run, ID stored here)
  agent_id           text,

  -- Operator identity (replaces hardcoded Dennis/CAS references in voice rules)
  operator_name      text,
  operator_url       text,
  operator_signature text,
  bot_display_name   text NOT NULL DEFAULT 'Community Reply Bot',

  -- Deployment mode (customer-self-serve | vendor-self-deploy)
  deployment_mode    text NOT NULL DEFAULT 'customer-self-serve'
                     CHECK (deployment_mode IN ('customer-self-serve', 'vendor-self-deploy')),

  -- Telemetry opt-out (Rule 10 carve-out)
  telemetry_opt_out  boolean NOT NULL DEFAULT false,

  -- Forward-compat: arbitrary per-step setup flags + future config
  extra              jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Seed the singleton row if it doesn't exist yet.
INSERT INTO public.system_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Maintain updated_at automatically.
CREATE OR REPLACE FUNCTION public.set_system_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS system_config_updated_at ON public.system_config;
CREATE TRIGGER system_config_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.set_system_config_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — service-role only writes; authenticated users can read (so the
-- dashboard chrome can show the operator name, deployment mode, etc.)
-- ---------------------------------------------------------------------------
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_config read for authenticated" ON public.system_config;
CREATE POLICY "system_config read for authenticated"
  ON public.system_config FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "system_config write service-role only" ON public.system_config;
CREATE POLICY "system_config write service-role only"
  ON public.system_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
