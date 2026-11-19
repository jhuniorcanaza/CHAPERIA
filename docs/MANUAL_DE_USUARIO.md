# Manual Oficial de Usuario — Sistema Chapería Pro (Bolivia ↔ Chile)

## 1. Credenciales Iniciales de Acceso (Usuarios Semilla)
> **Importante:** Los chaperos, pintores y mecánicos NO tienen usuario para ingresar al sistema. Solo acceden la Gerencia en Bolivia y el Encargado en Chile.

| Usuario | Correo Electrónico | Contraseña Inicial | Rol en el Sistema |
| :--- | :--- | :--- | :--- |
| **Dueño / Gerencia (Bolivia)** | `admin@chaperia.com` | `123456` | `SUPERADMIN_BOLIVIA` |
| **Luis / Marcelo (Bolivia)** | `luis@chaperia.com` | `123456` | `ADMIN_BOLIVIA` |
| **Alfredo (Jefe Taller Chile)** | `alfredo@chaperia.com` | `123456` | `ENCARGADO_CHILE` |

---

## 2. Guía Paso a Paso para el Encargado en Chile (Alfredo)

1. **Recepción y Check-in Fotográfico:**
   * En la pestaña **2. Traspaso & Check-in**, registra los datos del vehículo (VIN/Chasis, Lote/Placa, Marca, Modelo).
   * Marca qué accesorios trae el auto al cruzar la puerta (*Llanta de auxilio, Gata, Pisos, Radio original, Estado de faroles y Airbags*).
   * Sube las fotos desde tu celular o PC: el sistema las comprime automáticamente a formato **`.webp` (~100 KB)** sin llenar el servidor.
2. **Cotización y Doble Firma (Amarillo $\rightarrow$ Verde):**
   * En la pestaña **3. Cotizador**, cuando Bolivia negocie un descuento con el cliente, la cotización aparecerá en **Amarillo (`CAMBIOS REALIZADOS`)**.
   * Revisa el nuevo acuerdo y presiona **`🇨🇱 Aceptar Cambios (Firma Alfredo Chile → Verde)`** para activar la Orden de Trabajo.
3. **Avance de Órdenes de Trabajo (`%`):**
   * En la pestaña **4. Avance OT**, tiquea cada tarea conforme los chaperos, pintores y talleres externos vayan terminando.
   * La barra de progreso subirá automáticamente de `0%` a `100%`. Al llegar a `100%`, el sistema avisa automáticamente a Luis en Bolivia.
4. **Repuestos, Almacén y Baja de Herramientas:**
   * En las pestañas **5 y 6**, registra los repuestos que van llegando con su **código de serie y foto**, las salidas de lijas/gasolina por auto, las facturas de pintura del colorista y cualquier baja de herramienta rota adjuntando foto.

---

## 3. Guía Paso a Paso para la Administración en Bolivia (Dueño, Luis, Marcelo)

1. **Monitoreo en Tiempo Real (Sin apretar F5):**
   * Puedes dejar el sistema abierto toda la mañana en tu monitor. Gracias al canal **SSE (Server-Sent Events)** conectado a los **Signals de Angular**, cada alerta o cambio hecho en Chile aparece en menos de 1 segundo sin recargar la página.
2. **Cambio de Moneda (`USD` $\leftrightarrow$ `CLP`):**
   * En la esquina superior derecha puedes alternar en vivo entre **Dólares (`USD $`)** y **Pesos Chilenos (`CLP $`)**.
3. **Edición de Cotizaciones y Auditoría:**
   * Si el cliente pide rebaja, edita el monto acordado en la pestaña **3. Cotizador**. El sistema conserva siempre el **Monto Original** y registra quién autorizó el cambio en Bolivia.
4. **Prórrogas Justificadas, Multas y Reasignación:**
   * En la pestaña **4. Avance OT**, cuando un contratista se atrase:
     * Haz clic en **`🌧️ +2d Prórroga`** si hubo lluvia, falta de oxígeno o falta de pintura.
     * Haz clic en **`💸 Multar`** para descontar automáticamente `-$20/día` de su liquidación.
     * Haz clic en **`🔄 Reasignar Técnico`** para pasar el trabajo a otro chapero o taller externo.
5. **Costeo e Informe Final PDF al Cliente:**
   * En la pestaña **7. Costeo & Informe PDF**, revisa la rentabilidad por auto y presiona **`🖨️ Imprimir / Exportar Informe PDF`** para enviarle el reporte al cliente.

