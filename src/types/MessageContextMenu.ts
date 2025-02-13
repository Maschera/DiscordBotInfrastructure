import { DBI } from "../DBI";
import { DBIBaseInteraction, IDBIBaseExecuteCtx } from "./Interaction";
import Discord from "discord.js";

export type TDBIMessageContextMenuOmitted = Omit<DBIMessageContextMenu, "type" | "description" | "dbi" | "options">;

export interface IDBIMessageContextMenuExecuteCtx extends IDBIBaseExecuteCtx {
  interaction: Discord.MessageContextMenuCommandInteraction<"cached">;
}


export class DBIMessageContextMenu extends DBIBaseInteraction {
  constructor(dbi: DBI, cfg: TDBIMessageContextMenuOmitted) {
    super(dbi, {
      ...(cfg as any),
      type: "MessageContextMenu"
    });

    this.directMessages = cfg.directMessages ?? dbi.config.defaults.directMessages;
    this.defaultMemberPermissions = cfg.defaultMemberPermissions ?? dbi.config.defaults.defaultMemberPermissions;
  }

  directMessages?: boolean;
  defaultMemberPermissions?: Discord.PermissionsString[];
  override onExecute(ctx: IDBIMessageContextMenuExecuteCtx): Promise<any> | any {}
}