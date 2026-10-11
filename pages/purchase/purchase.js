const api = require('../../utils/api');

const STATUS_TEXT = { PENDING: '待采购', PURCHASING: '已采购', COMPLETED: '采购完成', CANCELLED: '已取消' };

Page({
  data: {
    items: [], statusFilter: '',
    warehouses: [], locations: [], boxes: [],
    form: { warehouseId: 0, locationId: 0, boxId: 0 },
    warehouseName: '', locationCode: '', boxCode: '',
    createOpen: false, inboundOpen: false,
    inboundTarget: null,
    createForm: { name: '', model: '', color: '', size: '', quantity: '', remark: '' },
    unitCost: '',
    creating: false, inbounding: false,
  },

  onShow() {
    if (!api.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadItems();
  },

  setStatus(e) {
    this.setData({ statusFilter: e.currentTarget.dataset.s });
    this.loadItems();
  },

  async loadItems() {
    try {
      const res = await api.get('/api/v1/mp/purchase?page=1&status=' + this.data.statusFilter);
      const items = (res.data.items || []).map((it) => ({
        ...it,
        statusText: STATUS_TEXT[it.status] || it.status,
        quantity: Number(it.quantity),
      }));
      this.setData({ items });
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },

  // ===== 新增 =====
  openCreate() { this.setData({ createOpen: true }); },
  closeCreate() { this.setData({ createOpen: false }); },
  onField(e) {
    const f = e.currentTarget.dataset.f;
    this.setData({ [`createForm.${f}`]: e.detail.value });
  },

  async submitCreate() {
    const f = this.data.createForm;
    if (!f.name.trim()) { wx.showToast({ title: '请输入备件名称', icon: 'none' }); return; }
    const qty = Number(f.quantity);
    if (!qty || qty <= 0) { wx.showToast({ title: '请输入正确数量', icon: 'none' }); return; }

    this.setData({ creating: true });
    try {
      const res = await api.post('/api/v1/mp/purchase', {
        name: f.name, model: f.model, color: f.color, size: f.size, quantity: qty, remark: f.remark,
      });
      wx.showToast({ title: res.message, icon: 'success' });
      this.setData({ createOpen: false, createForm: { name: '', model: '', color: '', size: '', quantity: '', remark: '' } });
      this.loadItems();
    } catch (e) {
      wx.showModal({ title: '提交失败', content: e.message, showCancel: false });
    } finally {
      this.setData({ creating: false });
    }
  },

  // ===== 状态流转 =====
  async markPurchased(e) {
    await this.flow(e.currentTarget.dataset.id, 'purchase', '已标记为已采购');
  },
  async markCompleted(e) {
    await this.flow(e.currentTarget.dataset.id, 'complete', '已标记为采购完成');
  },
  async flow(id, action, tip) {
    try {
      const res = await api.patch('/api/v1/mp/purchase', { id, action });
      wx.showToast({ title: res.message || tip, icon: 'success' });
      this.loadItems();
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  // ===== 入库 =====
  async openInbound(e) {
    const id = e.currentTarget.dataset.id;
    const target = this.data.items.find((it) => it.id === id);
    this.setData({
      inboundOpen: true, inboundTarget: target,
      form: { warehouseId: 0, locationId: 0, boxId: 0 },
      warehouseName: '', locationCode: '', boxCode: '', locations: [], boxes: [], unitCost: '',
    });
    try {
      const res = await api.get('/api/v1/mp/warehouses');
      this.setData({ warehouses: res.data || [] });
    } catch (err) { /* 静默 */ }
  },
  closeInbound() { this.setData({ inboundOpen: false }); },
  onUnitCost(e) { this.setData({ unitCost: e.detail.value }); },

  async onWarehouseChange(e) {
    const w = this.data.warehouses[Number(e.detail.value)];
    this.setData({ form: { ...this.data.form, warehouseId: w.id, locationId: 0, boxId: 0 }, warehouseName: w.name, locationCode: '', boxCode: '', boxes: [] });
    try {
      const res = await api.get('/api/v1/mp/locations?warehouseId=' + w.id);
      this.setData({ locations: res.data || [] });
    } catch (err) { wx.showToast({ title: err.message, icon: 'none' }); }
  },

  async onLocationChange(e) {
    const l = this.data.locations[Number(e.detail.value)];
    this.setData({ form: { ...this.data.form, locationId: l.id, boxId: 0 }, locationCode: l.code, boxCode: '' });
    try {
      const res = await api.get('/api/v1/mp/boxes?locationId=' + l.id);
      this.setData({ boxes: res.data || [] });
    } catch (err) { wx.showToast({ title: err.message, icon: 'none' }); }
  },

  onBoxChange(e) {
    const b = this.data.boxes[Number(e.detail.value)];
    this.setData({ form: { ...this.data.form, boxId: b.id }, boxCode: b.code });
  },

  async submitInbound() {
    const { form, inboundTarget, unitCost } = this.data;
    if (!form.warehouseId || !form.locationId || !form.boxId) {
      wx.showToast({ title: '请选择仓库、货位和盒子', icon: 'none' });
      return;
    }
    this.setData({ inbounding: true });
    try {
      const payload = { id: inboundTarget.id, warehouseId: form.warehouseId, locationId: form.locationId, boxId: form.boxId };
      if (unitCost) payload.unitCost = Number(unitCost);
      const res = await api.put('/api/v1/mp/purchase', payload);
      wx.showModal({ title: '入库成功', content: res.message, showCancel: false });
      this.setData({ inboundOpen: false });
      this.loadItems();
    } catch (e) {
      wx.showModal({ title: '入库失败', content: e.message, showCancel: false });
    } finally {
      this.setData({ inbounding: false });
    }
  },
});
