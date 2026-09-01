'use client';

import { useState } from 'react';

import type { Building } from '@/lib/types';
import { Modal } from './Modal';
import { AddBuildingForm } from './AddBuildingForm';
import { CsvImportWizard } from './CsvImportWizard';
import { BulkImageUpload } from './BulkImageUpload';

import styles from './UploadModal.module.css';

interface UploadModalProps {
  buildings: Building[];
  onClose: () => void;
  onCreated: (building: Building) => void;
  onImported: () => void;
  onImagesUploaded: () => void;
}

type Tab = 'add' | 'csv' | 'images';

export function UploadModal({ buildings, onClose, onCreated, onImported, onImagesUploaded }: UploadModalProps) {
  const [tab, setTab] = useState<Tab>('add');

  return (
    <Modal onClose={onClose} size="lg">
      <div className={styles.tabs}>
        <button className={tab === 'add' ? styles.tabActive : styles.tab} onClick={() => setTab('add')}>
          Add building
        </button>
        <button className={tab === 'csv' ? styles.tabActive : styles.tab} onClick={() => setTab('csv')}>
          Import CSV
        </button>
        <button className={tab === 'images' ? styles.tabActive : styles.tab} onClick={() => setTab('images')}>
          Bulk images
        </button>
      </div>

      {tab === 'add' && <AddBuildingForm onCreated={onCreated} onCancel={onClose} />}
      {tab === 'csv' && <CsvImportWizard onImported={onImported} onCancel={onClose} />}
      {tab === 'images' && <BulkImageUpload buildings={buildings} onDone={onImagesUploaded} onCancel={onClose} />}
    </Modal>
  );
}
