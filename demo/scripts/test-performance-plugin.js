#!/usr/bin/env node

/**
 * Performance Plugin Test Script
 * 
 * This script tests the Performance Simulator plugin functionality
 * by making AJAX requests to the demo WordPress environment.
 */

const http = require('http');
const querystring = require('querystring');

class PerformancePluginTester {
    constructor(baseUrl = 'http://localhost:8090') {
        this.baseUrl = baseUrl;
        this.ajaxUrl = `${baseUrl}/wp-admin/admin-ajax.php`;
        this.testResults = [];
    }

    async testScenario(scenario) {
        console.log(`Testing ${scenario} scenario...`);
        
        const postData = querystring.stringify({
            action: `demo_${scenario}`
        });

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const req = http.request(this.ajaxUrl, options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    const endTime = Date.now();
                    const responseTime = endTime - startTime;
                    
                    try {
                        const response = JSON.parse(data);
                        const result = {
                            scenario,
                            success: response.success || false,
                            responseTime,
                            data: response.data || null,
                            statusCode: res.statusCode
                        };
                        
                        this.testResults.push(result);
                        console.log(`✓ ${scenario}: ${responseTime}ms (${response.success ? 'SUCCESS' : 'FAILED'})`);
                        resolve(result);
                    } catch (error) {
                        console.log(`✗ ${scenario}: Parse error - ${error.message}`);
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                console.log(`✗ ${scenario}: Request error - ${error.message}`);
                reject(error);
            });

            req.setTimeout(30000, () => {
                console.log(`✗ ${scenario}: Timeout after 30 seconds`);
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(postData);
            req.end();
        });
    }

    async runAllTests() {
        console.log('Performance Plugin Test Suite');
        console.log('============================\n');

        const scenarios = ['light_load', 'medium_load', 'heavy_load', 'critical_load'];
        
        for (const scenario of scenarios) {
            try {
                await this.testScenario(scenario);
                // Add delay between tests to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Failed to test ${scenario}:`, error.message);
            }
        }

        // Test legacy endpoints
        console.log('\nTesting legacy endpoints...');
        try {
            await this.testLegacyEndpoint('slow_action');
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.testLegacyEndpoint('memory_spike');
        } catch (error) {
            console.error('Failed to test legacy endpoints:', error.message);
        }

        this.printSummary();
    }

    async testLegacyEndpoint(action) {
        console.log(`Testing legacy ${action} endpoint...`);
        
        const postData = querystring.stringify({
            action: `demo_${action}`
        });

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const req = http.request(this.ajaxUrl, options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    const endTime = Date.now();
                    const responseTime = endTime - startTime;
                    
                    try {
                        const response = JSON.parse(data);
                        console.log(`✓ ${action}: ${responseTime}ms (${response.success ? 'SUCCESS' : 'FAILED'})`);
                        resolve(response);
                    } catch (error) {
                        console.log(`✗ ${action}: Parse error - ${error.message}`);
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                console.log(`✗ ${action}: Request error - ${error.message}`);
                reject(error);
            });

            req.setTimeout(20000, () => {
                console.log(`✗ ${action}: Timeout after 20 seconds`);
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(postData);
            req.end();
        });
    }

    printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log('TEST SUMMARY');
        console.log('='.repeat(50));
        
        const successful = this.testResults.filter(r => r.success).length;
        const total = this.testResults.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(`Successful: ${successful}`);
        console.log(`Failed: ${total - successful}`);
        console.log(`Success Rate: ${((successful / total) * 100).toFixed(1)}%`);
        
        console.log('\nResponse Time Analysis:');
        this.testResults.forEach(result => {
            if (result.success && result.data) {
                console.log(`  ${result.scenario}: ${result.responseTime}ms (server: ${result.data.execution_time || 'N/A'}s)`);
            }
        });
        
        console.log('\nPerformance Expectations:');
        console.log('  light_load: 100-500ms');
        console.log('  medium_load: 500-2000ms');
        console.log('  heavy_load: 2000-8000ms');
        console.log('  critical_load: 8000-15000ms');
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const tester = new PerformancePluginTester();
    tester.runAllTests().catch(console.error);
}

module.exports = PerformancePluginTester;
