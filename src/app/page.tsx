import { Suspense } from 'react';

import { requireSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { toClientBuilding } from '@/lib/types';
import { SignOutButton } from '@/components/SignOutButton';
import { BuildingExplorer } from '@/components/BuildingExplorer';
import { UploadControl } from '@/components/UploadControl';

import styles from './shell.module.css';

export default async function HomePage() {
  const { role } = await requireSession();

  const { data, error } = await supabase.from('buildings').select('*').order('name');
  if (error) throw error;
  const buildings = (data ?? []).map(toClientBuilding);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.wordmark}>Focus Media</h1>
        <span className={styles.divider} aria-hidden="true" />
        <p className={styles.section}>Building network</p>

        <div className={styles.headerRight}>
          <span className={styles.role}>
            Signed in as {role}
          </span>
          {role === 'editor' && <UploadControl buildings={buildings} />}
          <SignOutButton />
        </div>
      </header>

      <div className={styles.body}>
        <Suspense
          fallback={
            <>
              <aside className={styles.filters} />
              <main className={styles.map} />
            </>
          }
        >
          <BuildingExplorer buildings={buildings} role={role} />
        </Suspense>
      </div>
    </div>
  );
}
