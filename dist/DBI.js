"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DBI = void 0;
const tslib_1 = require("tslib");
const discord_js_1 = tslib_1.__importDefault(require("discord.js"));
const ChatInput_1 = require("./types/ChatInput/ChatInput");
const ChatInputOptions_1 = require("./types/ChatInput/ChatInputOptions");
const publishInteractions_1 = require("./methods/publishInteractions");
const Event_1 = require("./types/Event");
const MemoryStore_1 = require("./utils/MemoryStore");
const hookInteractionListeners_1 = require("./methods/hookInteractionListeners");
const Events_1 = require("./Events");
const Locale_1 = require("./types/Locale");
const Button_1 = require("./types/Button");
const SelectMenu_1 = require("./types/SelectMenu");
const MessageContextMenu_1 = require("./types/MessageContextMenu");
const UserContextMenu_1 = require("./types/UserContextMenu");
const hookEventListeners_1 = require("./methods/hookEventListeners");
const eventMap_json_1 = tslib_1.__importDefault(require("./data/eventMap.json"));
const Modal_1 = require("./types/Modal");
const Sharding = tslib_1.__importStar(require("discord-hybrid-sharding"));
const lodash_1 = tslib_1.__importDefault(require("lodash"));
const InteractionLocale_1 = require("./types/InteractionLocale");
class DBI {
    namespace;
    config;
    client;
    data;
    events;
    cluster;
    _loaded;
    _hooked;
    constructor(namespace, config) {
        this.namespace = namespace;
        config.store = config.store || new MemoryStore_1.MemoryStore();
        config.defaults = {
            locale: "en",
            defaultMemberPermissions: [],
            directMessages: false,
            ...(config.defaults || {})
        };
        config.sharding = config.sharding ?? "off";
        config.strict = config.strict ?? true;
        config.references = {
            autoClear: undefined,
            ...(config.references || {})
        };
        // @ts-ignore
        this.config = config;
        this.data = {
            interactions: new discord_js_1.default.Collection(),
            events: new discord_js_1.default.Collection(),
            plugins: new discord_js_1.default.Collection(),
            locales: new discord_js_1.default.Collection(),
            interactionLocales: new discord_js_1.default.Collection(),
            other: {},
            eventMap: eventMap_json_1.default,
            unloaders: new Set(),
            registers: new Set(),
            registerUnloaders: new Set(),
            refs: new Map()
        };
        this.events = new Events_1.Events(this);
        this.client = new discord_js_1.default.Client({
            ...(config.discord?.options || {}),
            ...(config.sharding == "hybrid" ? {
                shards: Sharding.data.SHARD_LIST,
                shardCount: Sharding.data.TOTAL_SHARDS
            } : {})
        });
        this.cluster = config.sharding == "hybrid" ? new Sharding.Client(this.client) : undefined;
        this._loaded = false;
        this._hooked = false;
    }
    async _hookListeners() {
        if (this._hooked)
            return;
        this._hooked = true;
        this.data.unloaders.add((0, hookInteractionListeners_1.hookInteractionListeners)(this));
        this.data.unloaders.add((0, hookEventListeners_1.hookEventListeners)(this));
        if (typeof this.config.references.autoClear != "undefined") {
            this.data.unloaders.add((() => {
                let interval = setInterval(() => {
                    this.data.refs.forEach(({ at, ttl }, key) => {
                        if (Date.now() > (at + (ttl || this.config.references.autoClear.ttl))) {
                            this.data.refs.delete(key);
                        }
                    });
                }, this.config.references.autoClear.check);
                return () => {
                    clearInterval(interval);
                };
            })());
        }
    }
    async _unhookListeners() {
        if (!this._hooked)
            return;
        this._hooked = false;
        this.data.unloaders.forEach(f => {
            f();
        });
    }
    async _unregisterAll() {
        for await (const cb of this.data.registerUnloaders) {
            await cb();
        }
        this.data.events.clear();
        this.data.interactions.clear();
        this.data.plugins.clear();
    }
    async _registerAll() {
        const self = this;
        for await (const cb of this.data.registers) {
            let ChatInput = function (cfg) {
                let dbiChatInput = new ChatInput_1.DBIChatInput(self, cfg);
                if (self.data.interactions.has(dbiChatInput.name))
                    throw new Error(`DBIChatInput "${dbiChatInput.name}" already loaded as "${self.data.interactions.get(dbiChatInput.name)?.type}"!`);
                self.data.interactions.set(dbiChatInput.name, dbiChatInput);
                return dbiChatInput;
            };
            ChatInput = Object.assign(ChatInput, class {
                constructor(...args) { return ChatInput.apply(this, args); }
            });
            let Event = function (cfg) {
                let dbiEvent = new Event_1.DBIEvent(self, cfg);
                if (self.config.strict && self.data.events.has(dbiEvent.id || dbiEvent.name))
                    throw new Error(`DBIEvent "${dbiEvent.id || dbiEvent.name}" already loaded!`);
                self.data.events.set(dbiEvent.id || dbiEvent.name, dbiEvent);
                return dbiEvent;
            };
            Event = Object.assign(Event, class {
                constructor(...args) { return Event.apply(this, args); }
            });
            let Button = function (cfg) {
                let dbiButton = new Button_1.DBIButton(self, cfg);
                if (self.config.strict && self.data.interactions.has(dbiButton.name))
                    throw new Error(`DBIButton "${dbiButton.name}" already loaded as "${self.data.interactions.get(dbiButton.name)?.type}"!`);
                self.data.interactions.set(dbiButton.name, dbiButton);
                return dbiButton;
            };
            Button = Object.assign(Button, class {
                constructor(...args) { return Button.apply(this, args); }
            });
            let SelectMenu = function (cfg) {
                let dbiSelectMenu = new SelectMenu_1.DBISelectMenu(self, cfg);
                if (self.config.strict && self.data.interactions.has(dbiSelectMenu.name))
                    throw new Error(`DBISelectMenu "${dbiSelectMenu.name}" already loaded as "${self.data.interactions.get(dbiSelectMenu.name)?.type}"!`);
                self.data.interactions.set(dbiSelectMenu.name, dbiSelectMenu);
                return dbiSelectMenu;
            };
            SelectMenu = Object.assign(SelectMenu, class {
                constructor(...args) { return SelectMenu.apply(this, args); }
            });
            let MessageContextMenu = function (cfg) {
                let dbiMessageContextMenu = new MessageContextMenu_1.DBIMessageContextMenu(self, cfg);
                if (self.config.strict && self.data.interactions.has(dbiMessageContextMenu.name))
                    throw new Error(`DBIMessageContextMenu "${dbiMessageContextMenu.name}" already loaded as "${self.data.interactions.get(dbiMessageContextMenu.name)?.type}"!`);
                self.data.interactions.set(dbiMessageContextMenu.name, dbiMessageContextMenu);
                return dbiMessageContextMenu;
            };
            MessageContextMenu = Object.assign(MessageContextMenu, class {
                constructor(...args) { return MessageContextMenu.apply(this, args); }
            });
            let UserContextMenu = function (cfg) {
                let dbiUserContextMenu = new UserContextMenu_1.DBIUserContextMenu(self, cfg);
                if (self.config.strict && self.data.interactions.has(dbiUserContextMenu.name))
                    throw new Error(`DBIUserContextMenu "${dbiUserContextMenu.name}" already loaded as "${self.data.interactions.get(dbiUserContextMenu.name)?.type}"!`);
                self.data.interactions.set(dbiUserContextMenu.name, dbiUserContextMenu);
                return dbiUserContextMenu;
            };
            UserContextMenu = Object.assign(UserContextMenu, class {
                constructor(...args) { return UserContextMenu.apply(this, args); }
            });
            let Modal = function (cfg) {
                let dbiModal = new Modal_1.DBIModal(self, cfg);
                if (self.config.strict && self.data.interactions.has(dbiModal.name))
                    throw new Error(`DBIModal "${dbiModal.name}" already loaded as "${self.data.interactions.get(dbiModal.name)?.type}"!`);
                self.data.interactions.set(dbiModal.name, dbiModal);
                return dbiModal;
            };
            Modal = Object.assign(Modal, class {
                constructor(...args) { return Modal.apply(this, args); }
            });
            let Locale = function (cfg) {
                let dbiLocale = new Locale_1.DBILocale(self, cfg);
                if (self.config.strict && self.data.locales.has(dbiLocale.name))
                    throw new Error(`DBILocale "${dbiLocale.name}" already loaded!`);
                self.data.locales.set(dbiLocale.name, dbiLocale);
                return dbiLocale;
            };
            Locale = Object.assign(Locale, class {
                constructor(...args) { return Locale.apply(this, args); }
            });
            let InteractionLocale = function (cfg) {
                let dbiInteractionLocale = new InteractionLocale_1.DBIInteractionLocale(self, cfg);
                if (self.config.strict && self.data.interactionLocales.has(dbiInteractionLocale.name))
                    throw new Error(`DBIInteractionLocale "${dbiInteractionLocale.name}" already loaded!`);
                self.data.interactionLocales.set(dbiInteractionLocale.name, dbiInteractionLocale);
                return dbiInteractionLocale;
            };
            InteractionLocale = Object.assign(InteractionLocale, class {
                constructor(...args) { return InteractionLocale.apply(this, args); }
            });
            await cb({
                ChatInput,
                Event,
                ChatInputOptions: ChatInputOptions_1.DBIChatInputOptions,
                Locale,
                Button,
                SelectMenu,
                MessageContextMenu,
                UserContextMenu,
                Modal,
                InteractionLocale,
                onUnload(cb) {
                    self.data.registerUnloaders.add(cb);
                },
            });
        }
    }
    /**
     * this.data.interactions.get(name)
     */
    interaction(name) {
        return this.data.interactions.get(name);
    }
    /**
     * this.data.events.get(name)
     */
    event(name) {
        return this.data.events.get(name);
    }
    /**
     * this.data.locales.get(name)
     */
    locale(name) {
        return this.data.locales.get(name);
    }
    /**
     * this.data.plugins.get(name)
     */
    plugin(name) {
        return this.data.plugins.get(name);
    }
    /**
     * Shorthands for modifying `dbi.data.other`
     */
    get(k, defaultValue) {
        if (defaultValue && !this.has(k)) {
            this.set(k, defaultValue);
            return defaultValue;
        }
        return lodash_1.default.get(this.data.other, k);
    }
    /**
     * Shorthands for modifying `dbi.data.other`
     */
    set(k, v) {
        this.data.other = lodash_1.default.set(this.data.other, k, v);
    }
    /**
     * Shorthands for modifying `dbi.data.other`
     */
    has(k) {
        return lodash_1.default.has(this.data.other, k);
    }
    /**
     * Shorthands for modifying `dbi.data.other`
     */
    delete(k) {
        return lodash_1.default.unset(this.data.other, k);
    }
    async login() {
        await this.client.login(this.config.sharding == "default" ? undefined : this.config.discord.token);
    }
    async register(cb) {
        this.data.registers.add(cb);
    }
    async load() {
        if (this._loaded)
            return false;
        await this._registerAll();
        await this._hookListeners();
        this._loaded = true;
        return true;
    }
    async unload() {
        if (!this._loaded)
            return false;
        await this._unregisterAll();
        await this._unhookListeners();
        this._loaded = false;
        return true;
    }
    get loaded() {
        return this._loaded;
    }
    async publish(...args) {
        let interactions = this.data.interactions.filter(i => i.type == "ChatInput" || i.type == "MessageContextMenu" || i.type == "UserContextMenu");
        switch (args[0]) {
            case "Global": {
                return await (0, publishInteractions_1.publishInteractions)(this.config.discord.token, args[1] ? new discord_js_1.default.Collection() : interactions, this.data.interactionLocales, args[0]);
            }
            case "Guild": {
                return await (0, publishInteractions_1.publishInteractions)(this.config.discord.token, args[2] ? new discord_js_1.default.Collection() : interactions, this.data.interactionLocales, args[0], args[1]);
            }
        }
    }
}
exports.DBI = DBI;
//# sourceMappingURL=DBI.js.map