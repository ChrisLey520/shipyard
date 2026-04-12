import { ref, shallowRef } from 'vue';

/** 危险操作确认：须与 expected 完全一致（trim 后比较） */
export type DestructiveNameConfirmOptions = {
  title: string;
  description: string;
  /** 用户须在输入框中完整输入此字符串（区分大小写，首尾空格忽略） */
  expected: string;
  /** 输入框上方说明，如「项目 URL 标识（slug）」 */
  expectedLabel: string;
  positiveText: string;
  onConfirm: () => void | Promise<void>;
};

export const destructiveNameConfirmShow = ref(false);
export const destructiveNameConfirmOptions = shallowRef<DestructiveNameConfirmOptions | null>(null);
export const destructiveNameConfirmDraft = ref('');
export const destructiveNameConfirmSubmitting = ref(false);

export function openDestructiveNameConfirm(opts: DestructiveNameConfirmOptions) {
  destructiveNameConfirmOptions.value = opts;
  destructiveNameConfirmDraft.value = '';
  destructiveNameConfirmSubmitting.value = false;
  destructiveNameConfirmShow.value = true;
}

export function closeDestructiveNameConfirm() {
  destructiveNameConfirmShow.value = false;
  destructiveNameConfirmOptions.value = null;
  destructiveNameConfirmDraft.value = '';
  destructiveNameConfirmSubmitting.value = false;
}
