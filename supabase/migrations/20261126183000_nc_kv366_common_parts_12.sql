-- Ново строителство, Шумен кв. 366: към светлата площ се добавят 12 % общи части и цената се смята върху цялата квадратура.
-- Обща площ = светла площ × 1,12 (72,51 → 81,21 м²; 64,05 → 71,74 м²); цена = обща площ × 1 550 €/м² (125 875,50 € и 111 197,00 €).
-- Приложено на 26.11.2026 г. (тригерът nd_units_price преизчислява price_total).
begin;
update public.nd_projects
   set data = jsonb_set(jsonb_set(data, '{price_policy}', '{"basis":"total","common_parts_pct":12}'::jsonb),
                        '{area_note}', to_jsonb('Светлата площ е по чертеж (сума на помещенията, вкл. балкон/лоджия). Към нея се добавят 12 % общи части – общата площ = светла площ × 1,12. Цената се смята върху общата площ.'::text))
 where id = '82f5aa6a94154507afe916c45f6091fc';
update public.nd_units
   set area_total = round(area_net * 1.12, 2)
 where project_id = '82f5aa6a94154507afe916c45f6091fc' and area_net is not null and not price_override;
commit;
