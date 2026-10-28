/**
 * Seed dữ liệu tối thiểu cho môi trường dev.
 * Idempotent: chạy nhiều lần không tạo bản ghi trùng.
 *
 *   npm run db:seed -w @ats/backend
 *   (hoặc tự chạy sau `prisma migrate reset`)
 */
import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface SeedUser {
  email: string;
  fullName: string;
  role: Role;
  password: string;
}

const USERS: SeedUser[] = [
  {
    email: 'admin@demo.com',
    fullName: 'Mai Quang Vũ (HR Manager)',
    role: Role.ADMIN,
    password: 'Admin@123',
  },
  {
    email: 'reviewer1@demo.com',
    fullName: 'Giám khảo Nguyễn Văn An',
    role: Role.INTERVIEWER,
    password: 'Review@123',
  },
  {
    email: 'reviewer2@demo.com',
    fullName: 'Giám khảo Trần Thị Bình',
    role: Role.INTERVIEWER,
    password: 'Review@123',
  },
  {
    email: 'reviewer3@demo.com',
    fullName: 'Giám khảo Lê Hoàng Cường',
    role: Role.INTERVIEWER,
    password: 'Review@123',
  },
];

async function main(): Promise<void> {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, rounds);

    await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: u.role, status: UserStatus.ACTIVE, passwordHash },
      create: {
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
    });

    console.log(`  ✓ ${u.role.padEnd(11)} ${u.email}`);
  }

  const total = await prisma.user.count();
  console.log(`\n✅ Seed xong — ${total} người dùng trong DB.`);
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed thất bại:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
