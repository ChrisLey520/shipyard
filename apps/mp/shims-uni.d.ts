/// <reference types='@dcloudio/types' />
import 'vue'

declare module '@vue/runtime-core' {
  type Hooks = App.AppInstance & Page.PageInstance;

  /** 与 uni-app 的 App/Page 实例类型合并；占位字段避免「空 interface 等价于 supertype」告警 */
  interface ComponentCustomOptions extends Hooks {
    __uniComponentCustomOptions?: never;
  }
}
