import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/**
 * Keeps post-auth navigation inside the application that received the login.
 * External URLs, protocol-relative values, and malformed paths fall back home.
 */
export function safeInternalPath(value: string | null | undefined, fallback = "/") {
  if (!value) return fallback;
  try {
    const candidate = new URL(value, "https://asex.local");
    if (candidate.origin !== "https://asex.local") return fallback;
    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return fallback;
  }
}

export function Button({ className = "", onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`asex-button ${className}`} onClick={onClick} {...props} />;
}

export function Field({ id: suppliedId, label, error, children, hint }: { id?: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  const id = suppliedId ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return <div className="asex-field"><label htmlFor={id}>{label}</label>{children}{hint ? <p className="asex-hint">{hint}</p> : null}{error ? <p id={`${id}-error`} className="asex-error" role="alert">{error}</p> : null}</div>;
}

export function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="asex-input" type="number" step="0.01" min="0" inputMode="decimal" {...props} />;
}

export function StatusMessage({ children }: { children: ReactNode }) { return <p className="asex-status" aria-live="polite">{children}</p>; }
