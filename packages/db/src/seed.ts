import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const org = await prisma.organisation.create({
    data: {
      name: 'Amata Technologies Ltd',
      tin: 'P0001234567',
      vatNumber: 'V0012345678',
      address: '123 Accra Road, Accra, Ghana',
      phone: '+233 30 123 4567',
      email: 'info@amata.com',
    },
  });
  console.log('Created organisation:', org.name);

  const branch1 = await prisma.branch.create({
    data: {
      name: 'Head Office',
      code: 'HO001',
      address: '123 Accra Road, Accra, Ghana',
      phone: '+233 30 123 4567',
      email: 'ho@amata.com',
      organisationId: org.id,
      isActive: true,
    },
  });

  const branch2 = await prisma.branch.create({
    data: {
      name: 'West Hills Mall',
      code: 'WH001',
      address: 'West Hills Mall, Accra',
      phone: '+233 30 234 5678',
      email: 'wh@amata.com',
      organisationId: org.id,
      isActive: true,
    },
  });

  console.log('Created branches');

  const passwordHash = await bcrypt.hash('password123', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@amata.com',
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: 'ORG_ADMIN',
      organisationId: org.id,
      branchId: branch1.id,
      isActive: true,
    },
  });
  console.log('Created admin user:', admin.email);

  const cashier = await prisma.user.create({
    data: {
      email: 'cashier@amata.com',
      passwordHash,
      firstName: 'John',
      lastName: 'Doe',
      role: 'CASHIER',
      organisationId: org.id,
      branchId: branch1.id,
      isActive: true,
    },
  });
  console.log('Created cashier user:', cashier.email);

  const category1 = await prisma.category.create({
    data: {
      name: 'Electronics',
      description: 'Electronic items and accessories',
      organisationId: org.id,
    },
  });

  const category2 = await prisma.category.create({
    data: {
      name: 'Beverages',
      description: 'Drinks and beverages',
      organisationId: org.id,
    },
  });

  console.log('Created categories');

  const products = [
    { name: 'USB Cable', sku: 'ELEC001', barcode: '1234567890123', unitPrice: 25.00, categoryId: category1.id },
    { name: 'Phone Charger', sku: 'ELEC002', barcode: '1234567890124', unitPrice: 45.00, categoryId: category1.id },
    { name: 'Headphones', sku: 'ELEC003', barcode: '1234567890125', unitPrice: 120.00, categoryId: category1.id },
    { name: 'Power Bank 10000mAh', sku: 'ELEC004', barcode: '1234567890126', unitPrice: 180.00, categoryId: category1.id },
    { name: 'Water Bottle 500ml', sku: 'BEV001', barcode: '2234567890123', unitPrice: 5.00, categoryId: category2.id },
    { name: 'Energy Drink', sku: 'BEV002', barcode: '2234567890124', unitPrice: 12.00, categoryId: category2.id },
    { name: 'Soft Drink 350ml', sku: 'BEV003', barcode: '2234567890125', unitPrice: 8.00, categoryId: category2.id },
  ];

  for (const productData of products) {
    const product = await prisma.product.create({
      data: {
        ...productData,
        organisationId: org.id,
        branchId: branch1.id,
        isActive: true,
        isTrackStock: true,
        minStock: 10,
      },
    });

    await prisma.inventory.create({
      data: {
        productId: product.id,
        branchId: branch1.id,
        quantity: Math.floor(Math.random() * 100) + 20,
        reorderLevel: 10,
      },
    });

    await prisma.inventory.create({
      data: {
        productId: product.id,
        branchId: branch2.id,
        quantity: Math.floor(Math.random() * 50) + 10,
        reorderLevel: 10,
      },
    });
  }

  console.log('Created products and inventory');

  const device = await prisma.device.create({
    data: {
      name: 'POS-001',
      type: 'POS',
      serialNumber: 'SN123456',
      branchId: branch1.id,
      organisationId: org.id,
      status: 'ACTIVE',
      lastHeartbeat: new Date(),
    },
  });
  console.log('Created device:', device.name);

  console.log('\n✅ Database seeded successfully!');
  console.log('\nLogin credentials:');
  console.log('  Admin: admin@amata.com / password123');
  console.log('  Cashier: cashier@amata.com / password123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });