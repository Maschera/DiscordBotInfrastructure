"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recursiveImport = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
/**
 * Usage: `await recursiveImport("./src", [".js", ".ts"])`
 */
async function recursiveImport(folderPath, exts = [".js", ".ts"]) {
    let files = await fs_1.default.promises.readdir(folderPath, { withFileTypes: true });
    for (const file of files) {
        let filePath = path_1.default.resolve(folderPath, file.name);
        if (file.isDirectory()) {
            await recursiveImport(filePath, exts);
        }
        else if (exts.some(i => filePath.endsWith(i))) {
            await Promise.resolve().then(() => tslib_1.__importStar(require(filePath)));
        }
    }
}
exports.recursiveImport = recursiveImport;
//# sourceMappingURL=recursiveImport.js.map