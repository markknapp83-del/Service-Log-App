// Database seeding following SQLite documentation patterns
import { UserRepository } from '@/models/UserRepository.js';
import { logger } from '@/utils/logger.js';
import bcrypt from 'bcryptjs';

export async function seedDatabase(): Promise<void> {
  logger.info('Starting database seeding');
  
  const userRepo = new UserRepository();

  try {
    // Check if admin user already exists
    const existingAdmin = await userRepo.findByEmail('admin@healthcare.local');
    
    if (!existingAdmin) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await userRepo.create({
        username: 'admin',
        email: 'admin@healthcare.local',
        passwordHash: hashedPassword,
        role: 'admin',
        firstName: 'System',
        lastName: 'Administrator',
        isActive: true,
        lastLoginAt: undefined
      });
      
      logger.info('Default admin user created', { email: 'admin@healthcare.local' });
    }

    // Create default candidate user for testing
    const existingCandidate = await userRepo.findByEmail('candidate@healthcare.local');
    
    if (!existingCandidate) {
      const hashedPassword = await bcrypt.hash('candidate123', 12);
      
      await userRepo.create({
        username: 'candidate',
        email: 'candidate@healthcare.local',
        passwordHash: hashedPassword,
        role: 'candidate',
        firstName: 'Test',
        lastName: 'Candidate',
        isActive: true,
        lastLoginAt: undefined
      });
      
      logger.info('Default candidate user created', { email: 'candidate@healthcare.local' });
    }

    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Error seeding database', { error });
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}