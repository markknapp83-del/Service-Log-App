// Database seeding following SQLite documentation patterns
import { UserRepository } from '@/models/UserRepository';
import { ClientRepository } from '@/models/ClientRepository';
import { ActivityRepository } from '@/models/ActivityRepository';
import { OutcomeRepository } from '@/models/OutcomeRepository';
import { logger } from '@/utils/logger';
import bcrypt from 'bcryptjs';

export async function seedDatabase(): Promise<void> {
  logger.info('Starting database seeding');
  
  const userRepo = new UserRepository();
  const clientRepo = new ClientRepository();
  const activityRepo = new ActivityRepository();
  const outcomeRepo = new OutcomeRepository();

  try {
    // Create default admin user
    let adminUser;
    const existingAdmin = userRepo.findByEmail('admin@healthcare.local');
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      adminUser = userRepo.create({
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
    } else {
      adminUser = existingAdmin;
    }

    // Create default candidate user for testing
    let candidateUser;
    const existingCandidate = userRepo.findByEmail('candidate@healthcare.local');
    
    if (!existingCandidate) {
      const hashedPassword = await bcrypt.hash('candidate123', 12);
      
      candidateUser = userRepo.create({
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
    } else {
      candidateUser = existingCandidate;
    }

    // Create test user with the credentials requested
    let testUser;
    const existingTestUser = userRepo.findByEmail('test@test.com');
    
    if (!existingTestUser) {
      const hashedPassword = await bcrypt.hash('password123', 12);
      
      testUser = userRepo.create({
        username: 'testuser',
        email: 'test@test.com',
        passwordHash: hashedPassword,
        role: 'candidate',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        lastLoginAt: undefined
      });
      
      logger.info('Test user created', { email: 'test@test.com' });
    } else {
      testUser = existingTestUser;
    }

    // Seed Clients/Sites - Healthcare facilities
    const defaultClients = [
      { name: 'Main Hospital', isActive: true },
      { name: 'Community Clinic', isActive: true },
      { name: 'Outpatient Center', isActive: true },
      { name: 'Emergency Department', isActive: true },
      { name: 'Pediatric Ward', isActive: true },
      { name: 'Mental Health Unit', isActive: true }
    ];

    for (const clientData of defaultClients) {
      try {
        clientRepo.createClient(clientData, adminUser.id);
      } catch (error) {
        // Skip if already exists
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }
    logger.info('Default clients seeded');

    // Seed Activities/Specialties - Healthcare services
    const defaultActivities = [
      { name: 'General Consultation', isActive: true },
      { name: 'Physical Therapy', isActive: true },
      { name: 'Diagnostic Imaging', isActive: true },
      { name: 'Laboratory Tests', isActive: true },
      { name: 'Preventive Care', isActive: true },
      { name: 'Emergency Treatment', isActive: true },
      { name: 'Specialist Referral', isActive: true },
      { name: 'Mental Health Counseling', isActive: true },
      { name: 'Chronic Care Management', isActive: true },
      { name: 'Rehabilitation Services', isActive: true }
    ];

    for (const activityData of defaultActivities) {
      try {
        activityRepo.createActivity(activityData, adminUser.id);
      } catch (error) {
        // Skip if already exists
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }
    logger.info('Default activities seeded');

    // Seed Outcomes - Healthcare service outcomes
    const defaultOutcomes = [
      { name: 'Treatment Completed Successfully', isActive: true },
      { name: 'Referred to Specialist', isActive: true },
      { name: 'Follow-up Required', isActive: true },
      { name: 'Emergency Intervention', isActive: true },
      { name: 'Discharged to Home Care', isActive: true },
      { name: 'Admitted for Further Treatment', isActive: true },
      { name: 'Treatment Declined by Patient', isActive: true },
      { name: 'No Show - Appointment Missed', isActive: true },
      { name: 'Medication Prescribed', isActive: true },
      { name: 'Condition Stable', isActive: true },
      { name: 'Condition Improved', isActive: true },
      { name: 'Condition Requires Monitoring', isActive: true }
    ];

    for (const outcomeData of defaultOutcomes) {
      try {
        outcomeRepo.createOutcome(outcomeData, adminUser.id);
      } catch (error) {
        // Skip if already exists
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }
    logger.info('Default outcomes seeded');

    // Log seeded data counts
    const clientCount = clientRepo.count();
    const activityCount = activityRepo.count();
    const outcomeCount = outcomeRepo.count();

    logger.info('Database seeding completed successfully', {
      users: 3,
      clients: clientCount,
      activities: activityCount,
      outcomes: outcomeCount
    });

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