-- =====================================================================
-- 15 · Control de líquidos detallado
--   Cada registro puede indicar el producto (tipo de solución IV, líquido
--   oral, fórmula enteral o hemoderivado), los aditivos agregados a una
--   solución (p. ej. KCl 20 mEq) y la velocidad de infusión en mL/h.
--   No borra datos; se puede correr más de una vez.
-- =====================================================================

ALTER TABLE clinico.liquidos
  ADD COLUMN IF NOT EXISTS producto        text,                          -- Hartmann, NaCl 0.9 %, paquete globular…
  ADD COLUMN IF NOT EXISTS aditivos        jsonb NOT NULL DEFAULT '[]',   -- [{"nombre":"KCl","cantidad":20,"unidad":"mEq"}]
  ADD COLUMN IF NOT EXISTS velocidad_ml_h  numeric(6,1);

ALTER TABLE clinico.liquidos DROP CONSTRAINT IF EXISTS liquidos_velocidad_check;
ALTER TABLE clinico.liquidos ADD  CONSTRAINT liquidos_velocidad_check
  CHECK (velocidad_ml_h IS NULL OR (velocidad_ml_h > 0 AND velocidad_ml_h <= 2000));

ALTER TABLE clinico.liquidos DROP CONSTRAINT IF EXISTS liquidos_aditivos_check;
ALTER TABLE clinico.liquidos ADD  CONSTRAINT liquidos_aditivos_check
  CHECK (jsonb_typeof(aditivos) = 'array' AND jsonb_array_length(aditivos) <= 10);

COMMENT ON COLUMN clinico.liquidos.aditivos IS 'Aditivos de la solución: [{nombre, cantidad, unidad}]';

-- Reglas de captura
CREATE OR REPLACE FUNCTION clinico.fn_liquidos_validar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  a jsonb;
BEGIN
  NEW.producto := nullif(btrim(NEW.producto), '');

  IF NEW.sentido = 'egreso' AND (jsonb_array_length(NEW.aditivos) > 0 OR NEW.velocidad_ml_h IS NOT NULL) THEN
    RAISE EXCEPTION 'Los aditivos y la velocidad de infusión solo aplican a ingresos';
  END IF;

  IF NEW.concepto = 'Solución intravenosa' AND NEW.producto IS NULL THEN
    RAISE EXCEPTION 'Indica el tipo de solución intravenosa (p. ej. NaCl 0.9 %%, Hartmann, glucosa 5 %%)';
  END IF;

  IF jsonb_array_length(NEW.aditivos) > 0 AND NEW.producto IS NULL THEN
    RAISE EXCEPTION 'Indica la solución a la que se agregaron los aditivos';
  END IF;

  FOR a IN SELECT * FROM jsonb_array_elements(NEW.aditivos) LOOP
    IF jsonb_typeof(a) <> 'object'
       OR coalesce(btrim(a->>'nombre'), '') = ''
       OR jsonb_typeof(a->'cantidad') <> 'number'
       OR (a->>'cantidad')::numeric <= 0
       OR coalesce(btrim(a->>'unidad'), '') = '' THEN
      RAISE EXCEPTION 'Cada aditivo necesita nombre, cantidad mayor a cero y unidad';
    END IF;
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_liquidos_validar ON clinico.liquidos;
CREATE TRIGGER trg_liquidos_validar BEFORE INSERT OR UPDATE ON clinico.liquidos
  FOR EACH ROW EXECUTE FUNCTION clinico.fn_liquidos_validar();

-- Que la API de Supabase vea las columnas nuevas de inmediato
NOTIFY pgrst, 'reload schema';
