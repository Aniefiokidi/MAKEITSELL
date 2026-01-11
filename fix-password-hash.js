const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function fixPasswordHash() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    // List all databases
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    console.log('Available databases:', dbs.databases.map(db => db.name));
    
    // Try different database names
    const dbNames = ['makeitsell', 'test', 'gote-marketplace', 'admin'];
    
    for (const dbName of dbNames) {
      console.log(`\n=== Checking database: ${dbName} ===`);
      const db = client.db(dbName);
      const usersCollection = db.collection('users');
      
      const allUsers = await usersCollection.find({}).toArray();
      console.log(`Total users in ${dbName}:`, allUsers.length);
      
      if (allUsers.length > 0) {
        console.log('Users:', allUsers.map(u => ({ 
          email: u.email, 
          name: u.name, 
          role: u.role,
          hasPasswordHash: !!u.passwordHash 
        })));
        
        // Find and fix the user
        const emails = ['idiong.arnold@stu.cu.edu.ng', 'arnoldeee123@gmail.com', 'Aideeidiong@gmail.com'];
        
        for (const email of emails) {
          const user = await usersCollection.findOne({ email });
          
          if (user) {
            console.log('\n=== Fixing user:', email, '===');
            const newPasswordHash = hashPassword('123456');
            console.log('New password hash:', newPasswordHash);
            
            const result = await usersCollection.updateOne(
              { email: email },
              { $set: { passwordHash: newPasswordHash } }
            );
            
            console.log('Update result:', result);
            console.log('Password has been reset to "123456"');
            return;
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

fixPasswordHash();
