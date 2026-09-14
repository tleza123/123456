'use client';

import React from 'react';
import styles from './shell.module.css';

interface AppHeaderProps {
  shopName?: string;
  isClosed?: boolean;
}

export function AppHeader({ shopName = 'DE TEAM', isClosed = false }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        DE <span>TEAM</span>
      </div>
      <div className={styles.shopName}>
        {shopName}
        {isClosed && ' · เดือนปิดแล้ว'}
      </div>
    </header>
  );
}
