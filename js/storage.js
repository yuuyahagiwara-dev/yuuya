/**
 * LocalStorage ユーティリティ
 * 勤怠管理システムのデータ永続化を担当
 */

const Storage = {
  // キー定義
  KEYS: {
    USERS: 'jobcan_users',
    CURRENT_USER: 'jobcan_current_user',
    ATTENDANCE: 'jobcan_attendance',
    SHIFTS: 'jobcan_shifts',
    REQUESTS: 'jobcan_requests',
    SETTINGS: 'jobcan_settings'
  },

  /**
   * データを保存
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage save error:', e);
      return false;
    }
  },

  /**
   * データを取得
   */
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error('Storage read error:', e);
      return defaultValue;
    }
  },

  /**
   * データを削除
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('Storage remove error:', e);
      return false;
    }
  },

  /**
   * 全データをクリア
   */
  clear() {
    try {
      Object.values(this.KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      return true;
    } catch (e) {
      console.error('Storage clear error:', e);
      return false;
    }
  },

  /**
   * 初期データをセットアップ
   */
  initialize() {
    // デモ用ユーザーがなければ作成
    if (!this.get(this.KEYS.USERS)) {
      const defaultUsers = [
        {
          id: 1,
          email: 'admin@example.com',
          password: 'admin123',
          name: '管理者',
          role: 'admin',
          department: '総務部'
        },
        {
          id: 2,
          email: 'user@example.com',
          password: 'user123',
          name: '山田太郎',
          role: 'user',
          department: '営業部'
        },
        {
          id: 3,
          email: 'tanaka@example.com',
          password: 'tanaka123',
          name: '田中花子',
          role: 'user',
          department: '開発部'
        }
      ];
      this.set(this.KEYS.USERS, defaultUsers);
    }

    // 勤怠データがなければ空配列を作成
    if (!this.get(this.KEYS.ATTENDANCE)) {
      this.set(this.KEYS.ATTENDANCE, []);
    }

    // シフトデータがなければ空配列を作成
    if (!this.get(this.KEYS.SHIFTS)) {
      this.set(this.KEYS.SHIFTS, []);
    }

    // 申請データがなければ空配列を作成
    if (!this.get(this.KEYS.REQUESTS)) {
      this.set(this.KEYS.REQUESTS, []);
    }
  },

  // ========== ユーザー関連 ==========

  /**
   * 全ユーザーを取得
   */
  getUsers() {
    return this.get(this.KEYS.USERS, []);
  },

  /**
   * ユーザーをメールで検索
   */
  getUserByEmail(email) {
    const users = this.getUsers();
    return users.find(u => u.email === email);
  },

  /**
   * ユーザーをIDで検索
   */
  getUserById(id) {
    const users = this.getUsers();
    return users.find(u => u.id === id);
  },

  /**
   * 現在のユーザーを取得
   */
  getCurrentUser() {
    return this.get(this.KEYS.CURRENT_USER);
  },

  /**
   * 現在のユーザーを設定
   */
  setCurrentUser(user) {
    return this.set(this.KEYS.CURRENT_USER, user);
  },

  /**
   * ログアウト（現在のユーザーをクリア）
   */
  logout() {
    return this.remove(this.KEYS.CURRENT_USER);
  },

  // ========== 勤怠関連 ==========

  /**
   * 全勤怠データを取得
   */
  getAttendance() {
    return this.get(this.KEYS.ATTENDANCE, []);
  },

  /**
   * ユーザーの勤怠データを取得
   */
  getUserAttendance(userId) {
    const attendance = this.getAttendance();
    return attendance.filter(a => a.userId === userId);
  },

  /**
   * 特定日の勤怠データを取得
   */
  getAttendanceByDate(userId, date) {
    const attendance = this.getUserAttendance(userId);
    return attendance.find(a => a.date === date);
  },

  /**
   * 今日の勤怠データを取得
   */
  getTodayAttendance(userId) {
    const today = this.formatDate(new Date());
    return this.getAttendanceByDate(userId, today);
  },

  /**
   * 勤怠データを保存/更新
   */
  saveAttendance(record) {
    const attendance = this.getAttendance();
    const index = attendance.findIndex(
      a => a.userId === record.userId && a.date === record.date
    );

    if (index >= 0) {
      attendance[index] = { ...attendance[index], ...record };
    } else {
      record.id = Date.now();
      attendance.push(record);
    }

    return this.set(this.KEYS.ATTENDANCE, attendance);
  },

  /**
   * 月間勤怠データを取得
   */
  getMonthlyAttendance(userId, year, month) {
    const attendance = this.getUserAttendance(userId);
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return attendance.filter(a => a.date.startsWith(prefix));
  },

  // ========== シフト関連 ==========

  /**
   * 全シフトを取得
   */
  getShifts() {
    return this.get(this.KEYS.SHIFTS, []);
  },

  /**
   * ユーザーのシフトを取得
   */
  getUserShifts(userId) {
    const shifts = this.getShifts();
    return shifts.filter(s => s.userId === userId);
  },

  /**
   * 特定日のシフトを取得
   */
  getShiftByDate(userId, date) {
    const shifts = this.getUserShifts(userId);
    return shifts.find(s => s.date === date);
  },

  /**
   * シフトを保存
   */
  saveShift(shift) {
    const shifts = this.getShifts();
    const index = shifts.findIndex(
      s => s.userId === shift.userId && s.date === shift.date
    );

    if (index >= 0) {
      shifts[index] = { ...shifts[index], ...shift };
    } else {
      shift.id = Date.now();
      shifts.push(shift);
    }

    return this.set(this.KEYS.SHIFTS, shifts);
  },

  /**
   * シフトを削除
   */
  deleteShift(userId, date) {
    const shifts = this.getShifts();
    const filtered = shifts.filter(
      s => !(s.userId === userId && s.date === date)
    );
    return this.set(this.KEYS.SHIFTS, filtered);
  },

  /**
   * 月間シフトを取得
   */
  getMonthlyShifts(year, month) {
    const shifts = this.getShifts();
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return shifts.filter(s => s.date.startsWith(prefix));
  },

  // ========== 申請関連 ==========

  /**
   * 全申請を取得
   */
  getRequests() {
    return this.get(this.KEYS.REQUESTS, []);
  },

  /**
   * ユーザーの申請を取得
   */
  getUserRequests(userId) {
    const requests = this.getRequests();
    return requests.filter(r => r.userId === userId);
  },

  /**
   * 保留中の申請を取得（管理者用）
   */
  getPendingRequests() {
    const requests = this.getRequests();
    return requests.filter(r => r.status === 'pending');
  },

  /**
   * 申請を作成
   */
  createRequest(request) {
    const requests = this.getRequests();
    request.id = Date.now();
    request.createdAt = new Date().toISOString();
    request.status = 'pending';
    requests.push(request);
    return this.set(this.KEYS.REQUESTS, requests);
  },

  /**
   * 申請を更新
   */
  updateRequest(requestId, updates) {
    const requests = this.getRequests();
    const index = requests.findIndex(r => r.id === requestId);
    if (index >= 0) {
      requests[index] = { ...requests[index], ...updates };
      return this.set(this.KEYS.REQUESTS, requests);
    }
    return false;
  },

  // ========== ユーティリティ ==========

  /**
   * 日付をYYYY-MM-DD形式にフォーマット
   */
  formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 時刻をHH:MM形式にフォーマット
   */
  formatTime(date) {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  /**
   * 時間差を計算（分単位）
   */
  calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return endMinutes - startMinutes;
  },

  /**
   * 分を時間:分形式に変換
   */
  minutesToHoursMinutes(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}時間${m}分`;
  }
};

// 初期化
Storage.initialize();
