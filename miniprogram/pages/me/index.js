const { request } = require("../../utils/request");

Page({
  data: {
    loadingNotificationSettings: false,
    savingNotificationSettings: false,
    notificationSettings: {
      pushEnabled: true,
      messagePushEnabled: true,
      matchPushEnabled: true
    }
  },
  onShow() {
    this.loadNotificationSettings();
  },
  loadNotificationSettings() {
    this.setData({ loadingNotificationSettings: true });
    request({ url: "/notifications/settings" })
      .then((result) => {
        const data = result?.data || {};
        this.setData({
          notificationSettings: {
            pushEnabled: Boolean(data.pushEnabled),
            messagePushEnabled: Boolean(data.messagePushEnabled),
            matchPushEnabled: Boolean(data.matchPushEnabled)
          }
        });
      })
      .catch(() => {
        wx.showToast({ title: "通知设置加载失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ loadingNotificationSettings: false });
      });
  },
  onTogglePush(e) {
    this.setData({
      "notificationSettings.pushEnabled": Boolean(e.detail.value)
    });
  },
  onToggleMessagePush(e) {
    this.setData({
      "notificationSettings.messagePushEnabled": Boolean(e.detail.value)
    });
  },
  onToggleMatchPush(e) {
    this.setData({
      "notificationSettings.matchPushEnabled": Boolean(e.detail.value)
    });
  },
  onSaveNotificationSettings() {
    if (this.data.savingNotificationSettings) return;
    this.setData({ savingNotificationSettings: true });
    request({
      url: "/notifications/settings",
      method: "PUT",
      data: this.data.notificationSettings
    })
      .then(() => {
        wx.showToast({ title: "通知设置已保存", icon: "none" });
      })
      .catch(() => {
        wx.showToast({ title: "保存失败，请稍后重试", icon: "none" });
      })
      .finally(() => {
        this.setData({ savingNotificationSettings: false });
      });
  },
  toProfile() {
    wx.navigateTo({ url: "/pages/profile/edit" });
  }
});
