/**
 * シフト管理
 */

const ShiftManager = {
  currentYear: null,
  currentMonth: null,
  selectedDate: null,
  selectedUserId: null,

  // シフトタイプの定義
  SHIFT_TYPES: {
    morning: { label: '早番', time: '06:00-15:00', color: '#fff3cd' },
    day: { label: '日勤', time: '09:00-18:00', color: '#d4edda' },
    late: { label: '遅番', time: '13:00-22:00', color: '#cce5ff' },
    night: { label: '夜勤', time: '22:00-07:00', color: '#e2d4f0' },
    holiday: { label: '休み', time: '', color: '#f8d7da' }
  },

  /**
   * 初期化
   */
  init() {
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth() + 1;

    this.bindEvents();
    this.renderShiftTable();
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
      this.renderShiftTable();
    });

    // 翌月ボタン
    document.getElementById('nextMonth')?.addEventListener('click', () => {
      this.currentMonth++;
      if (this.currentMonth > 12) {
        this.currentMonth = 1;
        this.currentYear++;
      }
      this.renderShiftTable();
    });

    // シフト登録フォーム
    document.getElementById('shiftForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveShift();
    });
  },

  /**
   * シフト表を描画
   */
  renderShiftTable() {
    const container = document.getElementById('shiftTable');
    const titleEl = document.getElementById('shiftTitle');
    if (!container) return;

    titleEl.textContent = `${this.currentYear}年${this.currentMonth}月`;

    const isAdmin = Auth.isAdmin();
    const users = Storage.getUsers();
    const lastDay = new Date(this.currentYear, this.currentMonth, 0).getDate();
    const shifts = Storage.getMonthlyShifts(this.currentYear, this.currentMonth);

    // シフトをマップに変換
    const shiftMap = {};
    shifts.forEach(s => {
      const key = `${s.userId}_${s.date}`;
      shiftMap[key] = s;
    });

    let html = '<table class="table">';

    // ヘッダー行（日付）
    html += '<thead><tr><th style="min-width: 100px;">スタッフ</th>';
    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(this.currentYear, this.currentMonth - 1, day);
      const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const style = isWeekend ? 'background-color: #f5f5f5;' : '';
      const color = date.getDay() === 0 ? 'color: var(--danger-color);' : date.getDay() === 6 ? 'color: var(--primary-color);' : '';
      html += `<th style="min-width: 60px; text-align: center; ${style} ${color}">${day}<br><small>${weekday}</small></th>`;
    }
    html += '</tr></thead>';

    // スタッフ行
    html += '<tbody>';
    users.forEach(user => {
      html += `<tr><td><strong>${user.name}</strong><br><small class="text-muted">${user.department}</small></td>`;

      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const key = `${user.id}_${dateStr}`;
        const shift = shiftMap[key];
        const date = new Date(this.currentYear, this.currentMonth - 1, day);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const bgColor = isWeekend ? '#f5f5f5' : '#fff';

        let cellContent = '';
        if (shift && shift.type) {
          const shiftType = this.SHIFT_TYPES[shift.type];
          if (shiftType) {
            cellContent = `<span class="shift-tag" style="background-color: ${shiftType.color};">${shiftType.label}</span>`;
          }
        }

        const cellStyle = isAdmin
          ? `background-color: ${bgColor}; text-align: center; cursor: pointer;`
          : `background-color: ${bgColor}; text-align: center; cursor: default;`;
        const clickHandler = isAdmin
          ? `onclick="ShiftManager.openShiftModal(${user.id}, '${dateStr}')"`
          : '';
        html += `<td class="shift-cell" style="${cellStyle}" ${clickHandler}>${cellContent}</td>`;
      }
      html += '</tr>';
    });
    html += '</tbody></table>';

    container.innerHTML = html;
  },

  /**
   * シフト編集モーダルを開く（管理者のみ）
   */
  openShiftModal(userId, date) {
    // 管理者チェック
    if (!Auth.isAdmin()) {
      alert('シフトの編集は管理者のみ可能です');
      return;
    }

    this.selectedUserId = userId;
    this.selectedDate = date;

    const user = Storage.getUserById(userId);
    const existingShift = Storage.getShiftByDate(userId, date);

    document.getElementById('shiftModalTitle').textContent =
      `${user.name} - ${date}`;

    // シフトタイプを選択
    const typeSelect = document.getElementById('shiftType');
    if (existingShift && existingShift.type) {
      typeSelect.value = existingShift.type;
    } else {
      typeSelect.value = '';
    }

    // 備考
    document.getElementById('shiftNote').value = existingShift?.note || '';

    document.getElementById('shiftModal').classList.add('active');
  },

  /**
   * モーダルを閉じる
   */
  closeModal() {
    document.getElementById('shiftModal').classList.remove('active');
    this.selectedUserId = null;
    this.selectedDate = null;
  },

  /**
   * シフトを保存
   */
  saveShift() {
    if (!this.selectedUserId || !this.selectedDate) return;

    const type = document.getElementById('shiftType').value;
    const note = document.getElementById('shiftNote').value;

    if (!type) {
      // 空の場合はシフトを削除
      Storage.deleteShift(this.selectedUserId, this.selectedDate);
    } else {
      const shift = {
        userId: this.selectedUserId,
        date: this.selectedDate,
        type: type,
        note: note
      };
      Storage.saveShift(shift);
    }

    this.closeModal();
    this.renderShiftTable();
  },

  /**
   * シフトを削除
   */
  deleteShift() {
    if (!this.selectedUserId || !this.selectedDate) return;

    if (confirm('このシフトを削除しますか？')) {
      Storage.deleteShift(this.selectedUserId, this.selectedDate);
      this.closeModal();
      this.renderShiftTable();
    }
  }
};

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('shiftTable')) {
    ShiftManager.init();
  }
});
