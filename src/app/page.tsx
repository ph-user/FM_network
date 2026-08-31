import { requireSession } from '@/lib/auth';
import { SignOutButton } from '@/components/SignOutButton';

import styles from './shell.module.css';

export default async function HomePage() {
  const { role } = await requireSession();

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
          {role === 'editor' && (
            <button className="btn" disabled>
              Upload
            </button>
          )}
          <SignOutButton />
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.filters}>
          <p className={styles.placeholder}>Filters</p>
        </aside>

        <main className={styles.map}>
          <p className={styles.placeholder}>Map</p>
        </main>

        <aside className={styles.info}>
          <p className={styles.placeholder}>
            Select a building to see its details.
          </p>
        </aside>
      </div>
    </div>
  );
}
