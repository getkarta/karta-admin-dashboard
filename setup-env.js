#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up environment variables for Agentic AI Guide Server\n');

// Check if .env file already exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists!');
  const existingContent = fs.readFileSync(envPath, 'utf8');
  console.log('Current content:');
  console.log(existingContent);
  console.log('\nIf you need to update your API key, please edit the .env file manually.\n');
} else {
  console.log('📝 Creating .env file...');
  
  const envContent = `# OpenAI API Configuration
# Get your API key from: https://platform.openai.com/account/api-keys
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=3001
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!');
  console.log('📋 Please edit the .env file and replace "your_openai_api_key_here" with your actual OpenAI API key.');
}

console.log('\n🚀 To run the server:');
console.log('   npm start');
console.log('   or');
console.log('   node server.js');
console.log('\n🌐 Server will be available at: http://localhost:3001'); 