const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gote-marketplace'

async function checkToken() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB\n')

    const db = mongoose.connection.db

    // Get all recent login tokens
    const tokens = await db.collection('login_tokens').find({}).sort({ createdAt: -1 }).limit(5).toArray()
    
    console.log('Recent login tokens:')
    tokens.forEach(token => {
      console.log({
        token: token.token.substring(0, 20) + '...',
        email: token.email,
        userId: token.userId,
        used: token.used,
        expired: token.expiresAt < new Date(),
        createdAt: token.createdAt
      })
    })

    // Check if user exists for latest token
    if (tokens[0]) {
      const user = await db.collection('users').findOne({ _id: tokens[0].userId })
      console.log('\nUser for latest token:', user ? {
        _id: user._id,
        email: user.email,
        role: user.role
      } : 'NOT FOUND')
    }

    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

checkToken()
