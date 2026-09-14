'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { AppHeader } from '@/components/shell/AppHeader';
import { BottomNav, TabType } from '@/components/shell/BottomNav';
import { AttendanceTab } from '@/components/attendance/AttendanceTab';
import { ReportsTab } from '@/components/reports/ReportsTab';
import SettingsTab from '@/components/settings/SettingsTab';
import { getBangkokToday, getBangkokMonth } from '@/lib/payroll/dates';
import { ShieldAlert, LogOut } from 'lucide-react';
import styles from '@/components/shell/shell.module.css';

export default function HomePage() {
  const router = useRouter();
  const { user, idToken, isOwner, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('attendance');
  const [shopName, setShopName] = useState<string>('DE TEAM');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!idToken) return;
    fetch('/api/bootstrap', {
      headers: { Authorization: `Bearer ${idToken}` }
    })
      .then(res => res.json())
      .then(json => {
        const data = json.data || json;
        const profile = data.profile || data.shop;
        if (profile?.shopName || profile?.displayName) {
          setShopName(profile.shopName || profile.displayName);
        }
      })
      .catch(() => {});
  }, [idToken]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--team-bg)',
          color: 'var(--team-primary-dark)',
          fontFamily: 'var(--team-font-family)',
          padding: '1.5rem'
        }}
      >
        <div
          style={{
            width: '3rem',
            height: '3rem',
            border: '4px solid var(--team-border-strong)',
            borderTopColor: 'var(--team-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '1rem'
          }}
        />
        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
          กำลังตรวจสอบสิทธิ์การใช้งาน...
        </div>
        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Not owner guard
  if (!isOwner) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--team-bg)',
          color: 'var(--team-primary-dark)',
          fontFamily: 'var(--team-font-family)',
          padding: '1.5rem',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            width: '4.5rem',
            height: '4.5rem',
            borderRadius: '50%',
            backgroundColor: 'var(--team-absent-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.2rem',
            color: 'var(--team-absent)'
          }}
        >
          <ShieldAlert size={40} />
        </div>
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.8rem', fontWeight: 700 }}>
          ไม่มีสิทธิ์เข้าถึงระบบ
        </h1>
        <p
          style={{
            fontSize: '1rem',
            color: 'var(--team-text)',
            maxWidth: '24rem',
            margin: '0 0 1.5rem',
            lineHeight: 1.6
          }}
        >
          บัญชี Google นี้ไม่ได้ลงทะเบียนเป็นเจ้าของระบบ กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับอนุญาต
        </p>
        <div style={{ fontSize: '0.9rem', color: 'var(--team-muted)', marginBottom: '1.5rem' }}>
          อีเมล: {user.email}
        </div>
        <button
          onClick={() => logout()}
          style={{
            minHeight: '3.467rem',
            padding: '0 1.5rem',
            backgroundColor: 'var(--team-primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--team-radius-button)',
            fontSize: '1.067rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer'
          }}
        >
          <LogOut size={20} />
          ออกจากระบบ
        </button>
      </div>
    );
  }

  const today = getBangkokToday();
  const month = getBangkokMonth();

  return (
    <div className={styles.appContainer}>
      <AppHeader shopName={shopName} />

      <main className={styles.mainContent}>
        {/* In-memory tab display caching to preserve scroll and state without re-render lag */}
        <div style={{ display: activeTab === 'attendance' ? 'block' : 'none' }}>
          <AttendanceTab
            initialDate={today}
            serverToday={today}
            onNavigateToSettings={() => setActiveTab('settings')}
          />
        </div>
        <div style={{ display: activeTab === 'reports' ? 'block' : 'none' }}>
          <ReportsTab initialMonth={month} serverToday={today} />
        </div>
        <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
          <SettingsTab onUpdateShopName={setShopName} />
        </div>
      </main>

      <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
    </div>
  );
}
