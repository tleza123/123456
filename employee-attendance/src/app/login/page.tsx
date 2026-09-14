'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import styles from './login.module.css';

export default function LoginPage() {
  const { user, isOwner, loading, signIn, logout } = useAuth();
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async () => {
    setErrorMsg(null);
    try {
      await signIn();
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        setErrorMsg('เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ กรุณาอนุญาตหน้าต่างป็อปอัปแล้วลองอีกครั้ง');
      } else {
        setErrorMsg('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.brand}>
            DE <span>TEAM</span>
          </div>
          <p className={styles.statusText}>กำลังตรวจสอบการเข้าสู่ระบบ...</p>
        </div>
      </div>
    );
  }

  // If authenticated and is owner, allow entering the app
  if (user && isOwner) {
    router.push('/');
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.brand}>
            DE <span>TEAM</span>
          </div>
          <p className={styles.statusText}>ยินดีต้อนรับ กำลังเข้าสู่ระบบ...</p>
        </div>
      </div>
    );
  }

  // If authenticated but NOT owner
  if (user && !isOwner) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.brand}>
            DE <span>TEAM</span>
          </div>
          <div className={styles.notice}>
            <strong>บัญชีนี้ไม่มีสิทธิ์ใช้งานระบบ</strong>
            <p>ระบบอนุญาตให้เฉพาะบัญชีผู้ดูแลกิจการเข้าใช้งานเท่านั้น</p>
          </div>
          <button type="button" className={styles.primaryBtn} onClick={logout}>
            เปลี่ยนบัญชี
          </button>
        </div>
      </div>
    );
  }

  // Not authenticated
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brand}>
          DE <span>TEAM</span>
        </div>
        <h1 className={styles.title}>เข้าสู่ระบบ</h1>
        <p className={styles.subtitle}>ระบบเช็คชื่อพนักงานและคำนวณค่าจ้าง</p>

        {errorMsg && <div className={styles.errorAlert}>{errorMsg}</div>}

        <button type="button" className={styles.googleBtn} onClick={handleSignIn}>
          <svg className={styles.googleIcon} viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          เข้าสู่ระบบด้วย Google
        </button>
      </div>
    </div>
  );
}
