import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { createPortal } from "react-dom";

interface CustomFieldDropdownProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function CustomFieldDropdown({
  options,
  value,
  onChange,
  placeholder = "Alan seçin...",
  disabled = false,
}: CustomFieldDropdownProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const containerRef = useRef<HTMLDivElement>(null);
  const filtered = options.filter(opt => opt.toLowerCase().includes(inputValue.toLowerCase()));
  const [dropdownPos, setDropdownPos] = useState<{left: number, top: number, width: number} | null>(null);

  // Parent value değişirse inputValue'yu güncelle
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  // Dropdown pozisyonu
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        left: rect.left + window.scrollX,
        top: rect.bottom + window.scrollY,
        width: rect.width,
      });
    }
  }, [open]);

  // Dışarı tıklayınca kapansın
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Blur olduğunda listedekilerden biriyle tam eşleşmiyorsa inputu ve parent'ı temizle
  const handleBlur = () => {
    setTimeout(() => {
      if (!options.includes(inputValue)) {
        setInputValue("");
        onChange("");
      }
      setOpen(false);
    }, 100);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <input
        type="text"
        className={clsx(
          "flex items-center w-full h-12 px-4 rounded-lg border-2 border-primary bg-background text-base text-left transition focus:outline-none focus:ring-2 focus:ring-primary",
          disabled && "opacity-60 cursor-not-allowed"
        )}
        value={inputValue}
        onChange={e => {
          setInputValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled || !!value}
        autoComplete="off"
      />
      {inputValue && !disabled && (
        <X
          className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive cursor-pointer"
          onClick={e => {
            e.stopPropagation();
            setInputValue("");
            onChange("");
          }}
        />
      )}
      {open && dropdownPos && typeof window !== 'undefined' && filtered.length > 0 && createPortal(
        <div
          className="z-[9999] rounded-xl shadow-2xl border bg-card animate-fade-in-up transition-all duration-200"
          style={{
            position: 'absolute',
            left: dropdownPos.left,
            top: dropdownPos.top,
            width: dropdownPos.width,
            minWidth: 240,
          }}
        >
          <ul className="max-h-64 overflow-y-auto py-2">
            {filtered.map(opt => (
              <li
                key={opt}
                className={clsx(
                  "px-4 py-2 cursor-pointer rounded transition text-sm",
                  value === opt
                    ? "bg-primary text-white font-semibold"
                    : "hover:bg-muted hover:text-primary"
                )}
                onMouseDown={() => {
                  setInputValue(opt);
                  onChange(opt);
                  setOpen(false);
                }}
              >
                {opt}
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
} 