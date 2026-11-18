"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  addToCartAction,
  getCartAction,
  removeLineAction,
  updateLineAction,
} from "@/lib/commerce/actions";
import type {
  Cart,
  CartLine,
  LineAttributes,
  Product,
  Variant,
} from "@/lib/commerce/types";

/** What the cart draws the new line from before the server has answered. */
export type AddPreview = {
  product: Pick<Product, "handle" | "title" | "images">;
  variant: Variant;
};

type CartState = {
  cart: Cart | null;
  /** False until the server has answered once — the drawer shows shapes, not "empty". */
  loaded: boolean;
  isOpen: boolean;
  isBusy: boolean;
  /** One quiet line in the drawer when the server couldn't do what the screen already showed. */
  notice: string | null;
  /** Fires the sparkle — the brand mark appears at the moment of purchase. */
  justAdded: number;
  open: () => void;
  close: () => void;
  /**
   * With a `preview`, the line appears in the cart the instant you tap and
   * the server confirms behind it (optimistic). Without one it waits.
   */
  add: (
    variantId: string,
    quantity: number,
    attributes?: LineAttributes,
    preview?: AddPreview,
  ) => Promise<void>;
  update: (lineId: string, quantity: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
  /** After an order is placed — the server has already dropped the cart. */
  clear: () => void;
};

const CartContext = createContext<CartState | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

const EMPTY: Cart = {
  id: "",
  lines: [],
  totalQuantity: 0,
  subtotal: { cents: 0, currency: "USD" },
  checkoutUrl: "#checkout",
};

/**
 * The cart as it will look once the server agrees — same merge rule as the
 * server: the same variant with the same print is one line.
 */
function withLine(
  cart: Cart | null,
  { product, variant }: AddPreview,
  quantity: number,
  attributes: LineAttributes,
): Cart {
  const base = cart ?? EMPTY;
  const key = JSON.stringify(attributes);
  const lines = base.lines.map((l) => ({ ...l }));
  const existing = lines.find(
    (l) => l.variant.id === variant.id && JSON.stringify(l.attributes) === key,
  );
  if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
  else {
    const line: CartLine = {
      id: `pending-${Date.now()}`,
      quantity,
      variant,
      product: { handle: product.handle, title: product.title, images: product.images },
      attributes,
    };
    lines.push(line);
  }
  return {
    ...base,
    lines,
    totalQuantity: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: {
      cents: lines.reduce((n, l) => n + l.variant.price.cents * l.quantity, 0),
      currency: variant.price.currency,
    },
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isOpen, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(0);
  const [isBusy, startTransition] = useTransition();
  // The latest cart, readable inside the stable callbacks below.
  const latest = useRef<Cart | null>(null);
  useEffect(() => {
    latest.current = cart;
  }, [cart]);

  useEffect(() => {
    let cancelled = false;
    getCartAction()
      .then((c) => {
        if (cancelled) return;
        if (c) setCart(c);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const add = useCallback(
    async (
      variantId: string,
      quantity: number,
      attributes: LineAttributes = {},
      preview?: AddPreview,
    ) => {
      const before = latest.current;
      if (preview) {
        // Show it now; confirm behind.
        setCart(withLine(before, preview, quantity, attributes));
        setJustAdded((n) => n + 1);
        setOpen(true);
      }
      try {
        const next = await addToCartAction(variantId, quantity, attributes);
        startTransition(() => {
          setCart(next);
          if (!preview) {
            setJustAdded((n) => n + 1);
            setOpen(true);
          }
        });
      } catch {
        setCart(before);
        setNotice("That didn\u2019t go through. Try again.");
      }
    },
    [],
  );

  const update = useCallback(async (lineId: string, quantity: number) => {
    // A line the server hasn't confirmed yet can't be changed on it either.
    if (lineId.startsWith("pending-")) return;
    const next = await updateLineAction(lineId, quantity);
    startTransition(() => setCart(next));
  }, []);

  const remove = useCallback(async (lineId: string) => {
    if (lineId.startsWith("pending-")) return;
    const next = await removeLineAction(lineId);
    startTransition(() => setCart(next));
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        loaded,
        isOpen,
        isBusy,
        notice,
        justAdded,
        open: () => setOpen(true),
        close: () => setOpen(false),
        add,
        update,
        remove,
        clear: () => setCart(null),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
