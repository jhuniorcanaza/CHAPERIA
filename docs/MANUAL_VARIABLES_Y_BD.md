# Manual Técnico: Variables de Entorno (.env) y Diccionario de Base de Datos (PostgreSQL 18)

## 1. Manual de Variables de Entorno (`Backend/.env`)

| Variable | Valor Local Configurado | Descripción Técnica |
| :--- | :--- | :--- |
| `PORT` | `3000` | Puerto donde escucha el servidor NestJS. |
| `NODE_ENV` | `development` | Modo de ejecución (`development` en Windows local, `production` en VPS Docker). |
| `DB_HOST` | `127.0.0.1` | Host de PostgreSQL (`127.0.0.1` en local, `chaperia_db` en Docker Compose). |
| `DB_PORT` | `5432` | Puerto TCP de PostgreSQL 18.2. |
| `DB_USER` | `postgres` | Usuario administrador de PostgreSQL. |
| `DB_PASSWORD` | `76964482` | Contraseña verificada del servidor PostgreSQL local. |
| `DB_NAME` | `chaperia_local_db` | Nombre de la base de datos creada en PostgreSQL 18.2. |
| `DB_SYNCHRONIZE` | `true` | Permite a TypeORM sincronizar automáticamente las 12 tablas al iniciar. |
| `JWT_SECRET` | `chaperia_pro_super_secret...` | Llave secreta para firmar los tokens JWT de sesión. |
| `UPLOAD_DIR` | `uploads` | Carpeta donde se almacenan las imágenes convertidas a `.webp` y PDFs. |
| `WEBP_MAX_WIDTH` | `1600` | Ancho máximo en píxeles al redimensionar fotos con `sharp`. |
| `WEBP_QUALITY` | `80` | Calidad de compresión WebP (`80%` reduce fotos de 6 MB a ~100 KB sin perder nitidez). |
| `DEFAULT_USD_TO_CLP`| `980` | Tipo de cambio inicial por defecto (`1 USD = 980 CLP`). |
| `DEFAULT_PENALTY_PER_DAY_USD` | `20` | Multa por día de retraso injustificado para contratistas (`$20 USD`). |

---

## 2. Diccionario de Tablas en PostgreSQL (`chaperia_local_db`)

El archivo `Backend/src/entities/all.entities.ts` genera automáticamente estas **12 tablas** en PostgreSQL:

1. **`usuarios`**: Cuentas de acceso con login (`SUPERADMIN_BOLIVIA`, `ADMIN_BOLIVIA`, `ENCARGADO_CHILE`).
2. **`tecnicos_proveedores`**: Chaperos (fijos y contratistas), pintores y talleres externos con su promedio de estrellas (`1.0` a `5.0`) y bloqueo por mal desempeño.
3. **`vehiculos`**: Tabla maestra con VIN/Chasis, Placa/Lote, `tipoCliente` (`INTERNO_IMPORTADORA` / `EXTERNO_CALLE`), `prioridadCola` (`ALTA_15_DIAS` / `COLA_30_DIAS`), PDF de Orden de Traspaso y costo de grúa.
4. **`recepciones_checkin`**: Inventario físico de ingreso (llanta auxilio, gata, pisos, radio original, faroles, airbags) y galería `jsonb` de fotos `.webp`.
5. **`cotizaciones`**: Cabecera con versión, `montoOriginalUsd` (inmutable), `montoAcordadoUsd`, `estadoAprobacion` (`AMARILLO_EDITADA_POR_BOLIVIA` $\rightarrow$ `VERDE_ACEPTADA_POR_CHILE`) y auditoría de quién editó/aprobó.
6. **`cotizacion_items`**: Ítems detallados por pieza con `gradoDanio` (`LEVE` / `FUERTE` en chapería), costo interno/tercero vs. precio al cliente y foto de desarme.
7. **`tareas_ot`**: Tareas de la Orden de Trabajo separando Chapero y Pintor, avance booleano, fechas límite, prórrogas justificadas, descuento por multa y reasignación.
8. **`repuestos_vehiculo`**: Control de repuestos "en cuentagotas" con código de serie y foto de recepción.
9. **`insumos_almacen`**: Catálogo y stock de los ~15 insumos recurrentes (lijas, gasolina, thinner, masilla, cinta, oxígeno, etc.).
10. **`movimientos_insumo`**: Kardex de compras de stock, salidas por vehículo/tarea y compras de pintura de colorista con foto de factura.
11. **`herramientas_taller`**: Activos del taller, solicitudes de compra con caja chica y bajas con foto obligatoria (`DESGASTE_NORMAL` vs. `MAL_USO_COBRAR`).
12. **`configuraciones` y `notificaciones`**: Parámetros globales y bitácora de alertas enviadas en tiempo real sin F5.

