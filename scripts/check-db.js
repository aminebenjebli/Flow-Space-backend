const { PrismaClient } = require('@prisma/client');

async function checkDatabase() {
    const prisma = new PrismaClient();

    try {
        const userCount = await prisma.user.count();
        console.log('✅ DB connection OK, users:', userCount);
        await prisma.$disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ DB error:', error.message);
        if (error.message.includes('replica set')) {
            console.log(
                '💡 MongoDB replica set required. Run: npm run db:start'
            );
        }
        await prisma.$disconnect();
        process.exit(1);
    }
}

checkDatabase();
