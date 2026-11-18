"use client";

import { useCart } from "./CartProvider";

export function CartButton() {
  const { cart, open } = useCart();
  return (
    <button type="button" onClick={open} className="link-hover">
      Cart ({cart?.totalQuantity ?? 0})
    </button>
  );
}
