-- Local deploy executor stores no SSH server binding on Environment.
ALTER TABLE "Environment" ALTER COLUMN "serverId" DROP NOT NULL;
