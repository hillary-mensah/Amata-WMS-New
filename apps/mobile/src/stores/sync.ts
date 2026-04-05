import { create } from 'zustand';
import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

interface SaleItem {
  id: string;
  localId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
}

interface PendingSale {
  id: string;
  localId: string;
  idempotencyKey: string;
  branchId: string;
  items: SaleItem[];
  paymentMethod: string;
  totalAmount: number;
  status: 'pending' | 'synced' | 'failed';
  createdAt: string;
  syncedAt?: string;
  error?: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  unitPrice: number;
  quantity: number;
}

interface SyncState {
  db: SQLite.SQLiteDatabase | null;
  pendingSales: PendingSale[];
  products: Product[];
  isOnline: boolean;
  lastSyncAt: string | null;
  initDatabase: () => Promise<void>;
  addPendingSale: (sale: Omit<PendingSale, 'id' | 'syncedAt' | 'error'>) => Promise<void>;
  getPendingSales: () => Promise<PendingSale[]>;
  updateSaleStatus: (localId: string, status: 'synced' | 'failed', error?: string) => Promise<void>;
  saveProducts: (products: Product[]) => Promise<void>;
  getProducts: () => Promise<Product[]>;
  setOnline: (online: boolean) => void;
  setLastSyncAt: (date: string) => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  db: null,
  pendingSales: [],
  products: [],
  isOnline: true,
  lastSyncAt: null,

  initDatabase: async () => {
    try {
      const db = await SQLite.openDatabase({
        name: 'nexusos.db',
        location: 'default',
      });

      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS pending_sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          localId TEXT UNIQUE NOT NULL,
          idempotencyKey TEXT NOT NULL,
          branchId TEXT NOT NULL,
          items TEXT NOT NULL,
          paymentMethod TEXT NOT NULL,
          totalAmount REAL NOT NULL,
          status TEXT DEFAULT 'pending',
          createdAt TEXT NOT NULL,
          syncedAt TEXT,
          error TEXT
        )
      `);

      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          sku TEXT NOT NULL,
          barcode TEXT,
          unitPrice REAL NOT NULL,
          quantity INTEGER DEFAULT 0,
          updatedAt TEXT
        )
      `);

      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);

      const [sales] = await db.executeSql('SELECT * FROM pending_sales WHERE status = ?', ['pending']);
      const pendingSales: PendingSale[] = [];
      for (let i = 0; i < sales.rows.length; i++) {
        const row = sales.rows.item(i);
        pendingSales.push({
          ...row,
          items: JSON.parse(row.items),
        });
      }

      const [prods] = await db.executeSql('SELECT * FROM products');
      const products: Product[] = [];
      for (let i = 0; i < prods.rows.length; i++) {
        products.push(prods.rows.item(i));
      }

      set({ db, pendingSales, products });
      console.log('SQLite database initialized');
    } catch (error) {
      console.error('Failed to init database:', error);
    }
  },

  addPendingSale: async (sale) => {
    const { db } = get();
    if (!db) return;

    const id = Date.now().toString();
    await db.executeSql(
      `INSERT INTO pending_sales (localId, idempotencyKey, branchId, items, paymentMethod, totalAmount, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sale.localId, sale.idempotencyKey, sale.branchId, JSON.stringify(sale.items), sale.paymentMethod, sale.totalAmount, 'pending', sale.createdAt]
    );

    set((state) => ({
      pendingSales: [...state.pendingSales, { ...sale, id, status: 'pending' }],
    }));
  },

  getPendingSales: async () => {
    const { db } = get();
    if (!db) return [];

    const [result] = await db.executeSql('SELECT * FROM pending_sales WHERE status = ?', ['pending']);
    const sales: PendingSale[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      sales.push({ ...row, items: JSON.parse(row.items) });
    }
    return sales;
  },

  updateSaleStatus: async (localId, status, error) => {
    const { db } = get();
    if (!db) return;

    const syncedAt = status === 'synced' ? new Date().toISOString() : null;
    await db.executeSql(
      'UPDATE pending_sales SET status = ?, syncedAt = ?, error = ? WHERE localId = ?',
      [status, syncedAt, error || null, localId]
    );

    set((state) => ({
      pendingSales: state.pendingSales.map((s) =>
        s.localId === localId ? { ...s, status, syncedAt: syncedAt || undefined, error } : s
      ),
    }));
  },

  saveProducts: async (products) => {
    const { db } = get();
    if (!db) return;

    for (const p of products) {
      await db.executeSql(
        `INSERT OR REPLACE INTO products (id, name, sku, barcode, unitPrice, quantity, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.name, p.sku, p.barcode || null, p.unitPrice, p.quantity, new Date().toISOString()]
      );
    }

    set({ products });
  },

  getProducts: async () => {
    const { db } = get();
    if (!db) return [];

    const [result] = await db.executeSql('SELECT * FROM products ORDER BY name');
    const prods: Product[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      prods.push(result.rows.item(i));
    }
    return prods;
  },

  setOnline: (online) => set({ isOnline: online }),
  setLastSyncAt: (date) => set({ lastSyncAt: date }),
}));