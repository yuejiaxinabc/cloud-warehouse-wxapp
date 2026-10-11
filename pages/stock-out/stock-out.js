const api = require('../../utils/api');

Page({
  data: {
    code: '', quantity: '', remark: '',
    product: null, suggestions: [],
    warehouses: [],
    warehouseId: 0, warehouseName: '',
    submitting: false,
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
    const p = this.data.suggestions[Number(e.currentTarget.dataset.index)];
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

  onWarehouseChange(e) {
    const w = this.data.warehouses[Number(e.detail.value)];
    this.setData({ warehouseId: w.id, warehouseName: w.name });
  },

  async submit() {
    const { code, quantity, product, warehouseId, remark } = this.data;
    if (!product) { wx.showToast({ title: '请先选择商品', icon: 'none' }); return; }
    const qty = Number(quantity);
    if (!qty || qty <= 0) { wx.showToast({ title: '请输入正确数量', icon: 'none' }); return; }

    this.setData({ submitting: true });
    try {
      const payload = { code: product.code, quantity: qty, remark };
      if (warehouseId) payload.warehouseId = warehouseId;
      const res = await api.post('/api/v1/mp/stock-out', payload);
      wx.showModal({
        title: '出库成功',
        content: `${res.message}\n商品：${res.data.productName} × ${res.data.quantity}\n仓库：${res.data.warehouseName}\n剩余库存：${res.data.remainStock}`,
        showCancel: false,
      });
      this.setData({ code: '', quantity: '', remark: '', product: null });
    } catch (e) {
      wx.showModal({ title: '出库失败', content: e.message, showCancel: false });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
