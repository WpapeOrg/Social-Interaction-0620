Page({
  data: {
    nickname: "",
    city: "",
    bio: ""
  },
  onInputNickname(e) {
    this.setData({ nickname: e.detail.value });
  },
  onInputCity(e) {
    this.setData({ city: e.detail.value });
  },
  onInputBio(e) {
    this.setData({ bio: e.detail.value });
  },
  onSubmit() {
    wx.showToast({ title: "资料已保存（待联调）", icon: "none" });
  }
});
