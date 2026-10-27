# Conciliación de pagos — prototipo

Cruza el Excel de movimientos de Unicaja con el listado de inscritos y sugiere
a qué familia pertenece cada ingreso. Funciona en local: no sube nada a internet.

## Instalar (una vez)

```
pip install -r requirements.txt
```

## Usar

```
python conciliar.py Movimientos_Cuenta_XXXX.xls inscritos.xlsx
```

Genera `conciliacion.xlsx` con tres hojas:

- **Pagos**: cada ingreso con la familia sugerida y la confianza (con colores).
- **Por familia**: cuánto ha pagado cada familia y en cuántos pagos.
- **Gastos (ignorados)**: los movimientos negativos, para que veas que no se pierde nada.

## El listado de inscritos

- Una columna con los padres separados por `/` y otra con el niño.
- Si la primera fila tiene cabecera (por ejemplo "Padres" y "Niño"), se detecta sola.
  Si no, se usan las columnas A y B, o puedes indicarlas: `--col-padres C --col-nino D`.
- Hermanos: basta con repetir los mismos padres en varias filas, aunque estén en
  secciones distintas o con alguna errata.
- Cada vez que se repite la fila de cabecera empieza una sección nueva (1, 2, 3...).
- Las columnas a la derecha del niño (Censo, Cuota...) se leen como actividades:
  lo que ya tengas marcado sale en la hoja "Por familia".
- **Cuantos más apellidos pongas de cada padre/madre, más pagos saldrán en ALTA.**

## Niveles de confianza

| Nivel | Significa |
|---|---|
| CONFIRMADA | Lo confirmaste tú en `pagadores_conocidos.csv` |
| ALTA | Nombre y los dos apellidos del padre/madre coinciden |
| MEDIA | Coincide nombre y el único apellido que hay en el listado |
| BAJA | Solo coincide un apellido (puede ser un familiar) |
| AMBIGUA | Varias familias empatan; revisar a mano |
| SIN IDENTIFICAR | Nadie del listado se parece al pagador |

## Enseñarle pagadores (aprendizaje)

En la carpeta del programa se crea `pagadores_conocidos.csv`. Añade una
línea por cada pagador que identifiques a mano, copiando el nombre tal y como
sale en el banco:

```
pagador;nino
NOMBRE TAL CUAL SALE EN EL BANCO;Nombre del niño como en el listado
```

A partir de entonces sus pagos saldrán como CONFIRMADA.
