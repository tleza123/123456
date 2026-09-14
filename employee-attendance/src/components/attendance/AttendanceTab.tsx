'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { formatThaiDate } from '@/lib/payroll/dates';
import styles from './attendance.module.css';

interface AttendanceItem {
  employee: {
    employeeId: string;
    name: string;
    nickname?: string;
    position: string;
    photo?: { version: number } | null;
  };
  attendance: {
    status: 'FULL' | 'HALF' | 'ABSENT' | 'UNMARKED';
    revision: number;
    updatedAt: string | null;
    notes?: string;
  };
}

interface AttendanceTabProps {
  initialDate: string;
  serverToday: string;
  onNavigateToSettings: () => void;
}

export function AttendanceTab({
  initialDate,
  serverToday,
  onNavigateToSettings
}: AttendanceTabProps) {
  const { idToken } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || serverToday);
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [isWorkday, setIsWorkday] = useState<boolean>(true);
  const [isClosed, setIsClosed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterUnchecked, setFilterUnchecked] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({});
  const [clearingId, setClearingId] = useState<string | null>(null);

  const fetchDayData = useCallback(
    async (date: string) => {
      if (!idToken) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/attendance?date=${date}`, {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        const json = await res.json();
        if (json.ok) {
          setItems(json.data.items);
          setIsWorkday(json.data.isWorkday);
          setIsClosed(json.data.isClosed);
        } else {
          setErrorMsg(json.error?.message || 'โหลดข้อมูลไม่สำเร็จ');
        }
      } catch {
        setErrorMsg('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง');
      } finally {
        setLoading(false);
      }
    },
    [idToken]
  );

  useEffect(() => {
    fetchDayData(selectedDate);
  }, [selectedDate, fetchDayData]);

  const handleMark = async (
    employeeId: string,
    status: 'FULL' | 'HALF' | 'ABSENT' | 'UNMARKED',
    expectedRevision: number
  ) => {
    if (!idToken || isClosed) return;
    setPendingMap(prev => ({ ...prev, [employeeId]: true }));
    const requestId = crypto.randomUUID();

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          dateKey: selectedDate,
          employeeId,
          status,
          expectedRevision,
          requestId
        })
      });

      const json = await res.json();
      if (json.ok) {
        setItems(prev =>
          prev.map(item =>
            item.employee.employeeId === employeeId
              ? {
                  ...item,
                  attendance: {
                    status: json.data.status,
                    revision: json.data.revision,
                    updatedAt: json.data.updatedAt,
                    notes: ''
                  }
                }
              : item
          )
        );
      } else {
        alert(json.error?.message || 'บันทึกไม่สำเร็จ');
        fetchDayData(selectedDate);
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาตรวจสอบอีกครั้ง');
    } finally {
      setPendingMap(prev => ({ ...prev, [employeeId]: false }));
      setClearingId(null);
    }
  };

  const handleAddWorkday = async () => {
    if (!idToken || isClosed) return;
    const requestId = crypto.randomUUID();
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          type: 'OVERRIDE',
          dateKey: selectedDate,
          kind: 'WORKDAY',
          note: 'เพิ่มวันทำงานพิเศษ',
          requestId
        })
      });
      const json = await res.json();
      if (json.ok) {
        fetchDayData(selectedDate);
      } else {
        alert(json.error?.message || 'ไม่สามารถเพิ่มวันทำงานได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const filteredItems = items
    .filter(item => {
      if (filterUnchecked && item.attendance.status !== 'UNMARKED') return false;
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.trim().toLowerCase();
        const matchName = item.employee.name.toLowerCase().includes(query);
        const matchNick = item.employee.nickname?.toLowerCase().includes(query);
        const matchPos = item.employee.position.toLowerCase().includes(query);
        return matchName || matchNick || matchPos;
      }
      return true;
    });

  const checkedCount = items.filter(item => item.attendance.status !== 'UNMARKED').length;

  return (
    <div>
      <h2 className={styles.title}>เช็คชื่อ</h2>

      <div className={styles.dateGroup}>
        <label className={styles.dateLabel} htmlFor="attendance-date-picker">
          วันที่
        </label>
        <div className={styles.dateRow}>
          <input
            id="attendance-date-picker"
            type="date"
            className={styles.dateInput}
            value={selectedDate}
            max={serverToday}
            onChange={e => {
              if (e.target.value && e.target.value <= serverToday) {
                setSelectedDate(e.target.value);
              }
            }}
          />
          {selectedDate !== serverToday && (
            <button
              type="button"
              className={styles.todayBtn}
              onClick={() => setSelectedDate(serverToday)}
            >
              วันนี้
            </button>
          )}
        </div>
        <div className={styles.thaiDateDisplay}>{formatThaiDate(selectedDate)}</div>
      </div>

      <div className={styles.toolbar}>
        <p className={styles.checkedCount}>
          เช็คแล้ว {checkedCount} จาก {items.length} คน
        </p>
        <button
          type="button"
          className={`${styles.filterBtn} ${filterUnchecked ? styles.filterBtnActive : ''}`}
          onClick={() => setFilterUnchecked(!filterUnchecked)}
        >
          {filterUnchecked ? 'ดูทั้งหมด' : 'ดูที่ยังไม่เช็ค'}
        </button>
      </div>

      {items.length > 8 && (
        <input
          type="search"
          placeholder="ค้นหาชื่อพนักงาน หรือตำแหน่ง..."
          className={styles.searchInput}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      )}

      {errorMsg && <div className={styles.notice}>{errorMsg}</div>}

      {!isWorkday && (
        <div className={styles.notice}>
          <strong>วันหยุดตามตาราง</strong>
          <span>หากพนักงานมาทำงานจริง กรุณากดบันทึกวันทำงานเพิ่มก่อนเริ่มเช็คชื่อ</span>
          {!isClosed && (
            <button type="button" className={styles.noticeBtn} onClick={handleAddWorkday}>
              บันทึกวันทำงานเพิ่ม
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div>
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
        </div>
      ) : items.length === 0 ? (
        <div className={styles.notice}>
          <strong>ยังไม่มีรายชื่อพนักงาน</strong>
          <p>กรุณาเพิ่มพนักงานในแท็บตั้งค่าเพื่อเริ่มใช้งาน</p>
          <button type="button" className={styles.noticeBtn} onClick={onNavigateToSettings}>
            เพิ่มพนักงาน
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--team-muted)', margin: '2rem 0' }}>
          {filterUnchecked ? 'เช็คชื่อครบทุกคนแล้ว' : 'ไม่พบรายชื่อที่ตรงกับการค้นหา'}
        </p>
      ) : (
        filteredItems.map(item => {
          const emp = item.employee;
          const att = item.attendance;
          const isPending = Boolean(pendingMap[emp.employeeId]);
          const isClearing = clearingId === emp.employeeId;

          let statusLabel = 'ยังไม่เช็ค';
          if (att.status === 'FULL') statusLabel = 'เต็มวัน';
          if (att.status === 'HALF') statusLabel = 'ครึ่งวัน';
          if (att.status === 'ABSENT') statusLabel = 'ไม่มา';

          return (
            <article key={emp.employeeId} className={styles.personCard}>
              <div className={styles.personHead}>
                <div className={styles.avatar}>
                  {emp.photo ? (
                    <img
                      src={`/api/employees/${emp.employeeId}/photo?v=${emp.photo.version}`}
                      alt={`รูป ${emp.name}`}
                    />
                  ) : (
                    emp.name.slice(0, 1)
                  )}
                </div>
                <div className={styles.personInfo}>
                  <h3 className={styles.personName}>
                    {emp.name} {emp.nickname ? `(${emp.nickname})` : ''}
                  </h3>
                  <p className={styles.personPosition}>{emp.position}</p>
                </div>
              </div>

              <div
                className={styles.statusGrid}
                role="group"
                aria-label={`เช็คชื่อ ${emp.name}`}
              >
                <button
                  type="button"
                  className={`${styles.statusBtn} ${
                    att.status === 'FULL' ? styles.statusBtnFullSelected : ''
                  }`}
                  aria-pressed={att.status === 'FULL'}
                  disabled={isPending || isClosed}
                  onClick={() => handleMark(emp.employeeId, 'FULL', att.revision)}
                >
                  เต็มวัน
                </button>

                <button
                  type="button"
                  className={`${styles.statusBtn} ${
                    att.status === 'HALF' ? styles.statusBtnHalfSelected : ''
                  }`}
                  aria-pressed={att.status === 'HALF'}
                  disabled={isPending || isClosed}
                  onClick={() => handleMark(emp.employeeId, 'HALF', att.revision)}
                >
                  ครึ่งวัน
                </button>

                <button
                  type="button"
                  className={`${styles.statusBtn} ${
                    att.status === 'ABSENT' ? styles.statusBtnAbsentSelected : ''
                  }`}
                  aria-pressed={att.status === 'ABSENT'}
                  disabled={isPending || isClosed}
                  onClick={() => handleMark(emp.employeeId, 'ABSENT', att.revision)}
                >
                  ไม่มา
                </button>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.statusText}>
                  {isPending
                    ? 'กำลังบันทึก...'
                    : att.status !== 'UNMARKED'
                    ? `${statusLabel} · บันทึกแล้ว`
                    : 'ยังไม่เช็ค'}
                </span>

                {att.status !== 'UNMARKED' && !isClosed && (
                  <div>
                    {isClearing ? (
                      <div className={styles.confirmBox}>
                        <span>ยืนยันล้าง?</span>
                        <button
                          type="button"
                          className={styles.textBtn}
                          disabled={isPending}
                          onClick={() => handleMark(emp.employeeId, 'UNMARKED', att.revision)}
                        >
                          ยืนยัน
                        </button>
                        <button
                          type="button"
                          className={styles.textBtn}
                          onClick={() => setClearingId(null)}
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.textBtn}
                        onClick={() => setClearingId(emp.employeeId)}
                      >
                        ล้างรายการ
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
