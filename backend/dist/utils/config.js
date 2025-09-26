"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readJsonc = readJsonc;
exports.stripJsonComments = stripJsonComments;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
async function readJsonc(configRelativePath) {
    const fullPath = path_1.default.isAbsolute(configRelativePath)
        ? configRelativePath
        : path_1.default.join(__dirname, '../../../', configRelativePath);
    const raw = await promises_1.default.readFile(fullPath, 'utf-8');
    const stripped = stripJsonComments(raw);
    return JSON.parse(stripped);
}
function stripJsonComments(input) {
    let output = input.replace(/\/\*[\s\S]*?\*\//g, '');
    output = output.replace(/^\s*\/\/.*$/gm, '');
    return output;
}
//# sourceMappingURL=config.js.map