import Discord from "discord.js";
import { DBI } from "../../DBI";
import { DBIBaseInteraction, IDBIBaseExecuteCtx } from "../Interaction";

export interface IDBIChatInputExecuteCtx extends IDBIBaseExecuteCtx {
  interaction: Discord.ChatInputCommandInteraction<"cached">;
}

export type TDBIChatInputOmitted = Omit<DBIChatInput, "type" | "dbi">;

export class DBIChatInput extends DBIBaseInteraction {
  constructor(dbi: DBI, cfg: TDBIChatInputOmitted) {
    super(dbi, {
      ...(cfg as any),
      type: "ChatInput",
      name: cfg.name.toLowerCase(),
      options: Array.isArray(cfg.options) ? cfg.options : []
    });

    this.directMessages = cfg.directMessages ?? dbi.config.defaults.directMessages;
    this.defaultMemberPermissions = cfg.defaultMemberPermissions ?? dbi.config.defaults.defaultMemberPermissions;
  }
  directMessages?: boolean;
  defaultMemberPermissions?: Discord.PermissionsString[];
  declare options?: any[];
  override onExecute(ctx: IDBIChatInputExecuteCtx) {}
}