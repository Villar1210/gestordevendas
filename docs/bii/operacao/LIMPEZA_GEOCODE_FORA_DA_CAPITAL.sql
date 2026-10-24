-- Limpeza de 24/10/2026 (bug "Vila Ema de Sao Jose dos Campos").
-- Antes da correcao, a geocodificacao aceitava pontos em toda a Grande SP +
-- Vale do Paraiba. O ITBI e so da capital: ponto fora do retangulo da cidade
-- e erro. Rodar DEPOIS do deploy da correcao (bounded=1 + dentroDaCidadeSP).
-- So altera coordenadas/cache; nenhuma guia e apagada.
BEGIN;
-- 1) Guias do ITBI posicionadas fora da capital voltam para "sem local"
UPDATE itbi_transacoes
   SET latitude = NULL, longitude = NULL, geo_precisao = NULL
 WHERE latitude IS NOT NULL
   AND NOT (latitude BETWEEN -24.01 AND -23.35 AND longitude BETWEEN -46.83 AND -46.36);
-- 2) Cache com resultado fora da capital e apagado (para ser refeito com a
--    busca restrita). "Nao achou" (lat nulo) fica.
DELETE FROM geocode_cache
 WHERE latitude IS NOT NULL
   AND NOT (latitude BETWEEN -24.01 AND -23.35 AND longitude BETWEEN -46.83 AND -46.36);
COMMIT;
