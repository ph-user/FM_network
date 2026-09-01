'use client';

import { useEffect } from 'react';

import styles from './Modal.module.css';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** 'sm' (default) fits a confirmation prompt; 'lg' fits a form or table. */
  size?: 'sm' | 'lg';
}

export function Modal({ onClose, children, size = 'sm' }: ModalProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={size === 'lg' ? styles.dialogLarge : styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}
