// src/features/imoveis/components/StatusPopover.tsx
import { STATUS_OPTIONS } from "../constants";

interface StatusPopoverProps {
  onSelect: (status: string) => void;
  onClose: () => void;
}

export function StatusPopover({ onSelect, onClose }: StatusPopoverProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-1/2 top-full z-50 mt-2 w-44 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50"
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${opt.solidClassName}`} />
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
}
