const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Exclude ONLY root project build outputs (Do NOT block node_modules/*/dist folders!)
const rootDistPath = path.resolve(__dirname, 'dist');
const rootUploadsPath = path.resolve(__dirname, 'uploads');
const backendPath = path.resolve(__dirname, '../backend');

config.resolver.blockList = [
  new RegExp('^' + rootDistPath.replace(/\\/g, '/') + '/.*'),
  new RegExp('^' + rootUploadsPath.replace(/\\/g, '/') + '/.*'),
  new RegExp('^' + backendPath.replace(/\\/g, '/') + '/.*'),
  /.*\.git\/.*/,
];

module.exports = config;
