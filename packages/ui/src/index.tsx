import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

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
