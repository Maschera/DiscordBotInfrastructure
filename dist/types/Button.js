"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DBIButton = void 0;
const tslib_1 = require("tslib");
const discord_js_1 = tslib_1.__importDefault(require("discord.js"));
const Interaction_1 = require("./Interaction");
const customId_1 = require("../utils/customId");
class DBIButton extends Interaction_1.DBIBaseInteraction {
    constructor(dbi, args) {
        super(dbi, {
            ...args,
            type: "Button",
        });
        this.referenceTTL = args.referenceTTL;
    }
    onExecute(ctx) { }
    ;
    toJSON(...customData) {
        return {
            ...(typeof this.options == "function" ? this.options(customData) : this.options),
            customId: (0, customId_1.customIdBuilder)(this.dbi, this.name, customData, this.referenceTTL),
            type: discord_js_1.default.ComponentType.Button
        };
    }
    ;
}
exports.DBIButton = DBIButton;
//# sourceMappingURL=Button.js.map