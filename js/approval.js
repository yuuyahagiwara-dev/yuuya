/**
 * 承認フロー管理
 */

const ApprovalManager = {
  /**
   * 初期化
   */
  init() {
    this.bindEvents();
    this.renderRequests();
    this.updatePendingCount();
  },

  /**
   * イベントをバインド
   */
  bindEvents() {
    // タブ切り替え
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        e.target.classList.add('active');
        const tabId = e.target.dataset.tab;
        document.getElementById(tabId).classList.add('active');
      });
    });

    // 有給休暇申請フォーム
    document.getElementById('leaveForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitLeaveRequest();
    });
  },

  /**
   * 申請一覧を描画
   */
  renderRequests() {
    const user = Auth.getCurrentUser();
    const isAdmin = Auth.isAdmin();

    // 自分の申請
    this.renderMyRequests(user.id);

    // 管理者の場合は承認待ち一覧も表示
    if (isAdmin) {
      this.renderPendingRequests();
    }
  },

  /**
   * 自分の申請を描画
   */
  renderMyRequests(userId) {
    const container = document.getElementById('myRequestList');
    if (!container) return;

    const requests = Storage.getUserRequests(userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (requests.length === 0) {
      container.innerHTML = '<li class="request-item"><p class="text-muted">申請履歴がありません</p></li>';
      return;
    }

    container.innerHTML = requests.map(request => {
      const statusBadge = this.getStatusBadge(request.status);
      const typeLabel = this.getTypeLabel(request.type);

      return `
        <li class="request-item">
          <div class="request-info">
            <h4>${typeLabel}</h4>
            <p>申請日: ${new Date(request.createdAt).toLocaleDateString('ja-JP')}</p>
            <p>対象日: ${request.date}</p>
            ${request.reason ? `<p>理由: ${request.reason}</p>` : ''}
          </div>
          <div class="request-actions">
            ${statusBadge}
          </div>
        </li>
      `;
    }).join('');
  },

  /**
   * 承認待ち申請を描画（管理者用）
   */
  renderPendingRequests() {
    const container = document.getElementById('pendingRequestList');
    if (!container) return;

    const requests = Storage.getPendingRequests()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (requests.length === 0) {
      container.innerHTML = '<li class="request-item"><p class="text-muted">承認待ちの申請はありません</p></li>';
      return;
    }

    container.innerHTML = requests.map(request => {
      const typeLabel = this.getTypeLabel(request.type);
      const user = Storage.getUserById(request.userId);

      return `
        <li class="request-item">
          <div class="request-info">
            <h4>${typeLabel}</h4>
            <p>申請者: ${user?.name || '不明'}</p>
            <p>申請日: ${new Date(request.createdAt).toLocaleDateString('ja-JP')}</p>
            <p>対象日: ${request.date}</p>
            ${request.type === 'attendance_edit' ?
              `<p>修正内容: ${request.clockIn || '--:--'} ～ ${request.clockOut || '--:--'}</p>` : ''}
            ${request.reason ? `<p>理由: ${request.reason}</p>` : ''}
          </div>
          <div class="request-actions">
            <button class="btn btn-success btn-sm" onclick="ApprovalManager.approve(${request.id})">承認</button>
            <button class="btn btn-danger btn-sm" onclick="ApprovalManager.reject(${request.id})">却下</button>
          </div>
        </li>
      `;
    }).join('');
  },

  /**
   * 承認待ち件数を更新
   */
  updatePendingCount() {
    const countEl = document.getElementById('pendingCount');
    if (!countEl) return;

    const count = Storage.getPendingRequests().length;
    countEl.textContent = count;
    countEl.style.display = count > 0 ? 'inline' : 'none';
  },

  /**
   * ステータスバッジを取得
   */
  getStatusBadge(status) {
    switch (status) {
      case 'pending':
        return '<span class="badge badge-warning">承認待ち</span>';
      case 'approved':
        return '<span class="badge badge-success">承認済み</span>';
      case 'rejected':
        return '<span class="badge badge-danger">却下</span>';
      default:
        return '<span class="badge badge-secondary">不明</span>';
    }
  },

  /**
   * 申請タイプのラベルを取得
   */
  getTypeLabel(type) {
    switch (type) {
      case 'attendance_edit':
        return '勤怠修正申請';
      case 'leave':
        return '有給休暇申請';
      case 'overtime':
        return '残業申請';
      default:
        return 'その他の申請';
    }
  },

  /**
   * 有給休暇申請を送信
   */
  submitLeaveRequest() {
    const user = Auth.getCurrentUser();
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate = document.getElementById('leaveEndDate').value;
    const leaveType = document.getElementById('leaveType').value;
    const reason = document.getElementById('leaveReason').value;

    if (!startDate || !reason) {
      alert('開始日と理由は必須です');
      return;
    }

    const request = {
      userId: user.id,
      userName: user.name,
      type: 'leave',
      date: startDate,
      endDate: endDate || startDate,
      leaveType: leaveType,
      reason: reason
    };

    Storage.createRequest(request);
    alert('有給休暇申請を送信しました');

    // フォームをリセット
    document.getElementById('leaveForm').reset();

    // 申請一覧を更新
    this.renderRequests();
    this.updatePendingCount();
  },

  /**
   * 申請を承認（管理者のみ）
   */
  approve(requestId) {
    // 管理者チェック
    if (!Auth.isAdmin()) {
      alert('承認は管理者のみ可能です');
      return;
    }

    if (!confirm('この申請を承認しますか？')) return;

    const request = Storage.getRequests().find(r => r.id === requestId);
    if (!request) return;

    Storage.updateRequest(requestId, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: Auth.getCurrentUser().id
    });

    // 勤怠修正の場合は実際のデータも更新
    if (request.type === 'attendance_edit') {
      Storage.saveAttendance({
        userId: request.userId,
        date: request.date,
        clockIn: request.clockIn,
        clockOut: request.clockOut,
        note: '修正申請により更新'
      });
    }

    alert('承認しました');
    this.renderRequests();
    this.updatePendingCount();
  },

  /**
   * 申請を却下（管理者のみ）
   */
  reject(requestId) {
    // 管理者チェック
    if (!Auth.isAdmin()) {
      alert('却下は管理者のみ可能です');
      return;
    }

    const reason = prompt('却下理由を入力してください');
    if (reason === null) return;

    Storage.updateRequest(requestId, {
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: Auth.getCurrentUser().id,
      rejectReason: reason
    });

    alert('却下しました');
    this.renderRequests();
    this.updatePendingCount();
  }
};

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('myRequestList')) {
    ApprovalManager.init();
  }
});
