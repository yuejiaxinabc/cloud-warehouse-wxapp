const api = require('../../utils/api');

Page({
  data: { username: '', password: '', showPwd: false, loading: false },

  onLoad() {
    // 已登录直接进首页
    if (api.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  onUserInput(e) { this.setData({ username: e.detail.value }); },
  onPwdInput(e) { this.setData({ password: e.detail.value }); },
  togglePwd() { this.setData({ showPwd: !this.data.showPwd }); },

  async handleLogin() {
    const username = (this.data.username || '').trim();
    const password = (this.data.password || '').trim();
    if (!username || !password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await api.login(username, password);
      wx.showToast({ title: `欢迎，${res.data.user.realName || res.data.user.username}`, icon: 'none' });
      setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 600);
    } catch (e) {
      wx.showModal({ title: '登录失败', content: e.message, showCancel: false });
    } finally {
      this.setData({ loading: false });
    }
  },
});
