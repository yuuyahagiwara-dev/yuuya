/**
 * レポート・CSV出力管理
 */

const ReportManager = {
  currentYear: null,
  currentMonth: null,
  chart: null,

  /**
   * 初期化
   */
  init() {
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth() + 1;

    this.bindEvents();
    this.renderReport();
  },

  /**
   * イベントをバインド
   */
  bindEvents() {
    // 前月ボタン
    document.getElementById('prevMonth')?.addEventListener('click', () => {
      this.currentMonth--;
      if (this.currentMonth < 1) {
        this.currentMonth = 12;
        this.currentYear--;
      }
      this.renderReport();
    });

    // 翌月ボタン
    document.getElementById('nextMonth')?.addEventListener('click', () => {
      this.currentMonth++;
      if (this.currentMonth > 12) {
        this.currentMonth = 1;
        this.currentYear++;
      }
      this.renderReport();
    });

    // CSV出力ボタン
    document.getElementById('btnExportCSV')?.addEventListener('click', () => {
      this.exportCSV();
    });

    // 全員のレポート出力（管理者用）
    document.getElementById('btnExportAllCSV')?.addEventListener('click', () => {
      this.exportAllUsersCSV();
    });
  },

  /**
   * レポートを描画
   */
  renderReport() {
    const user = Auth.getCurrentUser();
    const titleEl = document.getElementById('reportTitle');

    titleEl.textContent = `${this.currentYear}年${this.currentMonth}月`;

    // 月間データを取得
    const records = Storage.getMonthlyAttendance(user.id, this.currentYear, this.currentMonth);

    // 統計を計算
    const stats = this.calculateStats(records);

    // 統計カードを更新
    this.updateStatsCards(stats);

    // グラフを描画
    this.renderChart(records);

    // 詳細テーブルを描画
    this.renderDetailTable(records);
  },

  /**
   * 統計を計算
   */
  calculateStats(records) {
    let workDays = 0;
    let totalMinutes = 0;
    let overtimeMinutes = 0;
    let breakMinutes = 0;
    let lateCount = 0;
    let earlyLeaveCount = 0;

    records.forEach(record => {
      if (record.clockIn && record.clockOut) {
        workDays++;

        // 休憩時間
        let recordBreakMinutes = 0;
        if (record.breaks) {
          record.breaks.forEach(b => {
            if (b.start && b.end) {
              recordBreakMinutes += Storage.calculateDuration(b.start, b.end);
            }
          });
        }
        breakMinutes += recordBreakMinutes;

        // 労働時間
        const workMinutes = Storage.calculateDuration(record.clockIn, record.clockOut) - recordBreakMinutes;
        totalMinutes += workMinutes;

        // 残業（8時間超過分）
        if (workMinutes > 8 * 60) {
          overtimeMinutes += workMinutes - 8 * 60;
        }

        // 遅刻判定（9:00より後に出勤）
        const [h, m] = record.clockIn.split(':').map(Number);
        if (h > 9 || (h === 9 && m > 0)) {
          lateCount++;
        }

        // 早退判定（18:00より前に退勤）
        const [outH, outM] = record.clockOut.split(':').map(Number);
        if (outH < 18) {
          earlyLeaveCount++;
        }
      }
    });

    return {
      workDays,
      totalMinutes,
      overtimeMinutes,
      breakMinutes,
      lateCount,
      earlyLeaveCount,
      averageMinutes: workDays > 0 ? Math.round(totalMinutes / workDays) : 0
    };
  },

  /**
   * 統計カードを更新
   */
  updateStatsCards(stats) {
    document.getElementById('statWorkDays').textContent = `${stats.workDays}日`;
    document.getElementById('statTotalHours').textContent =
      `${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`;
    document.getElementById('statOvertimeHours').textContent =
      `${Math.floor(stats.overtimeMinutes / 60)}h ${stats.overtimeMinutes % 60}m`;
    document.getElementById('statBreakHours').textContent =
      `${Math.floor(stats.breakMinutes / 60)}h ${stats.breakMinutes % 60}m`;
    document.getElementById('statLateCount').textContent = `${stats.lateCount}回`;
    document.getElementById('statAverageHours').textContent =
      `${Math.floor(stats.averageMinutes / 60)}h ${stats.averageMinutes % 60}m`;
  },

  /**
   * グラフを描画
   */
  renderChart(records) {
    const ctx = document.getElementById('workChart');
    if (!ctx) return;

    // 日別データを準備
    const lastDay = new Date(this.currentYear, this.currentMonth, 0).getDate();
    const labels = [];
    const workData = [];
    const overtimeData = [];

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      labels.push(`${day}日`);

      const record = records.find(r => r.date === dateStr);
      if (record && record.clockIn && record.clockOut) {
        let breakMinutes = 0;
        if (record.breaks) {
          record.breaks.forEach(b => {
            if (b.start && b.end) {
              breakMinutes += Storage.calculateDuration(b.start, b.end);
            }
          });
        }
        const workMinutes = Storage.calculateDuration(record.clockIn, record.clockOut) - breakMinutes;
        const workHours = workMinutes / 60;
        const overtime = Math.max(0, workHours - 8);

        workData.push(Math.min(workHours, 8));
        overtimeData.push(overtime);
      } else {
        workData.push(0);
        overtimeData.push(0);
      }
    }

    // 既存のグラフを破棄
    if (this.chart) {
      this.chart.destroy();
    }

    // Chart.jsが読み込まれているか確認
    if (typeof Chart === 'undefined') {
      ctx.parentElement.innerHTML = '<p class="text-center text-muted">グラフライブラリが読み込まれていません</p>';
      return;
    }

    // 新しいグラフを作成
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '通常勤務',
            data: workData,
            backgroundColor: 'rgba(26, 115, 232, 0.7)',
            borderColor: 'rgba(26, 115, 232, 1)',
            borderWidth: 1
          },
          {
            label: '残業',
            data: overtimeData,
            backgroundColor: 'rgba(234, 67, 53, 0.7)',
            borderColor: 'rgba(234, 67, 53, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true
          },
          y: {
            stacked: true,
            beginAtZero: true,
            max: 12,
            title: {
              display: true,
              text: '労働時間（時間）'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    });
  },

  /**
   * 詳細テーブルを描画
   */
  renderDetailTable(records) {
    const tbody = document.getElementById('reportTable');
    if (!tbody) return;

    const lastDay = new Date(this.currentYear, this.currentMonth, 0).getDate();
    const recordMap = {};
    records.forEach(r => {
      recordMap[r.date] = r;
    });

    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    let html = '';

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const date = new Date(this.currentYear, this.currentMonth - 1, day);
      const weekday = weekdays[date.getDay()];
      const record = recordMap[dateStr];

      let breakMinutes = 0;
      let workMinutes = 0;
      let overtimeMinutes = 0;

      if (record && record.clockIn && record.clockOut) {
        if (record.breaks) {
          record.breaks.forEach(b => {
            if (b.start && b.end) {
              breakMinutes += Storage.calculateDuration(b.start, b.end);
            }
          });
        }
        workMinutes = Storage.calculateDuration(record.clockIn, record.clockOut) - breakMinutes;
        overtimeMinutes = Math.max(0, workMinutes - 8 * 60);
      }

      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const rowClass = isWeekend ? 'style="background-color: #fafafa;"' : '';

      html += `
        <tr ${rowClass}>
          <td>${day}</td>
          <td style="color: ${date.getDay() === 0 ? 'var(--danger-color)' : date.getDay() === 6 ? 'var(--primary-color)' : 'inherit'}">${weekday}</td>
          <td>${record?.clockIn || '-'}</td>
          <td>${record?.clockOut || '-'}</td>
          <td>${breakMinutes > 0 ? Storage.minutesToHoursMinutes(breakMinutes) : '-'}</td>
          <td>${workMinutes > 0 ? Storage.minutesToHoursMinutes(workMinutes) : '-'}</td>
          <td style="color: ${overtimeMinutes > 0 ? 'var(--danger-color)' : 'inherit'}">
            ${overtimeMinutes > 0 ? Storage.minutesToHoursMinutes(overtimeMinutes) : '-'}
          </td>
        </tr>
      `;
    }

    tbody.innerHTML = html;
  },

  /**
   * CSVエクスポート
   */
  exportCSV() {
    const user = Auth.getCurrentUser();
    const records = Storage.getMonthlyAttendance(user.id, this.currentYear, this.currentMonth);

    const csv = this.generateCSV([user], records);
    this.downloadCSV(csv, `勤怠レポート_${user.name}_${this.currentYear}${String(this.currentMonth).padStart(2, '0')}.csv`);
  },

  /**
   * 全ユーザーのCSVエクスポート（管理者用）
   */
  exportAllUsersCSV() {
    if (!Auth.isAdmin()) {
      alert('管理者権限が必要です');
      return;
    }

    const users = Storage.getUsers();
    let allRecords = [];

    users.forEach(user => {
      const userRecords = Storage.getMonthlyAttendance(user.id, this.currentYear, this.currentMonth);
      allRecords = allRecords.concat(userRecords);
    });

    const csv = this.generateCSV(users, allRecords);
    this.downloadCSV(csv, `勤怠レポート_全員_${this.currentYear}${String(this.currentMonth).padStart(2, '0')}.csv`);
  },

  /**
   * CSVを生成
   */
  generateCSV(users, records) {
    const recordMap = {};
    records.forEach(r => {
      const key = `${r.userId}_${r.date}`;
      recordMap[key] = r;
    });

    let csv = '\uFEFF'; // BOM for Excel
    csv += '社員名,日付,曜日,出勤,退勤,休憩,労働時間,残業時間\n';

    const lastDay = new Date(this.currentYear, this.currentMonth, 0).getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

    users.forEach(user => {
      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const date = new Date(this.currentYear, this.currentMonth - 1, day);
        const weekday = weekdays[date.getDay()];
        const key = `${user.id}_${dateStr}`;
        const record = recordMap[key];

        let breakMinutes = 0;
        let workMinutes = 0;
        let overtimeMinutes = 0;

        if (record && record.clockIn && record.clockOut) {
          if (record.breaks) {
            record.breaks.forEach(b => {
              if (b.start && b.end) {
                breakMinutes += Storage.calculateDuration(b.start, b.end);
              }
            });
          }
          workMinutes = Storage.calculateDuration(record.clockIn, record.clockOut) - breakMinutes;
          overtimeMinutes = Math.max(0, workMinutes - 8 * 60);
        }

        csv += `"${user.name}","${dateStr}","${weekday}","${record?.clockIn || ''}","${record?.clockOut || ''}",`;
        csv += `"${breakMinutes > 0 ? Storage.minutesToHoursMinutes(breakMinutes) : ''}",`;
        csv += `"${workMinutes > 0 ? Storage.minutesToHoursMinutes(workMinutes) : ''}",`;
        csv += `"${overtimeMinutes > 0 ? Storage.minutesToHoursMinutes(overtimeMinutes) : ''}"\n`;
      }
    });

    return csv;
  },

  /**
   * CSVをダウンロード
   */
  downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }
};

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('reportTitle')) {
    ReportManager.init();
  }
});
