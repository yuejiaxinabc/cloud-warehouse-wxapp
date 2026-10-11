// 公共请求层：服务器地址内置，账号密码登录换取会话 Token
const BASE_URL = 'https://warehouse.yuejiaxin.ln.cn';

function getToken() {
  return wx.getStorageSync('mpToken') || '';
}

function getUser() {
  return wx.getStorageSync('mpUser') || null;
}

function isLoggedIn() {
  return !!getToken();
}

function logout() {
  wx.removeStorageSync('mpToken');
  wx.removeStorageSync('mpUser');
}

function request(method, path, data, skipAuth) {
  return new Promise((resolve, reject) => {
    if (!skipAuth && !isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      reject(new Error('请先登录'));
      return;
    }
    wx.request({
      url: BASE_URL + path,
      method,
      data: data || {},
      timeout: 15000,
      header: skipAuth ? {} : { Authorization: 'Bearer ' + getToken() },
      success(res) {
        if (res.statusCode === 401) {
          if (!skipAuth) {
            logout();
            wx.reLaunch({ url: '/pages/login/login' });
          }
          reject(new Error(res.data && res.data.error ? res.data.error : '请先登录'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.success) {
          resolve(res.data);
        } else {
          reject(new Error((res.data && res.data.error) || '请求失败(' + res.statusCode + ')'));
        }
      },
      fail() {
        reject(new Error('网络异常，请稍后再试'));
      },
    });
  });
}

const api = {
  BASE_URL,
  get: (path) => request('GET', path),
  post: (path, data) => request('POST', path, data),
  patch: (path, data) => request('PATCH', path, data),
  put: (path, data) => request('PUT', path, data),

  isLoggedIn,
  logout,
  getUser,

  // 账号密码登录
  async login(username, password) {
    const res = await request('POST', '/api/v1/mp/login', { username, password }, true);
    wx.setStorageSync('mpToken', res.data.token);
    wx.setStorageSync('mpUser', res.data.user);
    return res;
  },

  // 扫码（封装 promise，取消返回 null）
  scan() {
    return new Promise((resolve) => {
      wx.scanCode({
        onlyFromCamera: false,
        success: (res) => resolve(res.result || ''),
        fail: () => resolve(null),
      });
    });
  },
};

module.exports = api;
