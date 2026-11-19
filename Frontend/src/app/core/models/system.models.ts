export type RolSistema = 'SUPERADMIN_BOLIVIA' | 'ADMIN_BOLIVIA' | 'ENCARGADO_CHILE';

export interface ActiveUser {
  id: string;
  nombreCompleto: string;
  email: string;
  rol: RolSistema;
  pais: 'BOLIVIA' | 'CHILE';
  permisos?: {
    accesoOperativoCompleto: boolean;
    puedeVerReportesEInformeFinal: boolean;
  };
}

export type ModuloEvidencia =
  | 'CHECKIN_RECEPCION'
  | 'DESARME_COTIZACION'
  | 'REPUESTOS_CUENTAGOTAS'
  | 'FACTURA_INSUMO_COLORISTA'
  | 'BAJA_HERRAMIENTA'
  | 'TRASPASO_NAVIERA'
  | 'ENTREGA_FINAL';

export type ModuloDestinoTab =
  | 'dashboard'
  | 'recepcion'
  | 'cotizacion'
  | 'ordenes'
  | 'repuestos'
  | 'almacen'
  | 'herramientas'
  | 'reportes';

export interface NotificacionItem {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  destinoRol: 'TODOS' | 'BOLIVIA' | 'CHILE';
  moduloDestino: ModuloDestinoTab | string;
  vehiculoId?: string | null;
  referenciaId?: string | null;
  subTabDestino?: string | null;
  actorEmail?: string | null;
  actorNombre?: string | null;
  leida: boolean;
  leidaEn?: string | null;
  creadoEn: string;
}

export interface LiveToastPayload {
  id?: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  destinoRol?: 'TODOS' | 'BOLIVIA' | 'CHILE';
  moduloDestino?: ModuloDestinoTab | string;
  vehiculoId?: string | null;
  referenciaId?: string | null;
  subTabDestino?: string | null;
  actorEmail?: string | null;
  actorNombre?: string | null;
  leida?: boolean;
  creadoEn?: string;
}

export interface UsuarioSistemaItem {
  id: string;
  nombreCompleto: string;
  email: string;
  rol: RolSistema;
  pais: 'BOLIVIA' | 'CHILE';
  activo: boolean;
  creadoEn: string;
}

export interface EvidenciaFotograficaItem {
  id: string;
  moduloOrigen: ModuloEvidencia;
  referenciaId?: string;
  vehiculoReferencia: string;
  tituloDetalle: string;
  descripcionBreve: string;
  archivoWebpUrl: string;
  nombreArchivo: string;
  pesoOriginalKb: number;
  pesoWebpKb: number;
  subidoPor: string;
  paisOrigen: 'BOLIVIA' | 'CHILE';
  creadoEn: string;
}

export type ModuloAuditoria =
  | 'RECEPCION'
  | 'COTIZACION'
  | 'ORDEN_TRABAJO'
  | 'REPUESTOS'
  | 'ALMACEN_INSUMOS'
  | 'HERRAMIENTAS'
  | 'CONFIGURACION';

export interface HistorialEdicionItem {
  id: string;
  modulo: ModuloAuditoria;
  entidadReferencia: string;
  tipoAccion: string;
  valorAnterior: string;
  valorNuevo: string;
  motivoEdicion: string;
  editadoPor: string;
  aprobadoPor: string;
  evidenciaFotoUrl?: string;
  evidenciaDescripcion?: string;
  bloqueadoContraBorrado: boolean;
  fechaRegistro: string;
}

// Especialidades de técnico que pueden ejecutar cada tipo de tarea de la OT.
// El chapero y el pintor son personas distintas: el pintor controla la calidad del chapeado.
export const ESPECIALIDADES_POR_TIPO_TAREA: Record<string, string[]> = {
  CHAPERIA: ['CHAPERO'],
  PINTURA: ['PINTOR'],
  MECANICA: ['MECANICO_PLANTA'],
  SERVICIO_EXTERNO: ['AIRBAG_PLASTICOS_EXTERNO', 'ELECTRICO_EXTERNO', 'SOLDADOR_EXTERNO'],
  CONTROL_FINAL: [
    'CHAPERO',
    'PINTOR',
    'MECANICO_PLANTA',
    'AIRBAG_PLASTICOS_EXTERNO',
    'ELECTRICO_EXTERNO',
    'SOLDADOR_EXTERNO',
  ],
};

export const ETIQUETA_TIPO_TAREA: Record<string, string> = {
  CHAPERIA: 'Chapería',
  PINTURA: 'Pintura',
  MECANICA: 'Mecánica',
  SERVICIO_EXTERNO: 'Servicio externo',
  CONTROL_FINAL: 'Control final',
};

export interface MenuModuleItem {
  id: string;
  numero: number;
  icono: string;
  titulo: string;
  subtitulo: string;
  soloBolivia?: boolean;
}

