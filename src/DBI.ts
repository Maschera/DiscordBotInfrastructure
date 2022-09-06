import Discord from "discord.js";
import { DBIChatInput, TDBIChatInputOmitted } from "./types/ChatInput/ChatInput";
import { DBIChatInputOptions } from "./types/ChatInput/ChatInputOptions";
import { publishInteractions } from "./methods/publishInteractions";
import { DBIEvent, TDBIEventOmitted } from "./types/Event";
import { MemoryStore } from "./utils/MemoryStore";
import { hookInteractionListeners } from "./methods/hookInteractionListeners";
import { Events } from "./Events";
import { DBILocale, TDBILocaleConstructor, TDBILocaleString } from "./types/Locale";
import { DBIButton, TDBIButtonOmitted } from "./types/Button";
import { DBISelectMenu, TDBISelectMenuOmitted } from "./types/SelectMenu";
import { DBIMessageContextMenu, TDBIMessageContextMenuOmitted } from "./types/MessageContextMenu";
import { DBIUserContextMenu, TDBIUserContextMenuOmitted } from "./types/UserContextMenu";
import { hookEventListeners } from "./methods/hookEventListeners";
import eventMap from "./data/eventMap.json";
import { DBIModal, TDBIModalOmitted } from "./types/Modal";
import * as Sharding from "discord-hybrid-sharding";
import _ from "lodash";
import { DBIInteractionLocale, TDBIInteractionLocaleOmitted } from "./types/InteractionLocale";

export interface DBIStore {
  get(key: string, defaultValue?: any): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

export interface DBIConfig {
  discord: {
    token: string;
    options: Discord.ClientOptions
  }
  defaults: {
    locale: TDBILocaleString,
    directMessages: boolean,
    defaultMemberPermissions: Discord.PermissionsString[]
  };

  sharding: boolean;
  /**
   * Persist store. (Default to MemoryStore thats not persis tho.)
   */
  store: DBIStore;
}

export type TDBIConfigConstructor = Partial<DBIConfig>;

export interface DBIRegisterAPI {
  ChatInput(cfg: TDBIChatInputOmitted): DBIChatInput;
  ChatInputOptions: typeof DBIChatInputOptions;
  Event(cfg: TDBIEventOmitted): DBIEvent;
  Locale(cfg: TDBILocaleConstructor): DBILocale;
  Button(cfg: TDBIButtonOmitted): DBIButton;
  SelectMenu(cfg: TDBISelectMenuOmitted): DBISelectMenu;
  MessageContextMenu(cfg: TDBIMessageContextMenuOmitted): DBIMessageContextMenu;
  UserContextMenu(cfg: TDBIUserContextMenuOmitted): DBIUserContextMenu;
  InteractionLocale(cfg: TDBIInteractionLocaleOmitted): DBIInteractionLocale;
  Modal(cfg: TDBIModalOmitted): DBIModal;
  onUnload(cb: () => Promise<any> | any): any;
}

export class DBI<TOtherData = Record<string, any>> {
  namespace: string;
  config: DBIConfig;
  client: Discord.Client<true>;
  data: {
    interactions: Discord.Collection<string, DBIChatInput | DBIButton | DBISelectMenu | DBIMessageContextMenu | DBIUserContextMenu | DBIModal>;
    events: Discord.Collection<string, DBIEvent>;
    plugins: Discord.Collection<string, any>;
    locales: Discord.Collection<string, DBILocale>;
    interactionLocales: Discord.Collection<string, DBIInteractionLocale>;
    other: TOtherData;
    eventMap: Record<string, string[]>;
    unloaders: Set<() => void>;
    registers: Set<(...args: any[]) => any>;
    registerUnloaders: Set<(...args: any[]) => any>;
    refs: Map<string, { at: number, value: any }>;
  };
  events: Events;
  cluster?: Sharding.Client;
  private _loaded: boolean;
  constructor(namespace: string, config: TDBIConfigConstructor) {
    this.namespace = namespace;

    config.store = config.store as any || new MemoryStore();
    config.defaults = {
      locale: "en",
      defaultMemberPermissions: [],
      directMessages: false,
      ...(config.defaults || {})
    };
    config.sharding = config.sharding ?? false;

    // @ts-ignore
    this.config = config;

    this.data = {
      interactions: new Discord.Collection(),
      events: new Discord.Collection(),
      plugins: new Discord.Collection(),
      locales: new Discord.Collection(),
      interactionLocales: new Discord.Collection(),
      other: {} as TOtherData,
      eventMap,
      unloaders: new Set(),
      registers: new Set(),
      registerUnloaders: new Set(),
      refs: new Map()
    }

    this.events = new Events(this);
    this.client = new Discord.Client({
      ...(config.discord?.options || {}) as any,
      ...(config.sharding ? {
        shards: (Sharding as any).data.SHARD_LIST,
        shardCount: (Sharding as any).data.TOTAL_SHARDS
      } : {})
    });
    this.cluster = config.sharding ? new Sharding.Client(this.client) : undefined;
    this._hookListeners();
    this._loaded = false;
  }

  private async _hookListeners() {
    this.data.unloaders.add(hookInteractionListeners(this));
    this.data.unloaders.add(hookEventListeners(this));
  }

  private async _unregisterAll() {
    for await (const cb of this.data.registerUnloaders) {
      await cb();
    }
    this.data.events.clear();
    this.data.interactions.clear();
    this.data.plugins.clear();
  }

  private async _registerAll() {
    const self = this;

    for await (const cb of this.data.registers) {
      let ChatInput = function(cfg: DBIChatInput) {
        let dbiChatInput = new DBIChatInput(self, cfg);
        if (self.data.interactions.has(dbiChatInput.name)) throw new Error(`DBIChatInput "${dbiChatInput.name}" already loaded as "${self.data.interactions.get(dbiChatInput.name)?.type}"!`);
        self.data.interactions.set(dbiChatInput.name, dbiChatInput);
        return dbiChatInput;
      };
      ChatInput = Object.assign(ChatInput, class { constructor(...args: any[]) { return ChatInput.apply(this, args as any); } });

      let Event = function(cfg: TDBIEventOmitted) {
        let dbiEvent = new DBIEvent(self, cfg);
        if (self.data.events.has(dbiEvent.name)) throw new Error(`DBIEvent "${dbiEvent.name}" already loaded!`);
        self.data.events.set(dbiEvent.name, dbiEvent);
        return dbiEvent;
      };
      Event = Object.assign(Event, class { constructor(...args: any[]) { return Event.apply(this, args as any); } });

      let Button = function(cfg: TDBIButtonOmitted) {
        let dbiButton = new DBIButton(self, cfg);
        if (self.data.interactions.has(dbiButton.name)) throw new Error(`DBIButton "${dbiButton.name}" already loaded as "${self.data.interactions.get(dbiButton.name)?.type}"!`);
        self.data.interactions.set(dbiButton.name, dbiButton);
        return dbiButton;
      };
      Button = Object.assign(Button, class { constructor(...args: any[]) { return Button.apply(this, args as any); } });

      let SelectMenu = function(cfg: TDBISelectMenuOmitted) {
        let dbiSelectMenu = new DBISelectMenu(self, cfg);
        if (self.data.interactions.has(dbiSelectMenu.name)) throw new Error(`DBISelectMenu "${dbiSelectMenu.name}" already loaded as "${self.data.interactions.get(dbiSelectMenu.name)?.type}"!`);
        self.data.interactions.set(dbiSelectMenu.name, dbiSelectMenu);
        return dbiSelectMenu;
      };
      SelectMenu = Object.assign(SelectMenu, class { constructor(...args: any[]) { return SelectMenu.apply(this, args as any); } });

      let MessageContextMenu = function(cfg: TDBIMessageContextMenuOmitted) {
        let dbiMessageContextMenu = new DBIMessageContextMenu(self, cfg);
        if (self.data.interactions.has(dbiMessageContextMenu.name)) throw new Error(`DBIMessageContextMenu "${dbiMessageContextMenu.name}" already loaded as "${self.data.interactions.get(dbiMessageContextMenu.name)?.type}"!`);
        self.data.interactions.set(dbiMessageContextMenu.name, dbiMessageContextMenu);
        return dbiMessageContextMenu;
      };
      MessageContextMenu = Object.assign(MessageContextMenu, class { constructor(...args: any[]) { return MessageContextMenu.apply(this, args as any); } });

      let UserContextMenu = function(cfg: TDBIUserContextMenuOmitted) {
        let dbiUserContextMenu = new DBIUserContextMenu(self, cfg);
        if (self.data.interactions.has(dbiUserContextMenu.name)) throw new Error(`DBIUserContextMenu "${dbiUserContextMenu.name}" already loaded as "${self.data.interactions.get(dbiUserContextMenu.name)?.type}"!`);
        self.data.interactions.set(dbiUserContextMenu.name, dbiUserContextMenu);
        return dbiUserContextMenu;
      };
      UserContextMenu = Object.assign(UserContextMenu, class { constructor(...args: any[]) { return UserContextMenu.apply(this, args as any); } });

      let Modal = function(cfg: TDBIModalOmitted) {
        let dbiModal = new DBIModal(self, cfg);
        if (self.data.interactions.has(dbiModal.name)) throw new Error(`DBIModal "${dbiModal.name}" already loaded as "${self.data.interactions.get(dbiModal.name)?.type}"!`);
        self.data.interactions.set(dbiModal.name, dbiModal);
        return dbiModal;
      };
      Modal = Object.assign(Modal, class { constructor(...args: any[]) { return Modal.apply(this, args as any); } });

      let Locale = function(cfg: TDBILocaleConstructor) {
        let dbiLocale = new DBILocale(self, cfg);
        if (self.data.locales.has(dbiLocale.name)) throw new Error(`DBILocale "${dbiLocale.name}" already loaded!`);
        self.data.locales.set(dbiLocale.name, dbiLocale);
        return dbiLocale;
      };
      Locale = Object.assign(Locale, class { constructor(...args: any[]) { return Locale.apply(this, args as any); } });

      let InteractionLocale = function(cfg: TDBIInteractionLocaleOmitted) {
        let dbiInteractionLocale = new DBIInteractionLocale(self, cfg);
        if (self.data.interactionLocales.has(dbiInteractionLocale.name)) throw new Error(`DBIInteractionLocale "${dbiInteractionLocale.name}" already loaded!`);
        self.data.interactionLocales.set(dbiInteractionLocale.name, dbiInteractionLocale);
        return dbiInteractionLocale;
      };
      InteractionLocale = Object.assign(InteractionLocale, class { constructor(...args: any[]) { return InteractionLocale.apply(this, args as any); } });

      await cb({
        ChatInput,
        Event,
        ChatInputOptions: DBIChatInputOptions,
        Locale,
        Button,
        SelectMenu,
        MessageContextMenu,
        UserContextMenu,
        Modal,
        InteractionLocale,
        onUnload(cb: ()=> Promise<any> | any) {
          self.data.registerUnloaders.add(cb);
        },
      });
    }
  }

  /**
   * Shorthands for modifying `dbi.data.other`
   */
  get<K extends keyof TOtherData>(k: K, defaultValue?: TOtherData[K]): TOtherData[K] {
    if (this.has(k as any)) {
      this.set(k, defaultValue);
      return defaultValue;
    }
    return _.get(this.data.other, k);
  }

  /**
   * Shorthands for modifying `dbi.data.other`
   */
  set<K extends keyof TOtherData>(k: K, v: TOtherData[K]): any {
    this.data.other = _.set(this.data.other as any, k, v);
  }

  /**
   * Shorthands for modifying `dbi.data.other`
   */
  has(k: string): boolean {
    return _.has(this.data.other, k as any);
  }

  /**
   * Shorthands for modifying `dbi.data.other`
   */
  delete(k: string): boolean {
    return _.unset(this.data.other, k);
  }

  async login(): Promise<any> {
    await this.client.login(this.config.discord.token);
  }

  async register(cb: (api: DBIRegisterAPI) => void): Promise<any> {
    this.data.registers.add(cb);
  }

  async load(): Promise<boolean> {
    if (this._loaded) return false;
    await this._registerAll();
    this._loaded = true;
    return true;
  }

  async unload(): Promise<boolean> {
    if (!this._loaded) return false;
    await this._unregisterAll();
    this._loaded = false;
    return true;
  }

  get loaded(): boolean {
    return this._loaded;
  }

  async publish(type: "Global", clear?: boolean): Promise<any>;
  async publish(type: "Guild", guildId: string, clear?: boolean): Promise<any>;

  async publish(...args: any[]) {
    let interactions = this.data.interactions.filter(i => i.type == "ChatInput" || i.type == "MessageContextMenu" || i.type == "UserContextMenu") as any;
    switch (args[0]) {
      case "Global": {
        return await publishInteractions(
          this.config.discord.token,
          args[1] ? new Discord.Collection() : interactions,
          this.data.interactionLocales,
          args[0]
        );
      }
      case "Guild": {
        return await publishInteractions(
          this.config.discord.token,
          args[2] ? new Discord.Collection() : interactions,
          this.data.interactionLocales,
          args[0],
          args[1]
        );
      }
    }
  }

  
}