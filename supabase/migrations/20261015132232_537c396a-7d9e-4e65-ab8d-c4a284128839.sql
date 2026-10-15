ALTER TABLE public."Tasks" ADD COLUMN IF NOT EXISTS phase integer DEFAULT NULL;
ALTER TABLE public."Projects" ADD COLUMN IF NOT EXISTS phase_rewards jsonb DEFAULT NULL;
ALTER TABLE public."Projects" ADD COLUMN IF NOT EXISTS is_phased boolean DEFAULT false;