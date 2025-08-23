#!/usr/bin/env node

/**
 * Demo Data Generator for WordPress Performance Dashboard
 * 
 * This script generates realistic demo data for the WordPress database
 * including performance logs, slow queries, and AJAX call data.
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

class DemoDataGenerator {
    constructor() {
        this.config = {
            host: process.env.DB_HOST || 'demo-mysql',
            user: process.env.DB_USER || 'demo_user',
            password: process.env.DB_PASSWORD || 'demo_password',
            database: process.env.DB_NAME || 'demo_wordpress',
            port: process.env.DB_PORT || 3306
        };
        
        this.dataSize = process.env.DEMO_DATA_SIZE || 'medium';
        this.connection = null;
    }
    
    async connect() {
        try {
            console.log('Connecting to MySQL database...');
            this.connection = await mysql.createConnection(this.config);
            console.log('Connected to database successfully');
        } catch (error) {
            console.error('Database connection failed:', error.message);
            throw error;
        }
    }
    
    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            console.log('Database connection closed');
        }
    }
    
    async generateDemoData() {
        try {
            await this.connect();
            
            console.log('Starting demo data generation...');
            
            // Wait for WordPress to be ready
            await this.waitForWordPress();
            
            // Generate WordPress content data
            await this.generateWordPressUsers();
            await this.generateWordPressPosts();
            await this.generateWordPressPages();
            await this.generateMediaMetadata();
            await this.generateComments();
            
            // Generate performance data
            await this.generatePerformanceLogs();
            await this.generateSlowQueries();
            await this.generateAjaxCalls();
            await this.generatePluginPerformanceData();
            
            // Validate generated data
            await this.validateGeneratedData();
            
            console.log('Demo data generation completed successfully');
            
        } catch (error) {
            console.error('Demo data generation failed:', error.message);
            throw error;
        } finally {
            await this.disconnect();
        }
    }
    
    async waitForWordPress() {
        console.log('Waiting for WordPress to be ready...');
        
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            try {
                // Check if WordPress tables exist
                const [tables] = await this.connection.execute(
                    "SHOW TABLES LIKE 'wp_%'"
                );
                
                if (tables.length === 0) {
                    console.log(`Attempt ${attempts + 1}/${maxAttempts}: WordPress tables not found, waiting...`);
                    await this.sleep(5000);
                    attempts++;
                    continue;
                }
                
                // Check if WordPress is initialized
                const [rows] = await this.connection.execute(
                    'SELECT COUNT(*) as count FROM wp_options WHERE option_name = "siteurl"'
                );
                
                if (rows[0].count > 0) {
                    console.log('WordPress is ready and initialized');
                    return true;
                }
                
                console.log(`Attempt ${attempts + 1}/${maxAttempts}: Waiting for WordPress initialization...`);
                await this.sleep(5000);
                attempts++;
                
            } catch (error) {
                console.log(`Attempt ${attempts + 1}/${maxAttempts}: Database not ready yet (${error.message})`);
                await this.sleep(5000);
                attempts++;
            }
        }
        
        console.log('WordPress not fully ready, but proceeding with data generation');
        return false;
    }
    
    async generatePerformanceLogs() {
        console.log('Generating performance logs with varied query patterns...');
        
        // Create performance logs table if it doesn't exist
        await this.connection.execute(`
            CREATE TABLE IF NOT EXISTS wp_performance_logs (
                id mediumint(9) NOT NULL AUTO_INCREMENT,
                timestamp datetime DEFAULT CURRENT_TIMESTAMP,
                query_type varchar(50) NOT NULL,
                execution_time float NOT NULL,
                query_hash varchar(32),
                affected_rows int,
                plugin_context varchar(100),
                query_pattern varchar(100),
                memory_usage int DEFAULT 0,
                PRIMARY KEY (id),
                KEY timestamp (timestamp),
                KEY query_type (query_type),
                KEY plugin_context (plugin_context),
                KEY query_pattern (query_pattern)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        const logCount = this.getDataCount('performance_logs', 1000, 5000, 10000);
        
        // Define varied query patterns for realistic performance simulation
        const queryPatterns = [
            {
                type: 'SELECT',
                pattern: 'post_lookup',
                plugin: 'core',
                avgTime: 0.05,
                variance: 0.02,
                memoryBase: 1024 * 100 // 100KB
            },
            {
                type: 'SELECT',
                pattern: 'meta_query',
                plugin: 'core',
                avgTime: 0.15,
                variance: 0.08,
                memoryBase: 1024 * 200 // 200KB
            },
            {
                type: 'SELECT',
                pattern: 'taxonomy_query',
                plugin: 'core',
                avgTime: 0.08,
                variance: 0.04,
                memoryBase: 1024 * 150 // 150KB
            },
            {
                type: 'SELECT',
                pattern: 'user_query',
                plugin: 'core',
                avgTime: 0.03,
                variance: 0.01,
                memoryBase: 1024 * 80 // 80KB
            },
            {
                type: 'SELECT',
                pattern: 'options_lookup',
                plugin: 'core',
                avgTime: 0.02,
                variance: 0.005,
                memoryBase: 1024 * 50 // 50KB
            },
            {
                type: 'INSERT',
                pattern: 'post_insert',
                plugin: 'core',
                avgTime: 0.12,
                variance: 0.05,
                memoryBase: 1024 * 300 // 300KB
            },
            {
                type: 'UPDATE',
                pattern: 'post_update',
                plugin: 'core',
                avgTime: 0.08,
                variance: 0.03,
                memoryBase: 1024 * 250 // 250KB
            },
            {
                type: 'DELETE',
                pattern: 'cleanup',
                plugin: 'core',
                avgTime: 0.06,
                variance: 0.02,
                memoryBase: 1024 * 100 // 100KB
            },
            // Plugin-specific patterns
            {
                type: 'SELECT',
                pattern: 'product_search',
                plugin: 'woocommerce',
                avgTime: 0.25,
                variance: 0.15,
                memoryBase: 1024 * 500 // 500KB
            },
            {
                type: 'SELECT',
                pattern: 'seo_analysis',
                plugin: 'yoast-seo',
                avgTime: 0.18,
                variance: 0.08,
                memoryBase: 1024 * 400 // 400KB
            },
            {
                type: 'SELECT',
                pattern: 'form_submission',
                plugin: 'contact-form-7',
                avgTime: 0.10,
                variance: 0.04,
                memoryBase: 1024 * 200 // 200KB
            },
            {
                type: 'SELECT',
                pattern: 'performance_test',
                plugin: 'performance-simulator',
                avgTime: 1.5,
                variance: 0.8,
                memoryBase: 1024 * 1024 * 2 // 2MB
            },
            {
                type: 'UPDATE',
                pattern: 'cache_update',
                plugin: 'performance-simulator',
                avgTime: 0.5,
                variance: 0.3,
                memoryBase: 1024 * 800 // 800KB
            }
        ];
        
        console.log(`Generating ${logCount} performance log entries with varied patterns...`);
        
        for (let i = 0; i < logCount; i++) {
            const pattern = queryPatterns[Math.floor(Math.random() * queryPatterns.length)];
            
            // Generate execution time based on pattern with realistic variance
            let executionTime = pattern.avgTime + (Math.random() - 0.5) * pattern.variance * 2;
            
            // Add occasional spikes (5% chance of 3-10x slower)
            if (Math.random() < 0.05) {
                executionTime *= (Math.random() * 7 + 3); // 3-10x multiplier
            }
            
            // Ensure minimum execution time
            executionTime = Math.max(executionTime, 0.001);
            
            // Generate memory usage with variance
            const memoryUsage = Math.floor(pattern.memoryBase * (0.5 + Math.random()));
            
            // Generate affected rows based on query type
            let affectedRows;
            switch (pattern.type) {
                case 'SELECT':
                    affectedRows = Math.floor(Math.random() * 100);
                    break;
                case 'INSERT':
                    affectedRows = 1;
                    break;
                case 'UPDATE':
                    affectedRows = Math.floor(Math.random() * 10) + 1;
                    break;
                case 'DELETE':
                    affectedRows = Math.floor(Math.random() * 5);
                    break;
                default:
                    affectedRows = 0;
            }
            
            const timestamp = this.getRandomTimestamp();
            const queryHash = this.generateHash(`${pattern.type}_${pattern.pattern}_${pattern.plugin}_${i}`);
            
            await this.connection.execute(`
                INSERT INTO wp_performance_logs 
                (timestamp, query_type, execution_time, query_hash, affected_rows, plugin_context, query_pattern, memory_usage)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [timestamp, pattern.type, executionTime, queryHash, affectedRows, pattern.plugin, pattern.pattern, memoryUsage]);
            
            if (i % 100 === 0) {
                console.log(`Generated ${i}/${logCount} performance logs...`);
            }
        }
        
        console.log('Performance logs with varied query patterns generated successfully');
    }
    
    async generateSlowQueries() {
        console.log('Generating slow query data...');
        
        const slowQueryCount = this.getDataCount('slow_queries', 50, 200, 500);
        
        const slowQueries = [
            'SELECT * FROM wp_posts WHERE post_content LIKE "%performance%" ORDER BY RAND()',
            'SELECT p.*, pm.* FROM wp_posts p LEFT JOIN wp_postmeta pm ON p.ID = pm.post_id WHERE p.post_status = "publish" ORDER BY p.post_date DESC',
            'SELECT COUNT(*) FROM wp_comments c LEFT JOIN wp_posts p ON c.comment_post_ID = p.ID WHERE p.post_status = "publish"',
            'UPDATE wp_options SET option_value = CONCAT(option_value, "_updated") WHERE option_name LIKE "theme_%"',
            'SELECT u.*, um.* FROM wp_users u LEFT JOIN wp_usermeta um ON u.ID = um.user_id ORDER BY u.user_registered DESC'
        ];
        
        console.log(`Generating ${slowQueryCount} slow query entries...`);
        
        for (let i = 0; i < slowQueryCount; i++) {
            const query = slowQueries[Math.floor(Math.random() * slowQueries.length)];
            const executionTime = Math.random() * 8 + 1; // 1-9 seconds
            const timestamp = this.getRandomTimestamp();
            const queryHash = this.generateHash(query);
            
            await this.connection.execute(`
                INSERT INTO wp_performance_logs 
                (timestamp, query_type, execution_time, query_hash, affected_rows, plugin_context)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [timestamp, 'slow_query', executionTime, queryHash, 0, 'slow-query-log']);
        }
        
        console.log('Slow query data generated successfully');
    }
    
    async generateAjaxCalls() {
        console.log('Generating realistic admin-ajax call simulation data...');
        
        // Create AJAX calls table if it doesn't exist
        await this.connection.execute(`
            CREATE TABLE IF NOT EXISTS wp_ajax_calls (
                id mediumint(9) NOT NULL AUTO_INCREMENT,
                action varchar(100) NOT NULL,
                execution_time float NOT NULL,
                response_size int DEFAULT 0,
                user_id bigint(20) DEFAULT 0,
                timestamp datetime DEFAULT CURRENT_TIMESTAMP,
                success tinyint(1) DEFAULT 1,
                request_method varchar(10) DEFAULT 'POST',
                user_agent varchar(255) DEFAULT '',
                ip_address varchar(45) DEFAULT '',
                nonce_verified tinyint(1) DEFAULT 1,
                PRIMARY KEY (id),
                KEY action (action),
                KEY timestamp (timestamp),
                KEY user_id (user_id),
                KEY success (success)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        const ajaxCount = this.getDataCount('ajax_calls', 200, 1000, 2000);
        
        // Define realistic admin-ajax actions with their characteristics
        const ajaxActions = [
            {
                action: 'heartbeat',
                avgTime: 0.08,
                variance: 0.03,
                avgSize: 150,
                frequency: 0.25, // 25% of all calls
                userTypes: ['admin', 'editor', 'author']
            },
            {
                action: 'save_post',
                avgTime: 0.35,
                variance: 0.15,
                avgSize: 500,
                frequency: 0.15,
                userTypes: ['admin', 'editor', 'author']
            },
            {
                action: 'inline_save',
                avgTime: 0.25,
                variance: 0.10,
                avgSize: 300,
                frequency: 0.10,
                userTypes: ['admin', 'editor']
            },
            {
                action: 'query_attachments',
                avgTime: 0.18,
                variance: 0.08,
                avgSize: 2500,
                frequency: 0.08,
                userTypes: ['admin', 'editor', 'author']
            },
            {
                action: 'fetch_list',
                avgTime: 0.12,
                variance: 0.05,
                avgSize: 1200,
                frequency: 0.12,
                userTypes: ['admin', 'editor']
            },
            {
                action: 'wp_compression_test',
                avgTime: 2.5,
                variance: 1.0,
                avgSize: 800,
                frequency: 0.02,
                userTypes: ['admin']
            },
            {
                action: 'load_more_posts',
                avgTime: 0.22,
                variance: 0.12,
                avgSize: 3500,
                frequency: 0.08,
                userTypes: ['admin', 'editor', 'author', 'subscriber']
            },
            {
                action: 'search_posts',
                avgTime: 0.28,
                variance: 0.15,
                avgSize: 1800,
                frequency: 0.06,
                userTypes: ['admin', 'editor', 'author']
            },
            {
                action: 'update_meta',
                avgTime: 0.15,
                variance: 0.06,
                avgSize: 200,
                frequency: 0.05,
                userTypes: ['admin', 'editor']
            },
            {
                action: 'delete_comment',
                avgTime: 0.10,
                variance: 0.04,
                avgSize: 100,
                frequency: 0.03,
                userTypes: ['admin', 'editor']
            },
            {
                action: 'approve_comment',
                avgTime: 0.08,
                variance: 0.03,
                avgSize: 120,
                frequency: 0.03,
                userTypes: ['admin', 'editor']
            },
            {
                action: 'demo_performance_test',
                avgTime: 1.8,
                variance: 0.8,
                avgSize: 600,
                frequency: 0.02,
                userTypes: ['admin']
            },
            {
                action: 'demo_memory_spike',
                avgTime: 3.2,
                variance: 1.5,
                avgSize: 400,
                frequency: 0.01,
                userTypes: ['admin']
            }
        ];
        
        // Get user IDs for different roles
        const [users] = await this.connection.execute(`
            SELECT u.ID, um.meta_value as capabilities 
            FROM wp_users u 
            LEFT JOIN wp_usermeta um ON u.ID = um.user_id 
            WHERE um.meta_key = 'wp_capabilities' 
            LIMIT 20
        `);
        
        const usersByRole = {
            admin: users.filter(u => u.capabilities && u.capabilities.includes('administrator')).map(u => u.ID),
            editor: users.filter(u => u.capabilities && u.capabilities.includes('editor')).map(u => u.ID),
            author: users.filter(u => u.capabilities && u.capabilities.includes('author')).map(u => u.ID),
            subscriber: users.filter(u => u.capabilities && u.capabilities.includes('subscriber')).map(u => u.ID)
        };
        
        // Fallback if no users found
        if (users.length === 0) {
            usersByRole.admin = [1];
            usersByRole.editor = [1];
            usersByRole.author = [1];
            usersByRole.subscriber = [1];
        }
        
        const userAgents = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
        ];
        
        const ipAddresses = [
            '192.168.1.100', '192.168.1.101', '192.168.1.102', '10.0.0.50',
            '172.16.0.10', '203.0.113.1', '198.51.100.1', '192.0.2.1'
        ];
        
        console.log(`Generating ${ajaxCount} realistic AJAX call entries...`);
        
        for (let i = 0; i < ajaxCount; i++) {
            // Select action based on frequency weights
            let selectedAction = null;
            const random = Math.random();
            let cumulativeFreq = 0;
            
            for (const actionData of ajaxActions) {
                cumulativeFreq += actionData.frequency;
                if (random <= cumulativeFreq) {
                    selectedAction = actionData;
                    break;
                }
            }
            
            // Fallback to first action if none selected
            if (!selectedAction) {
                selectedAction = ajaxActions[0];
            }
            
            // Generate execution time with realistic variance
            let executionTime = selectedAction.avgTime + (Math.random() - 0.5) * selectedAction.variance * 2;
            
            // Add occasional performance spikes (3% chance)
            if (Math.random() < 0.03) {
                executionTime *= (Math.random() * 5 + 2); // 2-7x slower
            }
            
            executionTime = Math.max(executionTime, 0.01); // Minimum 10ms
            
            // Generate response size with variance
            const responseSize = Math.floor(selectedAction.avgSize * (0.5 + Math.random() * 1.5));
            
            // Select appropriate user based on action's user types
            const allowedRoles = selectedAction.userTypes;
            const selectedRole = allowedRoles[Math.floor(Math.random() * allowedRoles.length)];
            const roleUsers = usersByRole[selectedRole] || [1];
            const userId = roleUsers[Math.floor(Math.random() * roleUsers.length)];
            
            // Generate success rate (higher for core actions, lower for demo actions)
            const successRate = selectedAction.action.startsWith('demo_') ? 0.85 : 0.97;
            const success = Math.random() < successRate ? 1 : 0;
            
            const timestamp = this.getRandomTimestamp();
            const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
            const ipAddress = ipAddresses[Math.floor(Math.random() * ipAddresses.length)];
            const nonceVerified = Math.random() < 0.98 ? 1 : 0; // 98% nonce verification success
            
            await this.connection.execute(`
                INSERT INTO wp_ajax_calls 
                (action, execution_time, response_size, user_id, timestamp, success, 
                 request_method, user_agent, ip_address, nonce_verified)
                VALUES (?, ?, ?, ?, ?, ?, 'POST', ?, ?, ?)
            `, [
                selectedAction.action, executionTime, responseSize, userId, timestamp, 
                success, userAgent, ipAddress, nonceVerified
            ]);
            
            if (i % 50 === 0) {
                console.log(`Generated ${i}/${ajaxCount} AJAX calls...`);
            }
        }
        
        console.log('Realistic admin-ajax call simulation data generated successfully');
    }
    
    async generatePluginPerformanceData() {
        console.log('Generating plugin performance data...');
        
        // Create plugin performance table if it doesn't exist
        await this.connection.execute(`
            CREATE TABLE IF NOT EXISTS wp_plugin_performance (
                id mediumint(9) NOT NULL AUTO_INCREMENT,
                plugin_name varchar(100) NOT NULL,
                hook_name varchar(100) NOT NULL,
                execution_time float NOT NULL,
                memory_usage int NOT NULL,
                call_count int DEFAULT 1,
                timestamp datetime DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY plugin_name (plugin_name),
                KEY hook_name (hook_name),
                KEY timestamp (timestamp)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        const pluginCount = this.getDataCount('plugin_performance', 300, 1500, 3000);
        
        const plugins = [
            'performance-simulator', 'woocommerce', 'yoast-seo', 
            'contact-form-7', 'akismet', 'jetpack', 'elementor'
        ];
        
        const hooks = [
            'init', 'wp_head', 'wp_footer', 'the_content', 'wp_enqueue_scripts',
            'admin_menu', 'save_post', 'wp_ajax_*', 'rest_api_init', 'wp_loaded'
        ];
        
        console.log(`Generating ${pluginCount} plugin performance entries...`);
        
        for (let i = 0; i < pluginCount; i++) {
            const plugin = plugins[Math.floor(Math.random() * plugins.length)];
            const hook = hooks[Math.floor(Math.random() * hooks.length)];
            
            // Generate realistic performance data based on plugin type
            let executionTime, memoryUsage;
            
            if (plugin === 'performance-simulator') {
                executionTime = Math.random() * 2 + 0.5; // 0.5-2.5 seconds
                memoryUsage = Math.floor(Math.random() * 5000000) + 1000000; // 1-6MB
            } else if (plugin === 'woocommerce' || plugin === 'elementor') {
                executionTime = Math.random() * 1 + 0.2; // 0.2-1.2 seconds
                memoryUsage = Math.floor(Math.random() * 3000000) + 500000; // 0.5-3.5MB
            } else {
                executionTime = Math.random() * 0.3 + 0.05; // 0.05-0.35 seconds
                memoryUsage = Math.floor(Math.random() * 1000000) + 100000; // 0.1-1.1MB
            }
            
            const callCount = Math.floor(Math.random() * 10) + 1;
            const timestamp = this.getRandomTimestamp();
            
            await this.connection.execute(`
                INSERT INTO wp_plugin_performance 
                (plugin_name, hook_name, execution_time, memory_usage, call_count, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [plugin, hook, executionTime, memoryUsage, callCount, timestamp]);
            
            if (i % 100 === 0) {
                console.log(`Generated ${i}/${pluginCount} plugin performance entries...`);
            }
        }
        
        console.log('Plugin performance data generated successfully');
    }
    
    getDataCount(type, small, medium, large) {
        switch (this.dataSize) {
            case 'small': return small;
            case 'large': return large;
            default: return medium;
        }
    }
    
    getRandomTimestamp() {
        // Generate timestamps from the last 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const randomTime = thirtyDaysAgo.getTime() + Math.random() * (now.getTime() - thirtyDaysAgo.getTime());
        return new Date(randomTime).toISOString().slice(0, 19).replace('T', ' ');
    }
    
    generateHash(input) {
        // Simple hash function for demo purposes
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
    }
    
    async generateWordPressUsers() {
        console.log('Generating additional WordPress users...');
        
        // Check if users already exist
        const [existingUsers] = await this.connection.execute(
            'SELECT COUNT(*) as count FROM wp_users WHERE user_login LIKE "demo_%"'
        );
        
        if (existingUsers[0].count > 0) {
            console.log('Demo users already exist, skipping user generation');
            return;
        }
        
        const additionalUsers = [
            {
                login: 'demo_performance_tester',
                email: 'performance@demo.local',
                display_name: 'Performance Tester',
                role: 'editor'
            },
            {
                login: 'demo_content_creator',
                email: 'content@demo.local',
                display_name: 'Content Creator',
                role: 'author'
            },
            {
                login: 'demo_site_visitor',
                email: 'visitor@demo.local',
                display_name: 'Site Visitor',
                role: 'subscriber'
            }
        ];
        
        for (const user of additionalUsers) {
            const userId = await this.createWordPressUser(user);
            if (userId) {
                console.log(`Created user: ${user.login} (ID: ${userId})`);
            }
        }
    }
    
    async createWordPressUser(userData) {
        try {
            // Insert user
            const [result] = await this.connection.execute(`
                INSERT INTO wp_users (user_login, user_pass, user_nicename, user_email, user_registered, display_name)
                VALUES (?, ?, ?, ?, NOW(), ?)
            `, [
                userData.login,
                '$P$B' + this.generateHash(userData.login + 'demo_password'), // WordPress password hash format
                userData.login.replace('_', '-'),
                userData.email,
                userData.display_name
            ]);
            
            const userId = result.insertId;
            
            // Add user meta
            await this.connection.execute(`
                INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES
                (?, 'wp_capabilities', ?),
                (?, 'wp_user_level', ?),
                (?, 'nickname', ?),
                (?, 'first_name', ?),
                (?, 'last_name', ?)
            `, [
                userId, `a:1:{s:${userData.role.length}:"${userData.role}";b:1;}`,
                userId, userData.role === 'administrator' ? '10' : (userData.role === 'editor' ? '7' : '0'),
                userId, userData.display_name,
                userId, userData.display_name.split(' ')[0] || '',
                userId, userData.display_name.split(' ')[1] || ''
            ]);
            
            return userId;
        } catch (error) {
            console.error(`Failed to create user ${userData.login}:`, error.message);
            return null;
        }
    }
    
    async generateWordPressPosts() {
        console.log('Generating additional WordPress posts...');
        
        const postCount = this.getDataCount('posts', 25, 75, 150);
        
        const postTitles = [
            'Advanced WordPress Performance Optimization Techniques',
            'Database Query Optimization for Large WordPress Sites',
            'Understanding WordPress Plugin Performance Impact',
            'Caching Strategies That Actually Work',
            'Memory Management in WordPress Development',
            'AJAX Performance: Best Practices and Common Pitfalls',
            'WordPress Security vs Performance: Finding the Balance',
            'Theme Development: Performance-First Approach',
            'Server Configuration for High-Traffic WordPress Sites',
            'Monitoring and Alerting for WordPress Performance',
            'CDN Integration for WordPress Performance',
            'Image Optimization Techniques for WordPress',
            'Database Indexing Strategies for WordPress',
            'PHP Performance Tuning for WordPress',
            'WordPress Multisite Performance Considerations'
        ];
        
        const postContent = [
            'This comprehensive guide explores advanced techniques for optimizing WordPress performance. We\'ll cover database optimization, caching strategies, and server-level improvements that can dramatically improve your site\'s speed and user experience.',
            'Database performance is crucial for WordPress sites. In this article, we examine query optimization techniques, proper indexing strategies, and how to identify and resolve slow database queries that impact site performance.',
            'Understanding how plugins affect your WordPress site\'s performance is essential for maintaining optimal speed. We\'ll analyze common performance bottlenecks and provide strategies for plugin selection and optimization.',
            'Effective caching can transform a slow WordPress site into a lightning-fast experience. This guide covers various caching layers, from browser caching to advanced server-side solutions.',
            'Memory management in WordPress development requires understanding PHP memory limits, object caching, and efficient coding practices. Learn how to write memory-efficient WordPress code.',
            'AJAX calls can significantly impact WordPress performance if not implemented correctly. This article covers best practices for admin-ajax usage and alternative approaches for better performance.'
        ];
        
        // Get existing user IDs
        const [users] = await this.connection.execute('SELECT ID FROM wp_users LIMIT 10');
        const userIds = users.map(user => user.ID);
        
        if (userIds.length === 0) {
            console.log('No users found, skipping post generation');
            return;
        }
        
        console.log(`Generating ${postCount} WordPress posts...`);
        
        for (let i = 0; i < postCount; i++) {
            const title = postTitles[i % postTitles.length] + (i >= postTitles.length ? ` #${Math.floor(i / postTitles.length) + 1}` : '');
            let content = postContent[i % postContent.length];
            
            // Vary content length for realistic performance testing
            if (i % 3 === 0) {
                content += '\n\n' + content; // Double content for some posts
            }
            if (i % 7 === 0) {
                content = content.repeat(3); // Triple content for heavy posts
            }
            
            const postDate = this.getRandomTimestamp();
            const authorId = userIds[Math.floor(Math.random() * userIds.length)];
            
            try {
                const [result] = await this.connection.execute(`
                    INSERT INTO wp_posts (post_author, post_date, post_date_gmt, post_content, post_title, 
                                        post_excerpt, post_status, comment_status, ping_status, post_name, 
                                        post_modified, post_modified_gmt, post_type)
                    VALUES (?, ?, ?, ?, ?, ?, 'publish', 'open', 'closed', ?, ?, ?, 'post')
                `, [
                    authorId, postDate, postDate, content, title, 
                    content.substring(0, 150) + '...', 
                    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                    postDate, postDate
                ]);
                
                const postId = result.insertId;
                
                // Add post meta for performance testing
                await this.connection.execute(`
                    INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES
                    (?, '_demo_performance_score', ?),
                    (?, '_demo_load_time', ?),
                    (?, '_demo_memory_usage', ?),
                    (?, '_demo_query_count', ?)
                `, [
                    postId, Math.floor(Math.random() * 40) + 60, // 60-100 performance score
                    postId, (Math.random() * 2 + 0.5).toFixed(3), // 0.5-2.5 seconds load time
                    postId, Math.floor(Math.random() * 50) + 10, // 10-60 MB memory usage
                    postId, Math.floor(Math.random() * 20) + 5 // 5-25 database queries
                ]);
                
            } catch (error) {
                console.error(`Failed to create post ${i + 1}:`, error.message);
            }
            
            if (i % 10 === 0) {
                console.log(`Generated ${i}/${postCount} posts...`);
            }
        }
        
        console.log('WordPress posts generated successfully');
    }
    
    async generateWordPressPages() {
        console.log('Generating WordPress pages...');
        
        const pages = [
            {
                title: 'Performance Dashboard Demo Home',
                content: 'Welcome to the WordPress Performance Dashboard demonstration environment. This comprehensive demo showcases real-time performance monitoring capabilities, database optimization insights, and plugin performance analysis tools.',
                slug: 'demo-home'
            },
            {
                title: 'Database Performance Analysis',
                content: 'This page demonstrates database performance monitoring features including slow query detection, query optimization suggestions, and real-time database metrics visualization.',
                slug: 'database-performance'
            },
            {
                title: 'Plugin Performance Monitoring',
                content: 'Explore how the dashboard monitors plugin performance impact, identifies performance bottlenecks, and provides actionable insights for plugin optimization.',
                slug: 'plugin-monitoring'
            },
            {
                title: 'Real-time Performance Metrics',
                content: 'View live performance metrics including response times, memory usage, database queries per second, and system health indicators updated in real-time.',
                slug: 'realtime-metrics'
            },
            {
                title: 'Performance Optimization Guide',
                content: 'A comprehensive guide to WordPress performance optimization covering caching strategies, database optimization, plugin selection, and server configuration best practices.',
                slug: 'optimization-guide'
            },
            {
                title: 'AJAX Performance Testing',
                content: 'This page includes various AJAX interactions to demonstrate admin-ajax performance monitoring and optimization techniques for WordPress sites.',
                slug: 'ajax-testing'
            }
        ];
        
        // Get admin user ID
        const [adminUsers] = await this.connection.execute(
            'SELECT ID FROM wp_users WHERE user_login LIKE "%admin%" LIMIT 1'
        );
        const adminId = adminUsers.length > 0 ? adminUsers[0].ID : 1;
        
        for (const pageData of pages) {
            try {
                const [result] = await this.connection.execute(`
                    INSERT INTO wp_posts (post_author, post_date, post_date_gmt, post_content, post_title,
                                        post_status, comment_status, ping_status, post_name, post_modified,
                                        post_modified_gmt, post_type, menu_order)
                    VALUES (?, NOW(), NOW(), ?, ?, 'publish', 'closed', 'closed', ?, NOW(), NOW(), 'page', 0)
                `, [adminId, pageData.content, pageData.title, pageData.slug]);
                
                const pageId = result.insertId;
                
                // Add page-specific meta
                await this.connection.execute(`
                    INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES
                    (?, '_demo_page_type', 'performance_demo'),
                    (?, '_demo_complexity_score', ?)
                `, [
                    pageId,
                    pageId, Math.floor(Math.random() * 10) + 1 // 1-10 complexity score
                ]);
                
                console.log(`Created page: ${pageData.title}`);
                
            } catch (error) {
                console.error(`Failed to create page ${pageData.title}:`, error.message);
            }
        }
        
        console.log('WordPress pages generated successfully');
    }
    
    async generateMediaMetadata() {
        console.log('Generating media metadata...');
        
        const mediaCount = this.getDataCount('media', 20, 50, 100);
        
        const mediaTypes = [
            { type: 'image/jpeg', ext: 'jpg' },
            { type: 'image/png', ext: 'png' },
            { type: 'image/gif', ext: 'gif' },
            { type: 'image/webp', ext: 'webp' },
            { type: 'application/pdf', ext: 'pdf' },
            { type: 'video/mp4', ext: 'mp4' }
        ];
        
        const imageNames = [
            'performance-chart', 'database-optimization', 'plugin-analysis', 'server-metrics',
            'caching-diagram', 'memory-usage', 'query-performance', 'ajax-monitoring',
            'dashboard-screenshot', 'optimization-results', 'benchmark-comparison',
            'performance-timeline', 'system-health', 'load-testing', 'speed-analysis'
        ];
        
        // Get admin user ID for media uploads
        const [adminUsers] = await this.connection.execute(
            'SELECT ID FROM wp_users WHERE user_login LIKE "%admin%" LIMIT 1'
        );
        const adminId = adminUsers.length > 0 ? adminUsers[0].ID : 1;
        
        console.log(`Generating ${mediaCount} media entries...`);
        
        for (let i = 0; i < mediaCount; i++) {
            const mediaType = mediaTypes[Math.floor(Math.random() * mediaTypes.length)];
            const imageName = imageNames[i % imageNames.length];
            const fileName = `${imageName}-${i + 1}.${mediaType.ext}`;
            const uploadDate = this.getRandomTimestamp();
            
            // Generate realistic file sizes based on type
            let fileSize;
            if (mediaType.type.startsWith('image/')) {
                fileSize = Math.floor(Math.random() * 2000000) + 100000; // 100KB - 2MB
            } else if (mediaType.type === 'video/mp4') {
                fileSize = Math.floor(Math.random() * 50000000) + 5000000; // 5MB - 55MB
            } else {
                fileSize = Math.floor(Math.random() * 5000000) + 500000; // 500KB - 5.5MB
            }
            
            try {
                // Insert attachment post
                const [result] = await this.connection.execute(`
                    INSERT INTO wp_posts (post_author, post_date, post_date_gmt, post_content, post_title,
                                        post_status, comment_status, ping_status, post_name, post_modified,
                                        post_modified_gmt, post_type, post_mime_type, guid)
                    VALUES (?, ?, ?, '', ?, 'inherit', 'open', 'closed', ?, ?, ?, 'attachment', ?, ?)
                `, [
                    adminId, uploadDate, uploadDate, fileName, fileName.replace(/\.[^/.]+$/, ""),
                    uploadDate, uploadDate, mediaType.type, 
                    `http://demo-wordpress/wp-content/uploads/${new Date(uploadDate).getFullYear()}/${String(new Date(uploadDate).getMonth() + 1).padStart(2, '0')}/${fileName}`
                ]);
                
                const attachmentId = result.insertId;
                
                // Add attachment metadata
                const metadata = {
                    width: mediaType.type.startsWith('image/') ? Math.floor(Math.random() * 2000) + 800 : null,
                    height: mediaType.type.startsWith('image/') ? Math.floor(Math.random() * 1500) + 600 : null,
                    file: `${new Date(uploadDate).getFullYear()}/${String(new Date(uploadDate).getMonth() + 1).padStart(2, '0')}/${fileName}`,
                    filesize: fileSize,
                    image_meta: mediaType.type.startsWith('image/') ? {
                        aperture: "0",
                        credit: "",
                        camera: "Demo Camera",
                        caption: "",
                        created_timestamp: Math.floor(Date.now() / 1000),
                        copyright: "",
                        focal_length: "0",
                        iso: "0",
                        shutter_speed: "0",
                        title: "",
                        orientation: "1"
                    } : {}
                };
                
                await this.connection.execute(`
                    INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES
                    (?, '_wp_attached_file', ?),
                    (?, '_wp_attachment_metadata', ?),
                    (?, '_demo_file_size', ?),
                    (?, '_demo_optimization_score', ?)
                `, [
                    attachmentId, metadata.file,
                    attachmentId, JSON.stringify(metadata),
                    attachmentId, fileSize,
                    attachmentId, Math.floor(Math.random() * 40) + 60 // 60-100 optimization score
                ]);
                
            } catch (error) {
                console.error(`Failed to create media entry ${i + 1}:`, error.message);
            }
            
            if (i % 10 === 0) {
                console.log(`Generated ${i}/${mediaCount} media entries...`);
            }
        }
        
        console.log('Media metadata generated successfully');
    }
    
    async generateComments() {
        console.log('Generating WordPress comments...');
        
        // Get published posts
        const [posts] = await this.connection.execute(
            'SELECT ID FROM wp_posts WHERE post_type = "post" AND post_status = "publish" LIMIT 50'
        );
        
        if (posts.length === 0) {
            console.log('No published posts found, skipping comment generation');
            return;
        }
        
        const commentCount = this.getDataCount('comments', 100, 300, 600);
        
        const commentTexts = [
            'This is an excellent analysis of WordPress performance optimization. The insights about database queries are particularly valuable.',
            'Great article! I implemented these suggestions on my site and saw a 40% improvement in load times.',
            'The performance monitoring techniques described here are exactly what I was looking for. Thank you for sharing!',
            'Very comprehensive guide. The section on plugin performance analysis helped me identify several bottlenecks.',
            'I appreciate the detailed explanation of caching strategies. This will definitely help optimize my WordPress sites.',
            'The real-time monitoring approach is impressive. How does this compare to other performance monitoring tools?',
            'Fantastic resource for WordPress developers. The database optimization tips are gold.',
            'This dashboard looks amazing! Is there a way to integrate it with existing WordPress installations?',
            'The performance metrics visualization is very clear and actionable. Great work on the dashboard design.',
            'I\'ve been struggling with slow query performance, and this article provided exactly the solutions I needed.'
        ];
        
        const authorNames = [
            'Performance Enthusiast', 'WordPress Developer', 'Site Administrator', 'Speed Optimizer',
            'Database Expert', 'Frontend Developer', 'DevOps Engineer', 'Web Performance Analyst',
            'WordPress Consultant', 'System Administrator', 'Full Stack Developer', 'Performance Tester'
        ];
        
        console.log(`Generating ${commentCount} comments...`);
        
        for (let i = 0; i < commentCount; i++) {
            const postId = posts[Math.floor(Math.random() * posts.length)].ID;
            const commentText = commentTexts[Math.floor(Math.random() * commentTexts.length)];
            const authorName = authorNames[Math.floor(Math.random() * authorNames.length)];
            const authorEmail = `${authorName.toLowerCase().replace(/\s+/g, '.')}@demo.local`;
            const commentDate = this.getRandomTimestamp();
            
            try {
                await this.connection.execute(`
                    INSERT INTO wp_comments (comment_post_ID, comment_author, comment_author_email,
                                           comment_author_url, comment_author_IP, comment_date,
                                           comment_date_gmt, comment_content, comment_approved,
                                           comment_agent, comment_type, comment_parent, user_id)
                    VALUES (?, ?, ?, '', '192.168.1.100', ?, ?, ?, 1, 'Demo User Agent', '', 0, 0)
                `, [postId, authorName, authorEmail, commentDate, commentDate, commentText]);
                
            } catch (error) {
                console.error(`Failed to create comment ${i + 1}:`, error.message);
            }
            
            if (i % 50 === 0) {
                console.log(`Generated ${i}/${commentCount} comments...`);
            }
        }
        
        console.log('WordPress comments generated successfully');
    }
    
    async validateGeneratedData() {
        console.log('Validating generated demo data...');
        
        const validationResults = {};
        
        try {
            // Validate WordPress content
            const [posts] = await this.connection.execute('SELECT COUNT(*) as count FROM wp_posts WHERE post_type = "post"');
            validationResults.posts = posts[0].count;
            
            const [pages] = await this.connection.execute('SELECT COUNT(*) as count FROM wp_posts WHERE post_type = "page"');
            validationResults.pages = pages[0].count;
            
            const [media] = await this.connection.execute('SELECT COUNT(*) as count FROM wp_posts WHERE post_type = "attachment"');
            validationResults.media = media[0].count;
            
            const [comments] = await this.connection.execute('SELECT COUNT(*) as count FROM wp_comments');
            validationResults.comments = comments[0].count;
            
            const [users] = await this.connection.execute('SELECT COUNT(*) as count FROM wp_users');
            validationResults.users = users[0].count;
            
            // Validate performance data
            const [perfLogs] = await this.connection.execute('SELECT COUNT(*) as count FROM wp_performance_logs');
            validationResults.performanceLogs = perfLogs[0].count;
            
            const [ajaxCalls] = await this.connection.execute('SELECT COUNT(*) as count FROM wp_ajax_calls');
            validationResults.ajaxCalls = ajaxCalls[0].count;
            
            const [pluginPerf] = await this.connection.execute('SELECT COUNT(*) as count FROM wp_plugin_performance');
            validationResults.pluginPerformance = pluginPerf[0].count;
            
            // Display validation results
            console.log('=== Demo Data Validation Results ===');
            console.log(`WordPress Posts: ${validationResults.posts}`);
            console.log(`WordPress Pages: ${validationResults.pages}`);
            console.log(`Media Attachments: ${validationResults.media}`);
            console.log(`Comments: ${validationResults.comments}`);
            console.log(`Users: ${validationResults.users}`);
            console.log(`Performance Logs: ${validationResults.performanceLogs}`);
            console.log(`AJAX Calls: ${validationResults.ajaxCalls}`);
            console.log(`Plugin Performance Records: ${validationResults.pluginPerformance}`);
            console.log('=====================================');
            
            // Check if minimum data requirements are met
            const minRequirements = {
                posts: 10,
                performanceLogs: 100,
                ajaxCalls: 50,
                pluginPerformance: 50
            };
            
            let validationPassed = true;
            for (const [key, minValue] of Object.entries(minRequirements)) {
                if (validationResults[key] < minValue) {
                    console.warn(`Warning: ${key} count (${validationResults[key]}) is below minimum requirement (${minValue})`);
                    validationPassed = false;
                }
            }
            
            if (validationPassed) {
                console.log('✅ All validation checks passed');
            } else {
                console.log('⚠️  Some validation checks failed, but data generation completed');
            }
            
        } catch (error) {
            console.error('Validation failed:', error.message);
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const generator = new DemoDataGenerator();
    
    try {
        await generator.generateDemoData();
        console.log('Demo data generation completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Demo data generation failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = DemoDataGenerator;
