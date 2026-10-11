const api = require('../../utils/api');

Page({
  data: {
    code: '', quantity: '', remark: '',
    product: null, suggestions: [],
    form: { warehouseId: 0, locationId: 0, boxId: 0 },
    warehouseName: '', locationCode: '', boxCode: '',
    warehouses: [], locations: [], boxes: [],
    submitting: false, searching: false,
  },

  onShow() {
    if (!api.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadWarehouses();
  },

  onCodeInput(e) {
    const code = e.detail.value;
    this.setData({ code });
    this.searchSuggest(code);
  },

  // 输入即搜（300ms 防抖）
  searchSuggest(kw) {
    clearTimeout(this._t);
    if (!kw || !kw.trim()) { this.setData({ suggestions: [] }); return; }
    this._t = setTimeout(async () => {
      try {
        const res = await api.get('/api/v1/mp/inventory/search?keyword=' + encodeURIComponent(kw.trim()));
        this.setData({ suggestions: (res.data.items || []).slice(0, 6) });
      } catch (e) { /* 静默 */ }
    }, 300);
  },

  pickSuggestion(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const p = this.data.suggestions[idx];
    this.setData({ product: p, code: p.code, suggestions: [] });
  },

  clearProduct() { this.setData({ product: null, code: '', suggestions: [] }); },

  async scanProduct() {
    const code = await api.scan();
    if (!code) return;
    this.setData({ code });
    try {
      const res = await api.get('/api/v1/mp/inventory/search?keyword=' + encodeURIComponent(code.trim()));
      const items = res.data.items || [];
      const exact = items.find((it) => it.code === code || it.barcode === code) || items[0];
      if (!exact) { wx.showToast({ title: '未找到该商品', icon: 'none' }); return; }
      this.setData({ product: exact, suggestions: [] });
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },

  lookupProduct() {
    const code = (this.data.code || '').trim();
    if (!code) { wx.showToast({ title: '请输入关键词', icon: 'none' }); return; }
    this.searchSuggest(code);
    clearTimeout(this._t);
    api.get('/api/v1/mp/inventory/search?keyword=' + encodeURIComponent(code)).then((res) => {
      const items = res.data.items || [];
      const exact = items.find((it) => it.code === code || it.barcode === code) || items[0];
      if (exact) this.setData({ product: exact, suggestions: [] });
      else wx.showToast({ title: '未找到匹配商品', icon: 'none' });
    }).catch((e) => wx.showToast({ title: e.message, icon: 'none' }));
  },

  onQtyInput(e) { this.setData({ quantity: e.detail.value }); },
  incQty() { this.setData({ quantity: String((parseInt(this.data.quantity) || 0) + 1) }); },
  decQty() { const v = (parseInt(this.data.quantity) || 0) - 1; this.setData({ quantity: String(Math.max(1, v)) }); },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }); },

  async loadWarehouses() {
    try {
      const res = await api.get('/api/v1/mp/warehouses');
      this.setData({ warehouses: res.data || [] });
    } catch (e) { /* 静默 */ }
  },

  // 扫盒子码：A-1-1-1 → 自动定位
  async scanBox() {
    const code = await api.scan();
    if (!code) return;
    try {
      const res = await api.get('/api/v1/mp/box?code=' + encodeURIComponent(code.trim()));
      const d = res.data;
      this.setData({
        form: { warehouseId: d.warehouseId, locationId: d.locationId, boxId: d.boxId },
        warehouseName: d.warehouseName, locationCode: d.locationCode, boxCode: d.boxCode,
      });
      await this.loadLocations(d.warehouseId, d.locationId, d.boxId);
      wx.showToast({ title: '已定位 ' + d.boxCode, icon: 'success' });
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },

  async loadLocations(warehouseId, selectLocationId, selectBoxId) {
    try {
      const res = await api.get('/api/v1/mp/locations?warehouseId=' + warehouseId);
      this.setData({ locations: res.data || [] });
      if (selectLocationId) await this.loadBoxes(selectLocationId, selectBoxId);
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },

  async onWarehouseChange(e) {
    const w = this.data.warehouses[Number(e.detail.value)];
    this.setData({ form: { ...this.data.form, warehouseId: w.id, locationId: 0, boxId: 0 }, warehouseName: w.name, locationCode: '', boxCode: '', boxes: [] });
    await this.loadLocations(w.id);
  },

  async onLocationChange(e) {
    const l = this.data.locations[Number(e.detail.value)];
    this.setData({ form: { ...this.data.form, locationId: l.id, boxId: 0 }, locationCode: l.code, boxCode: '' });
    await this.loadBoxes(l.id);
  },

  async loadBoxes(locationId, selectBoxId) {
    try {
      const res = await api.get('/api/v1/mp/boxes?locationId=' + locationId);
      const boxes = res.data || [];
      this.setData({ boxes });
      if (selectBoxId) {
        const b = boxes.find((x) => x.id === selectBoxId);
        if (b) this.setData({ form: { ...this.data.form, boxId: b.id }, boxCode: b.code });
      }
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },

  onBoxChange(e) {
    const b = this.data.boxes[Number(e.detail.value)];
    this.setData({ form: { ...this.data.form, boxId: b.id }, boxCode: b.code });
  },

  async submit() {
    const { code, quantity, product, form, remark } = this.data;
    if (!product) { wx.showToast({ title: '请先选择商品', icon: 'none' }); return; }
    const qty = Number(quantity);
    if (!qty || qty <= 0) { wx.showToast({ title: '请输入正确数量', icon: 'none' }); return; }
    if (!form.warehouseId || !form.locationId || !form.boxId) {
      wx.showToast({ title: '请选择仓库、货位和盒子', icon: 'none' }); return;
    }

    this.setData({ submitting: true });
    try {
      const res = await api.post('/api/v1/mp/stock-in', {
        code: product.code, quantity: qty,
        warehouseId: form.warehouseId, locationId: form.locationId, boxId: form.boxId,
        remark,
      });
      wx.showModal({
        title: '入库成功',
        content: `${res.message}\n商品：${res.data.productName} × ${res.data.quantity}\n位置：${res.data.boxCode || ''}`,
        showCancel: false,
      });
      this.setData({ code: '', quantity: '', remark: '', product: null, boxCode: '' });
    } catch (e) {
      wx.showModal({ title: '入库失败', content: e.message, showCancel: false });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
