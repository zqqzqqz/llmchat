"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSnakeCase = exports.toCamelCase = exports.truncateString = exports.formatFileSize = exports.isEmpty = exports.deepClone = exports.cleanObject = exports.getErrorMessage = exports.delay = exports.safeJsonParse = exports.isValidUrl = exports.generateTimestamp = exports.generateId = void 0;
const uuid_1 = require("uuid");
const generateId = () => {
    return (0, uuid_1.v4)();
};
exports.generateId = generateId;
const generateTimestamp = () => {
    return Math.floor(Date.now() / 1000);
};
exports.generateTimestamp = generateTimestamp;
const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
};
exports.isValidUrl = isValidUrl;
const safeJsonParse = (jsonString, defaultValue) => {
    try {
        return JSON.parse(jsonString);
    }
    catch {
        return defaultValue;
    }
};
exports.safeJsonParse = safeJsonParse;
const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
exports.delay = delay;
const getErrorMessage = (error) => {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return '未知错误';
};
exports.getErrorMessage = getErrorMessage;
const cleanObject = (obj) => {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            cleaned[key] = value;
        }
    }
    return cleaned;
};
exports.cleanObject = cleanObject;
const deepClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};
exports.deepClone = deepClone;
const isEmpty = (obj) => {
    if (obj == null)
        return true;
    if (Array.isArray(obj) || typeof obj === 'string')
        return obj.length === 0;
    if (typeof obj === 'object')
        return Object.keys(obj).length === 0;
    return false;
};
exports.isEmpty = isEmpty;
const formatFileSize = (bytes) => {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
exports.formatFileSize = formatFileSize;
const truncateString = (str, maxLength) => {
    if (str.length <= maxLength)
        return str;
    return str.slice(0, maxLength - 3) + '...';
};
exports.truncateString = truncateString;
const toCamelCase = (str) => {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
};
exports.toCamelCase = toCamelCase;
const toSnakeCase = (str) => {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};
exports.toSnakeCase = toSnakeCase;
//# sourceMappingURL=helpers.js.map