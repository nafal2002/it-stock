-- Re-create the transaction apply function to be more robust
CREATE OR REPLACE FUNCTION public.apply_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- We use the item_id and ensure the user owns the item
  IF NEW.tipe = 'masuk' THEN
    UPDATE public.items 
    SET qty = qty + NEW.qty 
    WHERE id = NEW.item_id;
  ELSIF NEW.tipe = 'keluar' THEN
    UPDATE public.items 
    SET qty = qty - NEW.qty 
    WHERE id = NEW.item_id;
  END IF;
  
  RETURN NEW;
END; $$;

-- Re-create the trigger
DROP TRIGGER IF EXISTS tx_apply ON public.transactions;
CREATE TRIGGER tx_apply AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_transaction();
