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
        if (!result || !result.data || !result.data.token) {
          wx.showToast({ title: "登录失败", icon: "none" });
          return;
        }
        wx.setStorageSync("token", `Bearer ${result.data.token}`);
        request({ url: "/profile/me" }).then((profileResult) => {
          const status = profileResult && profileResult.data && profileResult.data.status;
          if (status === "banned") {
            wx.removeStorageSync("token");
            wx.showModal({
              title: "账号受限",
              content: "当前账号已被封禁，无法继续使用该功能。",
              showCancel: false
            });
            return;
          }
          wx.switchTab({ url: "/pages/recommend/list" });
        });
      })
      .catch(() => wx.showToast({ title: "网络错误", icon: "none" }))
      .finally(() => this.setData({ loading: false }));
  }
});
