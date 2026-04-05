import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface CartState {
  items: CartItem[];
  paymentMethod: 'CASH' | 'CARD' | 'MOMO';
  addItem: (item: Omit<CartItem, 'discount'>) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  setPaymentMethod: (method: 'CASH' | 'CARD' | 'MOMO') => void;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
}

const TAX_RATE = 0.20;

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  paymentMethod: 'CASH',

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          ),
        };
      }
      return { items: [...state.items, { ...item, discount: 0 }] };
    });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      set((state) => ({
        items: state.items.filter((i) => i.productId !== productId),
      }));
    } else {
      set((state) => ({
        items: state.items.map((i) =>
          i.productId === productId ? { ...i, quantity } : i
        ),
      }));
    }
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((i) => i.productId !== productId),
    }));
  },

  clearCart: () => set({ items: [], paymentMethod: 'CASH' }),

  setPaymentMethod: (method) => set({ paymentMethod: method }),

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  },

  getTax: () => {
    return get().getSubtotal() * TAX_RATE;
  },

  getTotal: () => {
    return get().getSubtotal() + get().getTax();
  },
}));

export function generateLocalSaleId(): string {
  return uuidv4();
}