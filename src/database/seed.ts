import { db } from "./db";
import { users, pcs, foodMenu } from "./schema";

export async function seed() {
  console.log("Seeding database...");

 
    const adminPassword = await Bun.password.hash("admin123");
    await db.insert(users).values({
      username: "admin",
      password: adminPassword,
      role: "admin",
      balance: 99999,
    }).onConflictDoNothing();

  
    console.log("🖥️  Generating 30 PCs...");
    for (let i = 1; i <= 30; i++) {

      const formattedNumber = `PC-${i.toString().padStart(2, '0')}`;

      await db.insert(pcs).values({
        pcNumber: formattedNumber,
        status: "vacant"
      }).onConflictDoNothing();
    }
  const items = [
    { name: "Es Teh Manis", price: 2 },
    { name: "Kopi Hitam", price: 2 },
    { name: "Es Jeruk", price: 3 },
    { name: "Es Kopi Susu", price: 3 },
    { name: "Indomie Goreng", price: 4 },
    { name: "Indomie Kuah", price: 4 },
    { name: "Kentang Goreng", price: 5 },
    { name: "Indomie Goreng + Telur", price: 6 },
    { name: "Roti Bakar", price: 6 },
    { name: "Nasi Goreng", price: 8 },
  ];
  for (const item of items) {
    await db.insert(foodMenu).values(item);
  }

  console.log("Menu has been added");
  process.exit(0);
}
