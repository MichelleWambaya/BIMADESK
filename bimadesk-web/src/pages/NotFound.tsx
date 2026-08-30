import React from "react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-5">
      <div className="text-center">
        <p className="font-display text-6xl text-violet-200">404</p>
        <p className="text-[16px] font-semibold mt-3">This page does not exist</p>
        <p className="text-[13.5px] text-ink-soft mt-1">Check the address, or head back to somewhere useful.</p>
        <Link to="/" className="wb-btn-primary inline-flex mt-5">Go home</Link>
      </div>
    </div>
  );
}
