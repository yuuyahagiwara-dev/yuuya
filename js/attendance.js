/**
 * 勤怠管理（出退勤・休憩処理）
 */

const Attendance = {
  currentUser: null,
  todayRecord: null,
  clockInterval: null,

  /**
   * 初期化
   */
  init() {
    this.currentUser = Auth.getCurrentUser();
    if (!this.currentUser) return;

    this.loadTodayRecord();
    this.startClock();
    this.updateUI();
    this.bindEvents();
  },

  /**
   * 今日の勤怠データを読み込み
   */
  loadTodayRecord() {
    this.todayRecord = Storage.getTodayAttendance(this.currentUser.id);
    if (!this.todayRecord) {
      this.todayRecord = {
        userId: this.currentUser.id,
        date: Storage.formatDate(new Date()),
        clockIn: null,
        clockOut: null,
        breaks: [],
        status: 'not_started'
      };
    }
  },

  /**
   * 時計を開始
   */
  startClock() {
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  },

  /**
   * 時計を更新
   */
  updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('currentTime');
    const dateEl = document.getElementById('currentDate');

    if (timeEl) {
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      timeEl.textContent = `${hours}:${minutes}:${seconds}`;
    }

    if (dateEl) {
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
      const weekday = weekdays[now.getDay()];
      dateEl.textContent = `${year}年${month}月${day}日（${weekday}）`;
    }
  },

  /**
   * イベントをバインド
   */
  bindEvents() {
    // 出勤ボタン
    const clockInBtn = document.getElementById('btnClockIn');
    if (clockInBtn) {
      clockInBtn.addEventListener('click', () => this.clockIn());
    }

    // 退勤ボタン
    const clockOutBtn = document.getElementById('btnClockOut');
    if (clockOutBtn) {
      clockOutBtn.addEventListener('click', () => this.clockOut());
    }

    // 休憩開始ボタン
    const breakStartBtn = document.getElementById('btnBreakStart');
    if (breakStartBtn) {
      breakStartBtn.addEventListener('click', () => this.startBreak());
    }

    // 休憩終了ボタン
    const breakEndBtn = document.getElementById('btnBreakEnd');
    if (breakEndBtn) {
      breakEndBtn.addEventListener('click', () => this.endBreak());
    }
  },

  /**
   * UIを更新
   */
  updateUI() {
    const status = this.getStatus();

    // ボタンの状態を更新
    const clockInBtn = document.getElementById('btnClockIn');
    const clockOutBtn = document.getElementById('btnClockOut');
    const breakStartBtn = document.getElementById('btnBreakStart');
    const breakEndBtn = document.getElementById('btnBreakEnd');

    if (clockInBtn) {
      clockInBtn.disabled = status !== 'not_started';
    }
    if (clockOutBtn) {
      clockOutBtn.disabled = status === 'not_started' || status === 'finished' || status === 'on_break';
    }
    if (breakStartBtn) {
      breakStartBtn.disabled = status !== 'working';
    }
    if (breakEndBtn) {
      breakEndBtn.disabled = status !== 'on_break';
    }

    // ステータス表示を更新
    this.updateStatusDisplay();
  },

  /**
   * ステータス表示を更新
   */
  updateStatusDisplay() {
    const statusArea = document.getElementById('punchStatus');
    if (!statusArea) return;

    const record = this.todayRecord;
    let html = '';

    // 出勤時刻
    html += `
      <div class="punch-status-item">
        <span>出勤</span>
        <span>${record.clockIn || '--:--'}</span>
      </div>
    `;

    // 休憩時間
    const totalBreakMinutes = this.calculateTotalBreakTime();
    html += `
      <div class="punch-status-item">
        <span>休憩</span>
        <span>${Storage.minutesToHoursMinutes(totalBreakMinutes)}</span>
      </div>
    `;

    // 退勤時刻
    html += `
      <div class="punch-status-item">
        <span>退勤</span>
        <span>${record.clockOut || '--:--'}</span>
      </div>
    `;

    // 労働時間
    const workMinutes = this.calculateWorkTime();
    html += `
      <div class="punch-status-item">
        <span>労働時間</span>
        <span>${Storage.minutesToHoursMinutes(workMinutes)}</span>
      </div>
    `;

    // 現在のステータス
    const statusText = this.getStatusText();
    html += `
      <div class="punch-status-item" style="border-bottom: none;">
        <span>状態</span>
        <span class="badge ${this.getStatusBadgeClass()}">${statusText}</span>
      </div>
    `;

    statusArea.innerHTML = html;
  },

  /**
   * 現在のステータスを取得
   */
  getStatus() {
    if (!this.todayRecord.clockIn) {
      return 'not_started';
    }
    if (this.todayRecord.clockOut) {
      return 'finished';
    }
    // 休憩中かどうか
    const ongoingBreak = this.todayRecord.breaks.find(b => b.start && !b.end);
    if (ongoingBreak) {
      return 'on_break';
    }
    return 'working';
  },

  /**
   * ステータステキストを取得
   */
  getStatusText() {
    const status = this.getStatus();
    switch (status) {
      case 'not_started': return '未出勤';
      case 'working': return '勤務中';
      case 'on_break': return '休憩中';
      case 'finished': return '退勤済';
      default: return '不明';
    }
  },

  /**
   * ステータスバッジクラスを取得
   */
  getStatusBadgeClass() {
    const status = this.getStatus();
    switch (status) {
      case 'not_started': return 'badge-secondary';
      case 'working': return 'badge-success';
      case 'on_break': return 'badge-warning';
      case 'finished': return 'badge-info';
      default: return 'badge-secondary';
    }
  },

  /**
   * 出勤
   */
  clockIn() {
    const now = new Date();
    this.todayRecord.clockIn = Storage.formatTime(now);
    this.todayRecord.status = 'working';
    Storage.saveAttendance(this.todayRecord);
    this.showNotification('出勤しました', 'success');
    this.updateUI();
  },

  /**
   * 退勤
   */
  clockOut() {
    const now = new Date();
    this.todayRecord.clockOut = Storage.formatTime(now);
    this.todayRecord.status = 'finished';
    Storage.saveAttendance(this.todayRecord);
    this.showNotification('退勤しました', 'info');
    this.updateUI();
  },

  /**
   * 休憩開始
   */
  startBreak() {
    const now = new Date();
    this.todayRecord.breaks.push({
      start: Storage.formatTime(now),
      end: null
    });
    this.todayRecord.status = 'on_break';
    Storage.saveAttendance(this.todayRecord);
    this.showNotification('休憩を開始しました', 'warning');
    this.updateUI();
  },

  /**
   * 休憩終了
   */
  endBreak() {
    const now = new Date();
    const ongoingBreak = this.todayRecord.breaks.find(b => b.start && !b.end);
    if (ongoingBreak) {
      ongoingBreak.end = Storage.formatTime(now);
    }
    this.todayRecord.status = 'working';
    Storage.saveAttendance(this.todayRecord);
    this.showNotification('休憩を終了しました', 'success');
    this.updateUI();
  },

  /**
   * 合計休憩時間を計算
   */
  calculateTotalBreakTime() {
    let total = 0;
    for (const b of this.todayRecord.breaks) {
      if (b.start && b.end) {
        total += Storage.calculateDuration(b.start, b.end);
      }
    }
    return total;
  },

  /**
   * 労働時間を計算
   */
  calculateWorkTime() {
    if (!this.todayRecord.clockIn) return 0;

    const endTime = this.todayRecord.clockOut || Storage.formatTime(new Date());
    const totalMinutes = Storage.calculateDuration(this.todayRecord.clockIn, endTime);
    const breakMinutes = this.calculateTotalBreakTime();

    return Math.max(0, totalMinutes - breakMinutes);
  },

  /**
   * 通知を表示
   */
  showNotification(message, type = 'info') {
    const container = document.getElementById('notificationArea');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '80px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.animation = 'fadeIn 0.3s ease';

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
};

// スタイルを追加
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-10px); }
  }
`;
document.head.appendChild(style);

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('punchArea')) {
    Attendance.init();
  }
});
