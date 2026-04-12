/** 自定义导航栏：状态栏高度 + 与胶囊对齐的内容区高度（同步读取，避免首帧高度跳变） */
export function readMpNavBarLayout() {
  const win = uni.getWindowInfo();
  const statusBarHeight = win.statusBarHeight ?? 20;
  let navContentHeight = 44;
  let rightInset = 16;
  try {
    const m = uni.getMenuButtonBoundingClientRect?.();
    if (m && m.height > 0 && m.top > 0) {
      const gap = m.top - statusBarHeight;
      navContentHeight = Math.max(44, gap * 2 + m.height);
      rightInset = Math.max(16, win.windowWidth - m.left + 8);
    }
  } catch {
    /* 非微信端或 API 不可用 */
  }
  return {
    statusBarHeight,
    navContentHeight,
    totalHeight: statusBarHeight + navContentHeight,
    rightInset,
  };
}
