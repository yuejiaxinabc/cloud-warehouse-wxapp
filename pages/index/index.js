const api = require('../../utils/api');

Page({
  data: {
    // 看板
    stats: {}, warehouseValues: [], trend: [], pending: {},
    // 查询
    keyword: '', items: [], searched: false, loading: false,
  },

  onShow() {
    if (!api.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadDashboard();
  },

  async loadDashboard() {    try {
      const res = await api.get('/api/v1/mp/dashboard');
      const d = res.data;
      // 趋势柱高归一化（最大值=150rpx）
      const maxVal = Math.max(1, ...d.trend.map((t) => Math.max(t.inbound, t.outbound, t.transfer)));
      const trend = d.trend.map((t) => ({
        ...t,
        inMax: Math.max(4, Math.round((t.inbound / maxVal) * 150)),
        outMax: Math.max(4, Math.round((t.outbound / maxVal) * 150)),
        trMax: Math.max(4, Math.round((t.transfer / maxVal) * 150)),
      }));
      this.setData({
        stats: d.stats, warehouseValues: d.warehouseValues, trend, pending: d.pending,
      });
    } catch (e) { /* 看板失败不打断查询 */ }
  },

  goPurchase() { wx.navigateTo({ url: '/pages/purchase/purchase' }); },
  goStockIn() { wx.switchTab({ url: '/pages/stock-in/stock-in' }); },
  goStockOut() { wx.switchTab({ url: '/pages/stock-out/stock-out' }); },
  goStocktake() { wx.switchTab({ url: '/pages/stocktake/stocktake' }); },

  onInput(e) { this.setData({ keyword: e.detail.value }); },

  async doSearch() {
    const kw = (this.data.keyword || '').trim();
    if (!kw) {
      wx.showToast({ title: '请输入搜索内容', icon: 'none' });
      return;
    }
    await this.search(kw);
  },

  async scanAndSearch() {
    const code = await api.scan();
    if (!code) return;
    this.setData({ keyword: code });
    await this.search(code.trim());
  },

  async search(kw) {
    this.setData({ loading: true });
    try {
      const res = await api.get('/api/v1/mp/inventory/search?keyword=' + encodeURIComponent(kw));
      this.setData({ items: res.data.items || [], searched: true });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
