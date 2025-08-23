#!/usr/bin/env node

/**
 * Test script for the demo data generator
 * This script tests the data generator functionality without requiring a database connection
 */

const DemoDataGenerator = require('./generate-demo-data.js');

async function testGenerator() {
    console.log('Testing Demo Data Generator...');
    
    try {
        const generator = new DemoDataGenerator();
        
        // Test configuration
        console.log('✓ Generator instance created');
        console.log('✓ Configuration loaded:', {
            host: generator.config.host,
            database: generator.config.database,
            dataSize: generator.dataSize
        });
        
        // Test utility methods
        console.log('✓ Testing utility methods...');
        
        const timestamp = generator.getRandomTimestamp();
        console.log('  - Random timestamp:', timestamp);
        
        const hash = generator.generateHash('test_input');
        console.log('  - Generated hash:', hash);
        
        const smallCount = generator.getDataCount('test', 10, 50, 100);
        console.log('  - Data count (medium):', smallCount);
        
        // Test data size configurations
        generator.dataSize = 'small';
        const smallDataCount = generator.getDataCount('test', 10, 50, 100);
        console.log('  - Data count (small):', smallDataCount);
        
        generator.dataSize = 'large';
        const largeDataCount = generator.getDataCount('test', 10, 50, 100);
        console.log('  - Data count (large):', largeDataCount);
        
        console.log('✅ All tests passed! Demo data generator is ready.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run tests if called directly
if (require.main === module) {
    testGenerator();
}

module.exports = testGenerator;
