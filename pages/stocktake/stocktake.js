const api = require('../../utils/api');

const STATUS_TEXT = { DRAFT: '待开始', COUNTING: '盘点中', ADJUSTED: '已结算' };

Page({
  data: {
    warehouses: [], warehouseId: 0, warehouseName: '',
    orders: [], detail: null,
    creating: false, settling: false,
  },

  onShow() {
    if (!api.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadWarehouses();
    this.loadOrders();
  },

  statusText(s) { return STATUS_TEXT[s] || s; },

  async loadWarehouses() {
    try {
      const res = await api.get('/api/v1/mp/warehouses');
      this.setData({ warehouses: res.data || [] });
    } catch (e) { /* 静默 */ }
  },

  async loadOrders() {
    try {
      const res = await api.get('/api/v1/mp/stocktake?page=1');
      const orders = (res.data.items || []).map((o) => ({ ...o, statusText: STATUS_TEXT[o.status] || o.status }));
      this.setData({ orders });
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },

  onWarehouseChange(e) {
    const idx = Number(e.detail.value);
    const w = this.data.warehouses[idx];
    this.setData({ warehouseId: w.id, warehouseName: w.name });
  },

  async createOrder() {
    if (!this.data.warehouseId) {
      wx.showToast({ title: '请选择仓库', icon: 'none' });
      return;
    }
    this.setData({ creating: true });
    try {
      const res = await api.post('/api/v1/mp/stocktake', { warehouseId: this.data.warehouseId });
      wx.showToast({ title: res.message, icon: 'none' });
      await this.loadOrders();
      await this.openDetailById(res.data.id);
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    } finally {
      this.setData({ creating: false });
    }
  },

  openDetail(e) { this.openDetailById(e.currentTarget.dataset.id); },

  async openDetailById(id) {
    try {
      const res = await api.get('/api/v1/mp/stocktake?id=' + id);
      const d = res.data;
      d.statusText = STATUS_TEXT[d.status] || d.status;
      d.countItems = (d.countItems || []).map((it) => ({
        ...it,
        product: it.product || { name: '（商品已删除 #' + it.productId + '）', code: '-' },
        countQty: it.countQty === null ? null : Number(it.countQty),
        diffQty: it.diffQty === null ? null : Number(it.diffQty),
      }));
      this.setData({ detail: d });
      wx.pageScrollTo({ scrollTop: 0, duration: 200 });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },

  closeDetail() {
    this.setData({ detail: null });
    this.loadOrders();
  },

  // 开始盘点：DRAFT → COUNTING（与 Web 一致）
  async startStocktake() {
    const d = this.data.detail;
    try {
      const res = await api.post('/api/v1/mp/stocktake', { action: 'start', orderId: d.id });
      wx.showToast({ title: res.message || '盘点已开始', icon: 'success' });
      await this.openDetailById(d.id);
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },

  onCountInput(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const key = `detail.countItems[${idx}].countQty`;
    const v = e.detail.value === '' ? null : Number(e.detail.value);
    this.setData({ [key]: v });
  },

  // 保存盘点数据：走 enterCount（与 Web 一致，自动计算差异）
  async saveItem(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const item = this.data.detail.countItems[idx];
    if (item.countQty === null || item.countQty === undefined) {
      wx.showToast({ title: '请输入实盘数量', icon: 'none' });
      return;
    }
    try {
      const res = await api.patch('/api/v1/mp/stocktake', {
        orderId: this.data.detail.id, itemId: item.id, countQty: item.countQty,
      });
      const key = `detail.countItems[${idx}].diffQty`;
      this.setData({ [key]: res.data.diffQty });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  // 结算盘点：仅盘点中可结算（与 Web 一致）
  async settle() {
    const d = this.data.detail;
    const uncounted = d.countItems.filter((it) => it.countQty === null || it.countQty === undefined).length;
    if (uncounted > 0) {
      wx.showToast({ title: `还有 ${uncounted} 个商品未录入`, icon: 'none' });
      return;
    }
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '确认结算',
        content: '结算后将按差异自动生成库存调整，且不可撤销',
        success: (r) => resolve(r.confirm),
      });
    });
    if (!confirm) return;

    this.setData({ settling: true });
    try {
      const res = await api.put('/api/v1/mp/stocktake', { orderId: d.id });
      wx.showModal({ title: '结算完成', content: res.message || '盘点结算完成', showCancel: false });
      await this.openDetailById(d.id);
    } catch (e) {
      wx.showModal({ title: '结算失败', content: e.message, showCancel: false });
    } finally {
      this.setData({ settling: false });
    }
  },
});
