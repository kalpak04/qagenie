const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const semver = require('semver');

class PluginSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    this.plugins = new Map();
    this.hooks = new Map();
    this.pluginDir = options.pluginDir || './plugins';
    this.registry = options.registry || 'https://qagenie-plugins.io/api';
    this.sandbox = options.sandbox !== false;
    this.dependencies = new Map();
    this.loadedPlugins = new Set();
  }

  async initialize() {
    // Create plugin directory if it doesn't exist
    await fs.mkdir(this.pluginDir, { recursive: true });
    
    // Load installed plugins
    await this.loadInstalledPlugins();
    
    // Initialize plugin API
    this.initializePluginAPI();
    
    console.log(`Plugin system initialized with ${this.plugins.size} plugins`);
  }

  async loadInstalledPlugins() {
    try {
      const files = await fs.readdir(this.pluginDir);
      
      for (const file of files) {
        if (file.endsWith('.plugin.js') || file.endsWith('.plugin.json')) {
          await this.loadPlugin(path.join(this.pluginDir, file));
        }
      }
    } catch (error) {
      console.error('Error loading plugins:', error);
    }
  }

  async loadPlugin(pluginPath) {
    try {
      const extension = path.extname(pluginPath);
      let pluginConfig;
      
      if (extension === '.json') {
        // Load plugin manifest
        const content = await fs.readFile(pluginPath, 'utf-8');
        pluginConfig = JSON.parse(content);
        
        // Load the actual plugin code
        const codePath = path.join(
          path.dirname(pluginPath),
          pluginConfig.main || 'index.js'
        );
        
        pluginConfig.implementation = require(codePath);
      } else {
        // Direct JavaScript plugin
        const plugin = require(pluginPath);
        pluginConfig = plugin.manifest || {
          name: path.basename(pluginPath, '.plugin.js'),
          version: '1.0.0'
        };
        pluginConfig.implementation = plugin;
      }
      
      // Validate plugin
      if (!this.validatePlugin(pluginConfig)) {
        throw new Error('Invalid plugin configuration');
      }
      
      // Check dependencies
      if (pluginConfig.dependencies) {
        await this.checkDependencies(pluginConfig);
      }
      
      // Initialize plugin
      const pluginInstance = await this.initializePlugin(pluginConfig);
      
      // Register plugin
      this.plugins.set(pluginConfig.name, {
        config: pluginConfig,
        instance: pluginInstance,
        path: pluginPath,
        status: 'active'
      });
      
      this.loadedPlugins.add(pluginConfig.name);
      
      // Emit plugin loaded event
      this.emit('plugin:loaded', {
        name: pluginConfig.name,
        version: pluginConfig.version
      });
      
      console.log(`Loaded plugin: ${pluginConfig.name} v${pluginConfig.version}`);
      
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error);
      
      this.emit('plugin:error', {
        path: pluginPath,
        error: error.message
      });
    }
  }

  validatePlugin(config) {
    // Check required fields
    if (!config.name || !config.version) {
      return false;
    }
    
    // Validate version
    if (!semver.valid(config.version)) {
      return false;
    }
    
    // Check for implementation
    if (!config.implementation) {
      return false;
    }
    
    // Validate hooks if present
    if (config.hooks) {
      for (const hook of config.hooks) {
        if (!hook.name || !hook.handler) {
          return false;
        }
      }
    }
    
    return true;
  }

  async checkDependencies(pluginConfig) {
    for (const [depName, depVersion] of Object.entries(pluginConfig.dependencies)) {
      const installed = this.plugins.get(depName);
      
      if (!installed) {
        // Try to install dependency
        await this.installPlugin(depName, depVersion);
      } else {
        // Check version compatibility
        if (!semver.satisfies(installed.config.version, depVersion)) {
          throw new Error(
            `Dependency ${depName} version ${depVersion} not satisfied. ` +
            `Installed version: ${installed.config.version}`
          );
        }
      }
    }
  }

  async initializePlugin(pluginConfig) {
    const api = this.createPluginAPI(pluginConfig.name);
    
    if (this.sandbox) {
      // Create sandboxed environment
      return this.createSandboxedPlugin(pluginConfig, api);
    }
    
    // Initialize plugin with API
    if (typeof pluginConfig.implementation.initialize === 'function') {
      await pluginConfig.implementation.initialize(api);
    }
    
    // Register hooks
    if (pluginConfig.hooks) {
      for (const hook of pluginConfig.hooks) {
        this.registerHook(hook.name, {
          plugin: pluginConfig.name,
          handler: pluginConfig.implementation[hook.handler] || hook.handler,
          priority: hook.priority || 0
        });
      }
    }
    
    return pluginConfig.implementation;
  }

  createPluginAPI(pluginName) {
    const self = this;
    
    return {
      // Storage API
      storage: {
        async get(key) {
          const storageKey = `${pluginName}:${key}`;
          // Implement storage logic
          return null;
        },
        
        async set(key, value) {
          const storageKey = `${pluginName}:${key}`;
          // Implement storage logic
        },
        
        async delete(key) {
          const storageKey = `${pluginName}:${key}`;
          // Implement storage logic
        }
      },
      
      // Event API
      events: {
        on: (event, handler) => {
          self.on(`plugin:${pluginName}:${event}`, handler);
        },
        
        emit: (event, data) => {
          self.emit(`plugin:${pluginName}:${event}`, data);
        },
        
        off: (event, handler) => {
          self.off(`plugin:${pluginName}:${event}`, handler);
        }
      },
      
      // Hook API
      hooks: {
        register: (hookName, handler, priority = 0) => {
          self.registerHook(hookName, {
            plugin: pluginName,
            handler,
            priority
          });
        },
        
        call: async (hookName, ...args) => {
          return await self.callHook(hookName, ...args);
        }
      },
      
      // UI API
      ui: {
        registerComponent: (name, component) => {
          self.emit('ui:register-component', {
            plugin: pluginName,
            name,
            component
          });
        },
        
        registerRoute: (path, component) => {
          self.emit('ui:register-route', {
            plugin: pluginName,
            path,
            component
          });
        },
        
        showNotification: (message, type = 'info') => {
          self.emit('ui:notification', {
            plugin: pluginName,
            message,
            type
          });
        }
      },
      
      // Test API
      test: {
        registerAction: (name, handler) => {
          self.emit('test:register-action', {
            plugin: pluginName,
            name,
            handler
          });
        },
        
        registerAssertion: (name, handler) => {
          self.emit('test:register-assertion', {
            plugin: pluginName,
            name,
            handler
          });
        },
        
        registerReporter: (name, reporter) => {
          self.emit('test:register-reporter', {
            plugin: pluginName,
            name,
            reporter
          });
        }
      },
      
      // Utility functions
      utils: {
        logger: this.createPluginLogger(pluginName),
        http: axios.create({
          headers: {
            'X-Plugin': pluginName
          }
        })
      }
    };
  }

  createPluginLogger(pluginName) {
    return {
      log: (...args) => console.log(`[${pluginName}]`, ...args),
      error: (...args) => console.error(`[${pluginName}]`, ...args),
      warn: (...args) => console.warn(`[${pluginName}]`, ...args),
      info: (...args) => console.info(`[${pluginName}]`, ...args),
      debug: (...args) => console.debug(`[${pluginName}]`, ...args)
    };
  }

  createSandboxedPlugin(pluginConfig, api) {
    // Create a sandboxed environment for the plugin
    const vm = require('vm');
    
    const sandbox = {
      require: (module) => {
        // Only allow specific modules
        const allowedModules = ['path', 'url', 'querystring', 'events'];
        if (allowedModules.includes(module)) {
          return require(module);
        }
        throw new Error(`Module ${module} is not allowed in sandbox`);
      },
      console: api.utils.logger,
      api,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      Promise,
      Date,
      Math,
      JSON,
      RegExp,
      Array,
      Object,
      String,
      Number,
      Boolean
    };
    
    const script = new vm.Script(pluginConfig.implementation.toString());
    const context = vm.createContext(sandbox);
    
    return script.runInContext(context);
  }

  registerHook(hookName, hookConfig) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    
    const hooks = this.hooks.get(hookName);
    hooks.push(hookConfig);
    
    // Sort by priority (higher priority first)
    hooks.sort((a, b) => b.priority - a.priority);
  }

  async callHook(hookName, ...args) {
    const hooks = this.hooks.get(hookName);
    
    if (!hooks || hooks.length === 0) {
      return args[0]; // Return first argument if no hooks
    }
    
    let result = args[0];
    
    for (const hook of hooks) {
      try {
        result = await hook.handler(result, ...args.slice(1));
      } catch (error) {
        console.error(`Hook error in ${hook.plugin}:`, error);
        
        this.emit('hook:error', {
          hook: hookName,
          plugin: hook.plugin,
          error: error.message
        });
      }
    }
    
    return result;
  }

  async installPlugin(pluginName, version = 'latest') {
    try {
      // Check if plugin is already installed
      if (this.plugins.has(pluginName)) {
        console.log(`Plugin ${pluginName} is already installed`);
        return;
      }
      
      // Fetch plugin from registry
      const response = await axios.get(
        `${this.registry}/plugins/${pluginName}/${version}`
      );
      
      const pluginInfo = response.data;
      
      // Download plugin files
      const pluginPath = path.join(this.pluginDir, pluginName);
      await fs.mkdir(pluginPath, { recursive: true });
      
      // Save plugin manifest
      await fs.writeFile(
        path.join(pluginPath, 'plugin.json'),
        JSON.stringify(pluginInfo.manifest, null, 2)
      );
      
      // Download plugin code
      const codeResponse = await axios.get(pluginInfo.downloadUrl);
      await fs.writeFile(
        path.join(pluginPath, pluginInfo.manifest.main || 'index.js'),
        codeResponse.data
      );
      
      // Load the plugin
      await this.loadPlugin(path.join(pluginPath, 'plugin.json'));
      
      console.log(`Successfully installed plugin: ${pluginName}@${version}`);
      
    } catch (error) {
      console.error(`Failed to install plugin ${pluginName}:`, error);
      throw error;
    }
  }

  async uninstallPlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} is not installed`);
    }
    
    // Check for dependent plugins
    const dependents = this.findDependentPlugins(pluginName);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot uninstall ${pluginName}. The following plugins depend on it: ${dependents.join(', ')}`
      );
    }
    
    // Call plugin cleanup
    if (plugin.instance && typeof plugin.instance.cleanup === 'function') {
      await plugin.instance.cleanup();
    }
    
    // Remove hooks
    for (const [hookName, hooks] of this.hooks.entries()) {
      this.hooks.set(
        hookName,
        hooks.filter(h => h.plugin !== pluginName)
      );
    }
    
    // Remove plugin
    this.plugins.delete(pluginName);
    this.loadedPlugins.delete(pluginName);
    
    // Remove plugin files
    const pluginPath = path.dirname(plugin.path);
    await fs.rm(pluginPath, { recursive: true, force: true });
    
    this.emit('plugin:uninstalled', {
      name: pluginName
    });
    
    console.log(`Uninstalled plugin: ${pluginName}`);
  }

  findDependentPlugins(pluginName) {
    const dependents = [];
    
    for (const [name, plugin] of this.plugins.entries()) {
      if (plugin.config.dependencies && 
          plugin.config.dependencies[pluginName]) {
        dependents.push(name);
      }
    }
    
    return dependents;
  }

  async updatePlugin(pluginName, version) {
    const plugin = this.plugins.get(pluginName);
    
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} is not installed`);
    }
    
    // Backup current plugin
    const backupPath = `${plugin.path}.backup`;
    await fs.copyFile(plugin.path, backupPath);
    
    try {
      // Uninstall current version
      await this.uninstallPlugin(pluginName);
      
      // Install new version
      await this.installPlugin(pluginName, version);
      
      // Remove backup
      await fs.unlink(backupPath);
      
    } catch (error) {
      // Restore backup
      await fs.copyFile(backupPath, plugin.path);
      await this.loadPlugin(plugin.path);
      
      throw error;
    }
  }

  async searchPlugins(query, options = {}) {
    try {
      const response = await axios.get(`${this.registry}/search`, {
        params: {
          q: query,
          ...options
        }
      });
      
      return response.data.plugins;
    } catch (error) {
      console.error('Plugin search failed:', error);
      return [];
    }
  }

  getPluginInfo(pluginName) {
    const plugin = this.plugins.get(pluginName);
    
    if (!plugin) {
      return null;
    }
    
    return {
      name: plugin.config.name,
      version: plugin.config.version,
      description: plugin.config.description,
      author: plugin.config.author,
      status: plugin.status,
      hooks: Array.from(this.hooks.entries())
        .filter(([, hooks]) => hooks.some(h => h.plugin === pluginName))
        .map(([hookName]) => hookName),
      dependencies: plugin.config.dependencies || {}
    };
  }

  listPlugins() {
    const plugins = [];
    
    for (const [name, plugin] of this.plugins.entries()) {
      plugins.push(this.getPluginInfo(name));
    }
    
    return plugins;
  }

  async enablePlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }
    
    if (plugin.status === 'active') {
      return;
    }
    
    // Re-initialize plugin
    await this.initializePlugin(plugin.config);
    
    plugin.status = 'active';
    
    this.emit('plugin:enabled', {
      name: pluginName
    });
  }

  async disablePlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }
    
    if (plugin.status === 'disabled') {
      return;
    }
    
    // Call plugin cleanup
    if (plugin.instance && typeof plugin.instance.cleanup === 'function') {
      await plugin.instance.cleanup();
    }
    
    // Remove hooks
    for (const [hookName, hooks] of this.hooks.entries()) {
      this.hooks.set(
        hookName,
        hooks.filter(h => h.plugin !== pluginName)
      );
    }
    
    plugin.status = 'disabled';
    
    this.emit('plugin:disabled', {
      name: pluginName
    });
  }

  async createPlugin(config) {
    const template = {
      name: config.name,
      version: '1.0.0',
      description: config.description || '',
      author: config.author || '',
      main: 'index.js',
      hooks: config.hooks || [],
      dependencies: config.dependencies || {}
    };
    
    const pluginPath = path.join(this.pluginDir, config.name);
    await fs.mkdir(pluginPath, { recursive: true });
    
    // Create plugin manifest
    await fs.writeFile(
      path.join(pluginPath, 'plugin.json'),
      JSON.stringify(template, null, 2)
    );
    
    // Create main plugin file
    const pluginCode = `
module.exports = {
  manifest: require('./plugin.json'),
  
  async initialize(api) {
    api.utils.logger.log('Plugin initialized');
    
    // Plugin initialization code here
  },
  
  async cleanup() {
    api.utils.logger.log('Plugin cleanup');
    
    // Cleanup code here
  }
  
  // Add your plugin methods here
};
`;
    
    await fs.writeFile(
      path.join(pluginPath, 'index.js'),
      pluginCode
    );
    
    console.log(`Created plugin template at ${pluginPath}`);
    
    return pluginPath;
  }

  initializePluginAPI() {
    // Set up global plugin API hooks
    this.on('ui:register-component', (data) => {
      console.log(`Plugin ${data.plugin} registered component: ${data.name}`);
    });
    
    this.on('ui:register-route', (data) => {
      console.log(`Plugin ${data.plugin} registered route: ${data.path}`);
    });
    
    this.on('test:register-action', (data) => {
      console.log(`Plugin ${data.plugin} registered test action: ${data.name}`);
    });
  }
}

module.exports = PluginSystem; 