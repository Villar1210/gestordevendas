// src/features/pdf_tools/components/options/controls.tsx
// Controles de formulario compartilhados pelos paineis de opcoes.
"use client";

import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { usePdfToolsStore } from "../../store/usePdfToolsStore";
import type { OptionValue } from "../../types";

export function useOption<T extends OptionValue>(key: string, fallback: T): [T, (value: T) => void] {
  const value = usePdfToolsStore((s) => s.options[key]);
  const setOption = usePdfToolsStore((s) => s.setOption);
  return [(value === undefined ? fallback : value) as T, (v: T) => setOption(key, v)];
}

export function Fieldset({ legend, children, hint }: { legend: string; children: ReactNode; hint?: string }) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-2.5 text-sm font-semibold text-slate-800">{legend}</legend>
      {children}
      {hint && <p className="text-xs leading-relaxed text-slate-500">{hint}</p>}
    </fieldset>
  );
}

export interface RadioOption<T extends string | number> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export function RadioCards<T extends string | number>({
  name,
  legend,
  options,
  value,
  onChange,
  columns = 1,
  hint,
}: {
  name: string;
  legend: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
  hint?: string;
}) {
  const grid = columns === 3 ? "grid-cols-3" : columns === 2 ? "grid-cols-2" : "grid-cols-1";
  return (
    <Fieldset legend={legend} hint={hint}>
      <div className={`grid gap-2 ${grid}`}>
        {options.map((opt) => {
          const checked = opt.value === value;
          return (
            <label
              key={String(opt.value)}
              className={`relative flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-500 ${
                checked ? "border-blue-600 bg-blue-50/70 ring-1 ring-inset ring-blue-600" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={String(opt.value)}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.icon && <span className={checked ? "text-blue-700" : "text-slate-400"}>{opt.icon}</span>}
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${checked ? "text-blue-900" : "text-slate-800"}`}>{opt.label}</span>
                {opt.description && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{opt.description}</span>}
              </span>
              {columns === 1 && (
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    checked ? "border-blue-700" : "border-slate-300"
                  }`}
                >
                  {checked && <span className="h-2 w-2 rounded-full bg-blue-700" />}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </Fieldset>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  maxLength,
  inputMode,
  type = "text",
  autoComplete = "off",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  maxLength?: number;
  inputMode?: "text" | "numeric";
  type?: "text" | "number";
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-hint` : undefined}
        className={`h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 ${
          error ? "border-rose-400 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
        }`}
      />
      {(hint || error) && (
        <p id={`${id}-hint`} className={`mt-1.5 text-xs leading-relaxed ${error ? "text-rose-600" : "text-slate-500"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "new-password" | "current-password";
  hint?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          maxLength={64}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-3.5 pr-11 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
          checked ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}
