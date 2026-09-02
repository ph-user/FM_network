'use client';

import { useMemo, useRef, useState } from 'react';

import styles from './MultiSelect.module.css';

interface MultiSelectProps {
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  placeholder?: string;
}

/** Search-to-filter dropdown that adds to a multi-select instead of replacing it. */
export function MultiSelect({ options, selected, onChange, placeholder }: MultiSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !selected.has(o) && (!q || o.toLowerCase().includes(q)));
  }, [options, selected, query]);

  function add(option: string) {
    const next = new Set(selected);
    next.add(option);
    onChange(next);
    setQuery('');
  }

  function remove(option: string) {
    const next = new Set(selected);
    next.delete(option);
    onChange(next);
  }

  function onBlur(event: React.FocusEvent) {
    // Let a click on a dropdown option register before closing.
    if (!containerRef.current?.contains(event.relatedTarget as Node)) {
      setOpen(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' && matches.length > 0) {
      event.preventDefault();
      add(matches[0]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrap} ref={containerRef} onBlur={onBlur}>
      {selected.size > 0 && (
        <div className={styles.chips}>
          {Array.from(selected).map((value) => (
            <span key={value} className={styles.chip}>
              {value}
              <button type="button" className={styles.chipRemove} onClick={() => remove(value)} aria-label={`Remove ${value}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        className="input"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />

      {open && matches.length > 0 && (
        <div className={styles.dropdown}>
          {matches.map((option) => (
            <button type="button" key={option} className={styles.option} onClick={() => add(option)}>
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
