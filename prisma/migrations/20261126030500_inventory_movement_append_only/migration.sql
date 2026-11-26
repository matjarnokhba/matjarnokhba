-- InventoryMovement is an append-only audit ledger.
-- UPDATE is always rejected. DELETE is rejected unless the current transaction
-- explicitly opts in with: SELECT set_config('app.allow_movement_delete', 'on', true)
-- (used only by test/maintenance scripts).

CREATE OR REPLACE FUNCTION inventory_movement_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'InventoryMovement is append-only: UPDATE is not allowed';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.allow_movement_delete', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'InventoryMovement is append-only: DELETE is not allowed';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_movement_no_update ON "InventoryMovement";
CREATE TRIGGER inventory_movement_no_update
  BEFORE UPDATE ON "InventoryMovement"
  FOR EACH ROW EXECUTE FUNCTION inventory_movement_append_only();

DROP TRIGGER IF EXISTS inventory_movement_no_delete ON "InventoryMovement";
CREATE TRIGGER inventory_movement_no_delete
  BEFORE DELETE ON "InventoryMovement"
  FOR EACH ROW EXECUTE FUNCTION inventory_movement_append_only();
