/**
 * 認証システム
 * ログイン/ログアウト処理を担当
 */

const Auth = {
  /**
   * ログイン処理
   */
  login(email, password) {
    const user = Storage.getUserByEmail(email);

    if (!user) {
      return { success: false, message: 'メールアドレスが見つかりません' };
    }

    if (user.password !== password) {
      return { success: false, message: 'パスワードが正しくありません' };
    }

    // パスワードを除いてユーザー情報を保存
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;
    Storage.setCurrentUser(userWithoutPassword);

    return { success: true, user: userWithoutPassword };
  },

  /**
   * ログアウト処理
   */
  logout() {
    Storage.logout();
    window.location.href = 'index.html';
  },

  /**
   * 現在のユーザーを取得
   */
  getCurrentUser() {
    return Storage.getCurrentUser();
  },

  /**
   * ログイン状態をチェック
   */
  isLoggedIn() {
    return Storage.getCurrentUser() !== null;
  },

  /**
   * 管理者かどうかをチェック
   */
  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === 'admin';
  },

  /**
   * 認証が必要なページのチェック
   */
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },

  /**
   * 管理者権限が必要なページのチェック
   */
  requireAdmin() {
    if (!this.isLoggedIn()) {
      window.location.href = 'index.html';
      return false;
    }
    if (!this.isAdmin()) {
      alert('このページにアクセスする権限がありません');
      window.location.href = 'dashboard.html';
      return false;
    }
    return true;
  },

  /**
   * ヘッダーのユーザー情報を更新
   */
  updateHeaderUser() {
    const user = this.getCurrentUser();
    const userNameEl = document.querySelector('.header-user-name');
    if (userNameEl && user) {
      userNameEl.textContent = user.name;
    }
  },

  /**
   * ログインフォームの初期化
   */
  initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const remember = document.getElementById('remember')?.checked;

      const result = this.login(email, password);

      if (result.success) {
        if (remember) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }
        window.location.href = 'dashboard.html';
      } else {
        this.showError(result.message);
      }
    });

    // 記憶されたメールアドレスを復元
    const rememberedEmail = localStorage.getItem('remembered_email');
    if (rememberedEmail) {
      document.getElementById('email').value = rememberedEmail;
      const rememberCheckbox = document.getElementById('remember');
      if (rememberCheckbox) {
        rememberCheckbox.checked = true;
      }
    }
  },

  /**
   * エラーメッセージを表示
   */
  showError(message) {
    let errorEl = document.querySelector('.login-error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'alert alert-danger login-error';
      const form = document.getElementById('loginForm');
      form.insertBefore(errorEl, form.firstChild);
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';

    // 3秒後に非表示
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 3000);
  },

  /**
   * ログアウトボタンの初期化
   */
  initLogoutButton() {
    const logoutBtn = document.querySelector('.btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }
  }
};

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
  // ログインページの場合
  if (document.getElementById('loginForm')) {
    // 既にログインしている場合はダッシュボードへ
    if (Auth.isLoggedIn()) {
      window.location.href = 'dashboard.html';
    } else {
      Auth.initLoginForm();
    }
  } else {
    // その他のページは認証必須
    if (Auth.requireAuth()) {
      Auth.updateHeaderUser();
      Auth.initLogoutButton();
    }
  }
});
