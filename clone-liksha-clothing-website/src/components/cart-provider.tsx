"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type MiniProduct = {
  handle: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  image: string;
  size?: string;
};

export type MiniCartLine = MiniProduct & { key: string; quantity: number };

type CartContextValue = {
  lines: MiniCartLine[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  addItem: (product: MiniProduct, quantity?: number) => void;
  removeLine: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  openCart: () => void;
  closeCart: () => void;
  clear: () => void;
  lastAdded: MiniCartLine | null;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "liksha:cart:v1";

function readStorage(): MiniCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MiniCartLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((line) => line && line.handle && line.quantity > 0);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<MiniCartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<MiniCartLine | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLines(readStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* ignore quota errors */
    }
  }, [lines, hydrated]);

  const addItem = useCallback((product: MiniProduct, quantity = 1) => {
    const size = product.size ?? "Free Size";
    const key = `${product.handle}::${size}`;
    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) =>
          line.key === key
            ? { ...line, quantity: Math.min(line.quantity + quantity, 10) }
            : line,
        );
      }
      return [...current, { ...product, size, key, quantity }];
    });
    setLastAdded({ ...product, size, key, quantity });
    setIsOpen(true);
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.key !== key)
        : current.map((line) =>
            line.key === key ? { ...line, quantity: Math.min(quantity, 10) } : line,
          ),
    );
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    return {
      lines,
      count,
      subtotal,
      isOpen,
      addItem,
      removeLine,
      setQuantity,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      clear: () => setLines([]),
      lastAdded,
    };
  }, [lines, isOpen, addItem, removeLine, setQuantity, lastAdded]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
