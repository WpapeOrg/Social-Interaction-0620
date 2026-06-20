const { request } = require("../../utils/request");

Page({
  data: {
    list: [],
    loading: false
  },
  onShow() {
    this.fetchRecommendations();
  },
  fetchRecommendations() {
    this.setData({ loading: true });
    request({ url: "/recommendations" })
      .then((result) => {
        this.setData({ list: (result && result.data) || [] });
      })
      .catch(() => wx.showToast({ title: "加载失败", icon: "none" }))
      .finally(() => this.setData({ loading: false }));
  },
  onLike(e) {
    const targetUserId = e.currentTarget.dataset.id;
    request({
      url: "/swipes",
      method: "POST",
      data: { targetUserId, action: "like" }
    }).then(() => this.fetchRecommendations());
  },
  onPass(e) {
    const targetUserId = e.currentTarget.dataset.id;
    request({
      url: "/swipes",
      method: "POST",
      data: { targetUserId, action: "pass" }
    }).then(() => this.fetchRecommendations());
  }
});
