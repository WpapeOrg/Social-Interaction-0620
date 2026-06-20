const app = getApp();

function request({ url, method = "GET", data = {} }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBaseUrl}${url}`,
      method,
      data,
      header: {
        "Content-Type": "application/json",
        Authorization: wx.getStorageSync("token") || ""
      },
      success: (res) => resolve(res.data),
      fail: reject
    });
  });
}

module.exports = {
  request
};
