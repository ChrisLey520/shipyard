-- SSR 预览蓝绿：记录当前活跃的 PM2 槽位（0 或 1），与 -bg0 / -bg1 进程名对应
ALTER TABLE "Preview" ADD COLUMN "ssrBgSlot" INTEGER;
