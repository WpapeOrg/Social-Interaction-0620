const { request } = require("../../utils/request");

Page({
  data: {
    loading: false
  },
  onLoginTap() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    request({
      url: "/auth/wx-login",
      method: "POST",
      data: { code: "mock_code" }
    })
      .then((result) => {
        if (result && result.data && result.data.token) {
          wx.setStorageSync("token", `Bearer ${result.data.token}`);
          wx.switchTab({ url: "/pages/recommend/list" });
        } else {
          wx.showToast({ title: "登录失败", icon: "none" });
        }
      })
      .catch(() => wx.showToast({ title: "网络错误", icon: "none" }))
      .finally(() => this.setData({ loading: false }));
  }
});
