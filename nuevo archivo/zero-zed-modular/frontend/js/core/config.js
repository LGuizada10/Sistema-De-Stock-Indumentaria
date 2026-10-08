// [ZZ] core/config.js — Constantes de configuración: claves de almacenamiento, categorías por defecto, métodos de pago, límites.
/* ---------- estado ---------- */
const STORAGE_KEY = 'controlLocal_zerozed_v1';
const STORAGE_BACKUP_KEY = 'controlLocal_zerozed_backup_v1';
const THEME_STORAGE_KEY = 'controlLocal_zerozed_theme_v1';
const DEFAULT_CATEGORIAS = ["Pantalones","Jeans","Shorts","Medias","Cadenitas","Pulseras","Bolsos/Riñoneras","Gorras","Otros"];
const METODOS = ["Efectivo","Mercado Pago","Débito","Crédito"];
/* ---------- registro de movimientos (solo lo ve el administrador en Ajustes) ---------- */
const MAX_MOVIMIENTOS = 2000;
const LOW_STOCK = 2;

/* ---------- utilidades ---------- */
const MAX_SEARCH_ITEMS = 10;
const MAX_SEARCH_ROWS = 10;
const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
