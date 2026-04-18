import { ref, shallowRef } from 'vue';

export type TypedDestructivePayloadMp = {
  title: string;
  description: string;
  expected: string;
  expectedLabel: string;
  positiveText: string;
  onConfirm: () => void | Promise<void>;
};

export const typedDestructiveShowMp = ref(false);
export const typedDestructivePayloadMp = shallowRef<TypedDestructivePayloadMp | null>(null);
export const typedDestructiveDraftMp = ref('');
export const typedDestructiveSubmittingMp = ref(false);

export function openTypedDestructiveMp(p: TypedDestructivePayloadMp) {
  typedDestructivePayloadMp.value = p;
  typedDestructiveDraftMp.value = '';
  typedDestructiveSubmittingMp.value = false;
  typedDestructiveShowMp.value = true;
}

/** 关闭弹层；其余字段由 TypedDestructiveConfirmHost 内 watch 清理 */
export function closeTypedDestructiveMp() {
  typedDestructiveShowMp.value = false;
}
