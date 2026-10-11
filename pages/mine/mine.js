const api = require('../../utils/api');

Page({
  data: { user: {} },

  onShow() {
    if (!api.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadUser();
  },

  async loadUser() {
    const cached = api.getUser() || {};
    this.setData({ user: cached });
    // 拉最新身份信息
    try {
      const res = await api.get('/api/v1/mp/me');
      if (res.data.user) {
        this.setData({ user: res.data.user });
        wx.setStorageSync('mpUser', res.data.user);
      }
    } catch (e) { /* 用缓存兜底 */ }
  },

  relogin() {
    wx.showModal({
      title: '切换账号',
      content: '将退出当前账号并前往登录页',
      success: (r) => {
        if (r.confirm) {
          api.logout();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号？',
      success: (r) => {
        if (r.confirm) {
          api.logout();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },
});
