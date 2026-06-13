import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Ensure default user exists
  const existingUser = await prisma.user.findUnique({
    where: { id: "default" },
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        id: "default",
        email: "default@hermes.app",
        name: "HERMÈS User",
      },
    });
    console.log("  ✅ Default user created");
  } else {
    console.log("  ℹ️  Default user already exists — skipping");
  }

  // Ensure default user settings exist
  const existingSettings = await prisma.userSettings.findUnique({
    where: { userId: "default" },
  });

  if (!existingSettings) {
    await prisma.userSettings.create({
      data: {
        userId: "default",
        provider: "groq",
        model: "llama-3.3-70b-versatile",
      },
    });
    console.log("  ✅ Default user settings created");
  } else {
    console.log("  ℹ️  Default user settings already exist — skipping");
  }

  // Ensure default metrics exist
  const existingMetrics = await prisma.metrics.findUnique({
    where: { userId: "default" },
  });

  if (!existingMetrics) {
    await prisma.metrics.create({
      data: {
        userId: "default",
      },
    });
    console.log("  ✅ Default metrics created");
  } else {
    console.log("  ℹ️  Default metrics already exist — skipping");
  }

  console.log("🌱 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
